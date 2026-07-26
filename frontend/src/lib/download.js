const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

// The API origin, without the /api/v1 suffix. Download URLs returned by the backend are
// already prefixed with the API path, so they must be resolved against the origin —
// using them as bare relative hrefs resolved against the frontend origin (port 3000)
// and 404'd.
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");

/**
 * Download a protected file.
 *
 * /reports/download/* requires an Authorization header, and browsers do not attach
 * headers to plain <a href> navigations — so anchor-based downloads always returned 401.
 * Fetch the bytes with the header, then hand the browser a blob URL.
 */
export async function downloadProtectedFile(downloadUrl, token, suggestedFilename) {
  if (!downloadUrl) throw new Error("No download URL provided");

  const absoluteUrl = downloadUrl.startsWith("http")
    ? downloadUrl
    : `${API_ORIGIN}${downloadUrl}`;

  const res = await fetch(absoluteUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Download failed (${res.status})`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = suggestedFilename || downloadUrl.split("/").pop() || "report";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke on the next tick so the click has already been dispatched.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
