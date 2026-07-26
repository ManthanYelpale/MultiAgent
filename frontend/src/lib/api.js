// Single source of truth for API access. Previously every page redefined API_BASE_URL
// and its fallback, and none handled token expiry — so at the 60-minute mark the app
// silently failed with generic red banners while still appearing logged in.

export const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

// API origin without the version suffix, for download links the backend already
// prefixes with /api/v1.
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");

// Subscribers notified when the server rejects our token (401). AuthContext registers
// here to trigger a clean logout instead of every page inventing its own handling.
const unauthorizedHandlers = new Set();

export function onUnauthorized(handler) {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

function notifyUnauthorized() {
  unauthorizedHandlers.forEach((h) => {
    try {
      h();
    } catch {
      /* ignore */
    }
  });
}

function readToken() {
  return localStorage.getItem("token");
}

/**
 * Extract a human-readable message from a FastAPI error body. `detail` may be a string
 * or a pydantic validation array; the latter must not be rendered as "[object Object]".
 */
export function extractErrorMessage(body, fallback) {
  if (!body) return fallback;
  const detail = body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => e?.msg || (typeof e === "string" ? e : null))
      .filter(Boolean)
      .join("; ") || fallback;
  }
  return fallback;
}

/**
 * fetch wrapper that attaches the bearer token, parses JSON, throws on error with a
 * clean message, and triggers global logout on 401.
 *
 * @returns parsed JSON body (or null for 204)
 */
export async function apiFetch(path, { method = "GET", body, headers = {}, raw = false } = {}) {
  const token = readToken();
  const finalHeaders = { ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body !== undefined && !(body instanceof FormData) && !raw) {
    finalHeaders["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: payload,
  });

  if (res.status === 401) {
    notifyUnauthorized();
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  const parsed = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : null;

  if (!res.ok) {
    throw new Error(extractErrorMessage(parsed, `Request failed (${res.status})`));
  }
  return parsed;
}

/**
 * Download a protected file. /reports/download/* requires the Authorization header, and
 * browsers do not attach headers to plain <a> navigations, so anchor downloads 401'd.
 */
export async function downloadProtectedFile(downloadUrl, suggestedFilename) {
  if (!downloadUrl) throw new Error("No download URL provided");
  const token = readToken();
  const absoluteUrl = downloadUrl.startsWith("http")
    ? downloadUrl
    : `${API_ORIGIN}${downloadUrl}`;

  const res = await fetch(absoluteUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    notifyUnauthorized();
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = suggestedFilename || downloadUrl.split("/").pop() || "download";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

/** Poll a job endpoint until it reaches a terminal state. */
export async function pollJob(jobPath, { intervalMs = 1500, timeoutMs = 120000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await apiFetch(jobPath);
    if (data.status === "succeeded") return data.result;
    if (data.status === "failed") throw new Error(data.error || "The job failed.");
    if (Date.now() > deadline) throw new Error("Timed out waiting for the job to finish.");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
