import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, AlertTriangle, Sparkles, FileText, Loader2, AlertCircle,
  LayoutDashboard, Download
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Board from "../components/dashboard/Board";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export default function Analytics() {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState("dashboard");

  // Insights
  const [insights, setInsights] = useState(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Forecast
  const [forecastForm, setForecastForm] = useState({ target_column: "", date_column: "", horizon: 7 });
  const [forecast, setForecast] = useState(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);

  // Anomalies
  const [anomalyForm, setAnomalyForm] = useState({ feature_columns: "", contamination: 0.05 });
  const [anomalies, setAnomalies] = useState(null);
  const [isLoadingAnomalies, setIsLoadingAnomalies] = useState(false);

  // Reports
  const [reportForm, setReportForm] = useState({ target_column: "", date_column: "", export_format: "pdf" });
  const [report, setReport] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const [error, setError] = useState(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      // Only tabular files for analytics
      setFiles(data.filter((f) => f.file_type === "csv" || f.file_type === "xlsx"));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const apiCall = async (url, body, setLoading, setResult) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Request failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runInsights = () => {
    if (!selectedFile) return;
    apiCall("/analytics/insights", { file_id: selectedFile.id }, setIsLoadingInsights, setInsights);
  };

  const runForecast = () => {
    if (!selectedFile || !forecastForm.target_column) return;
    apiCall("/analytics/forecast", {
      file_id: selectedFile.id,
      target_column: forecastForm.target_column,
      date_column: forecastForm.date_column || null,
      horizon: forecastForm.horizon,
    }, setIsLoadingForecast, setForecast);
  };

  const runAnomalies = () => {
    if (!selectedFile) return;
    const cols = anomalyForm.feature_columns
      ? anomalyForm.feature_columns.split(",").map((c) => c.trim()).filter(Boolean)
      : null;
    apiCall("/analytics/anomalies", {
      file_id: selectedFile.id,
      feature_columns: cols,
      contamination: anomalyForm.contamination,
    }, setIsLoadingAnomalies, setAnomalies);
  };

  const runReport = () => {
    if (!selectedFile || !reportForm.target_column) return;
    apiCall("/reports/weekly", {
      file_id: selectedFile.id,
      target_column: reportForm.target_column,
      date_column: reportForm.date_column || null,
      export_format: reportForm.export_format,
    }, setIsLoadingReport, setReport);
  };

  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "insights", label: "AI Insights", icon: Sparkles },
    { key: "forecast", label: "Forecast", icon: TrendingUp },
    { key: "anomalies", label: "Anomalies", icon: AlertTriangle },
    { key: "reports", label: "Reports", icon: FileText },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Run AI insights, forecasts, anomaly detection, and generate reports from your uploaded files.</p>
      </div>

      {/* File Selector */}
      <div className="space-y-3 pt-2">
        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Select a file</label>
        {isLoadingFiles ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading files...</div>
        ) : files.length === 0 ? (
          <p className="text-sm text-slate-400">No tabular files uploaded yet. Go to <span className="font-semibold text-violet-600">Files</span> to upload a CSV or Excel file first.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {files.map((f) => (
              <button
                key={f.id}
                onClick={() => { setSelectedFile(f); setActiveTab("dashboard"); setInsights(null); setForecast(null); setAnomalies(null); setReport(null); setError(null); }}
                className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  selectedFile?.id === f.id
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-700"
                }`}
              >
                <p className="font-semibold truncate">{f.original_filename}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{f.row_count?.toLocaleString()} rows · {f.column_count} cols</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      {selectedFile && (
        <>
          <div className="inline-flex p-1.5 bg-slate-100/80 rounded-xl overflow-x-auto max-w-full hide-scrollbar">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center justify-center px-8 py-3 text-sm font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === t.key
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <Board fileId={selectedFile.id} columnsPreview={selectedFile.columns_preview} />
          )}

          {/* Insights Tab */}
          {activeTab === "insights" && (
            <div className="space-y-4">
              <button
                onClick={runInsights}
                disabled={isLoadingInsights}
                className="inline-flex items-center gap-2 bg-black hover:bg-transparent hover:text-black border-2 border-black text-white text-xs font-semibold px-6 py-2.5 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-none"
              >
                {isLoadingInsights && <Loader2 size={14} className="animate-spin" />}
                Generate AI Insights
              </button>
              {insights && (
                <div className="pt-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">AI Insights for {insights.filename}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-w-4xl">{insights.insights_summary}</p>
                </div>
              )}
            </div>
          )}

          {/* Forecast Tab */}
          {activeTab === "forecast" && (
            <div className="space-y-6 pt-4">
              <div className="grid sm:grid-cols-3 gap-4 max-w-3xl">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Target column *</label>
                  <input
                    value={forecastForm.target_column}
                    onChange={(e) => setForecastForm((p) => ({ ...p, target_column: e.target.value }))}
                    placeholder="e.g. revenue"
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Date column</label>
                  <input
                    value={forecastForm.date_column}
                    onChange={(e) => setForecastForm((p) => ({ ...p, date_column: e.target.value }))}
                    placeholder="e.g. date"
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Horizon (days)</label>
                  <input
                    type="number"
                    value={forecastForm.horizon}
                    onChange={(e) => setForecastForm((p) => ({ ...p, horizon: parseInt(e.target.value) || 7 }))}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
              </div>
              <button
                onClick={runForecast}
                disabled={isLoadingForecast || !forecastForm.target_column}
                className="inline-flex items-center gap-2 bg-black hover:bg-transparent hover:text-black border-2 border-black text-white text-xs font-semibold px-6 py-2.5 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-none"
              >
                {isLoadingForecast && <Loader2 size={14} className="animate-spin" />}
                Run Forecast
              </button>
              {forecast && (
                <div className="pt-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Forecast Results</h3>
                  <pre className="text-xs text-slate-700 bg-slate-50/50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap border border-slate-100 max-w-4xl">
                    {JSON.stringify(forecast, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Anomalies Tab */}
          {activeTab === "anomalies" && (
            <div className="space-y-6 pt-4">
              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Feature columns (comma-separated)</label>
                  <input
                    value={anomalyForm.feature_columns}
                    onChange={(e) => setAnomalyForm((p) => ({ ...p, feature_columns: e.target.value }))}
                    placeholder="e.g. revenue, cost (leave empty for all numeric)"
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Contamination rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={anomalyForm.contamination}
                    onChange={(e) => setAnomalyForm((p) => ({ ...p, contamination: parseFloat(e.target.value) || 0.05 }))}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
              </div>
              <button
                onClick={runAnomalies}
                disabled={isLoadingAnomalies}
                className="inline-flex items-center gap-2 bg-black hover:bg-transparent hover:text-black border-2 border-black text-white text-xs font-semibold px-6 py-2.5 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-none"
              >
                {isLoadingAnomalies && <Loader2 size={14} className="animate-spin" />}
                Detect Anomalies
              </button>
              {anomalies && (
                <div className="pt-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Anomalies Found: <span className="text-red-600">{anomalies.anomaly_count}</span> / {anomalies.total_rows}
                  </h3>
                  <pre className="text-xs text-slate-700 bg-slate-50/50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap border border-slate-100 max-w-4xl">
                    {JSON.stringify(anomalies, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === "reports" && (
            <div className="space-y-6 pt-4">
              <div className="grid sm:grid-cols-3 gap-4 max-w-3xl">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Target column *</label>
                  <input
                    value={reportForm.target_column}
                    onChange={(e) => setReportForm((p) => ({ ...p, target_column: e.target.value }))}
                    placeholder="e.g. revenue"
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Date column</label>
                  <input
                    value={reportForm.date_column}
                    onChange={(e) => setReportForm((p) => ({ ...p, date_column: e.target.value }))}
                    placeholder="e.g. date"
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Format</label>
                  <select
                    value={reportForm.export_format}
                    onChange={(e) => setReportForm((p) => ({ ...p, export_format: e.target.value }))}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  >
                    <option value="pdf">PDF</option>
                    <option value="pptx">PowerPoint</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
              <button
                onClick={runReport}
                disabled={isLoadingReport || !reportForm.target_column}
                className="inline-flex items-center gap-2 bg-black hover:bg-transparent hover:text-black border-2 border-black text-white text-xs font-semibold px-6 py-2.5 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-none"
              >
                {isLoadingReport && <Loader2 size={14} className="animate-spin" />}
                Generate Report
              </button>
              {report && (
                <div className="pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Report Ready</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap max-w-4xl">{report.insights_summary}</p>
                  <div className="flex gap-4 pt-2">
                    {report.pdf_download_url && (
                      <a
                        href={`${API_BASE_URL.replace("/api/v1", "")}${report.pdf_download_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-800"
                      >
                        <Download size={16} /> Download PDF
                      </a>
                    )}
                    {report.pptx_download_url && (
                      <a
                        href={`${API_BASE_URL.replace("/api/v1", "")}${report.pptx_download_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-800"
                      >
                        <Download size={16} /> Download PPTX
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
