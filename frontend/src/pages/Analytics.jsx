import React, { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, Download } from "lucide-react";
import Board from "../components/dashboard/Board";
import ColumnDropdown from "../components/analytics/ColumnDropdown";
import { apiFetch, downloadProtectedFile, pollJob } from "../lib/api";
import ForecastResult from "../components/analytics/ForecastResult";
import TrendResult from "../components/analytics/TrendResult";
import AnomalyResult from "../components/analytics/AnomalyResult";
import SegmentationResult from "../components/analytics/SegmentationResult";

export default function Analytics() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  // Column list for the selected dataset
  const [columns, setColumns] = useState([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState("dashboard");

  // Insights
  const [insights, setInsights] = useState(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Forecast
  const [forecastForm, setForecastForm] = useState({ target_column: "", date_column: "", horizon: 7 });
  const [forecast, setForecast] = useState(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);

  // Trend
  const [trendForm, setTrendForm] = useState({ target_column: "", window: 7 });
  const [trend, setTrend] = useState(null);
  const [isLoadingTrend, setIsLoadingTrend] = useState(false);

  // Anomalies
  const [anomalyForm, setAnomalyForm] = useState({ column_to_check: "", contamination: 0.05 });
  const [anomalies, setAnomalies] = useState(null);
  const [isLoadingAnomalies, setIsLoadingAnomalies] = useState(false);

  // Segmentation
  const [segmentationForm, setSegmentationForm] = useState({
    n_clusters: 4,
    id_column: "",
    date_column: "",
    monetary_column: "",
  });
  const [segmentation, setSegmentation] = useState(null);
  const [isLoadingSegmentation, setIsLoadingSegmentation] = useState(false);

  // Reports
  const [reportForm, setReportForm] = useState({ target_column: "", date_column: "", export_format: "pdf" });
  const [report, setReport] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const [error, setError] = useState(null);

  const fetchFiles = useCallback(async () => {
    try {
      const data = await apiFetch(`/files`);
      setFiles(data.filter((f) => f.file_type === "csv" || f.file_type === "xlsx"));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (!selectedFile) {
      setColumns([]);
      return;
    }
    const fetchColumns = async () => {
      setIsLoadingColumns(true);
      try {
        const data = await apiFetch(`/datasets/${selectedFile.id}/columns`);
        setColumns(data.columns || []);
      } catch (err) {
        setColumns([]);
      } finally {
        setIsLoadingColumns(false);
      }
    };
    fetchColumns();
  }, [selectedFile]);

  const apiCall = async (url, body, setLoading, setResult) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(url, { method: "POST", body });
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

  const runTrend = () => {
    if (!selectedFile || !trendForm.target_column) return;
    apiCall("/analytics/trend", {
      file_id: selectedFile.id,
      target_column: trendForm.target_column,
      window: trendForm.window,
    }, setIsLoadingTrend, setTrend);
  };

  const runAnomalies = () => {
    if (!selectedFile) return;
    const cols = anomalyForm.column_to_check ? [anomalyForm.column_to_check] : null;
    apiCall("/analytics/anomalies", {
      file_id: selectedFile.id,
      feature_columns: cols,
      contamination: anomalyForm.contamination,
    }, setIsLoadingAnomalies, setAnomalies);
  };

  const runSegmentation = () => {
    if (!selectedFile) return;
    apiCall("/analytics/segmentation", {
      file_id: selectedFile.id,
      n_clusters: segmentationForm.n_clusters,
      id_column: segmentationForm.id_column || null,
      date_column: segmentationForm.date_column || null,
      monetary_column: segmentationForm.monetary_column || null,
    }, setIsLoadingSegmentation, setSegmentation);
  };

  const handleDownload = async (url, filename) => {
    try {
      await downloadProtectedFile(url, filename);
    } catch (err) {
      setError(err.message);
    }
  };

  const runReport = async () => {
    if (!selectedFile || !reportForm.target_column) return;
    setIsLoadingReport(true);
    setError(null);
    setReport(null);
    try {
      // Report generation is a background job now: enqueue then poll.
      const { job_id } = await apiFetch("/reports/weekly", {
        method: "POST",
        body: {
          file_id: selectedFile.id,
          target_column: reportForm.target_column,
          date_column: reportForm.date_column || null,
          export_format: reportForm.export_format,
        },
      });
      const result = await pollJob(`/reports/jobs/${job_id}`);
      setReport(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "insights", label: "AI Insights" },
    { key: "forecast", label: "Forecast" },
    { key: "trend", label: "Trend" },
    { key: "anomalies", label: "Anomalies" },
    { key: "segmentation", label: "Segmentation" },
    { key: "reports", label: "Reports" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Run AI insights, forecasts, anomaly detection, customer segmentation, and generate reports from your uploaded files.</p>
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
                onClick={() => {
                  setSelectedFile(f);
                  setActiveTab("dashboard");
                  setInsights(null);
                  setForecast(null);
                  setTrend(null);
                  setAnomalies(null);
                  setSegmentation(null);
                  setReport(null);
                  setError(null);
                }}
                className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                  selectedFile?.id === f.id
                    ? "border-violet-300 bg-violet-50 text-violet-700 font-semibold"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="font-medium truncate">{f.original_filename}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{f.file_type.toUpperCase()}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-xs">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {selectedFile && (
        <>
          {/* Sub-Navigation Tabs */}
          <div className="flex flex-wrap border-b-2 border-slate-200 gap-x-6 sm:gap-x-8 gap-y-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-3 sm:px-4 sm:py-3.5 text-sm sm:text-base font-bold border-b-2 -mb-[2px] transition-all cursor-pointer ${
                  activeTab === t.key
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isLoadingColumns && (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
              <Loader2 size={12} className="animate-spin" /> Loading columns from dataset...
            </div>
          )}

          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <Board fileId={selectedFile.id} columnsPreview={selectedFile.columns_preview} />
          )}

          {/* AI Insights Tab */}
          {activeTab === "insights" && (
            <div className="space-y-4 pt-4">
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
                <ColumnDropdown
                  label="Target Column"
                  required
                  columns={columns}
                  value={forecastForm.target_column}
                  onChange={(val) => setForecastForm((p) => ({ ...p, target_column: val }))}
                  placeholder="Select target column..."
                />
                <ColumnDropdown
                  label="Date Column (Optional)"
                  columns={columns}
                  value={forecastForm.date_column}
                  onChange={(val) => setForecastForm((p) => ({ ...p, date_column: val }))}
                  placeholder="Select date column..."
                />
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
              {forecast && <ForecastResult forecast={forecast} />}
            </div>
          )}

          {/* Trend Tab */}
          {activeTab === "trend" && (
            <div className="space-y-6 pt-4">
              <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
                <ColumnDropdown
                  label="Metric Column"
                  required
                  columns={columns}
                  value={trendForm.target_column}
                  onChange={(val) => setTrendForm((p) => ({ ...p, target_column: val }))}
                  placeholder="Select metric column..."
                />
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Window Size</label>
                  <input
                    type="number"
                    value={trendForm.window}
                    onChange={(e) => setTrendForm((p) => ({ ...p, window: parseInt(e.target.value) || 7 }))}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
              </div>
              <button
                onClick={runTrend}
                disabled={isLoadingTrend || !trendForm.target_column}
                className="inline-flex items-center gap-2 bg-black hover:bg-transparent hover:text-black border-2 border-black text-white text-xs font-semibold px-6 py-2.5 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-none"
              >
                {isLoadingTrend && <Loader2 size={14} className="animate-spin" />}
                Analyze Trend
              </button>
              {trend && <TrendResult trend={trend} />}
            </div>
          )}

          {/* Anomalies Tab */}
          {activeTab === "anomalies" && (
            <div className="space-y-6 pt-4">
              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
                <ColumnDropdown
                  label="Column to check (Optional)"
                  columns={columns}
                  value={anomalyForm.column_to_check}
                  onChange={(val) => setAnomalyForm((p) => ({ ...p, column_to_check: val }))}
                  placeholder="All numeric columns (default)"
                />
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
              {anomalies && <AnomalyResult anomalies={anomalies} />}
            </div>
          )}

          {/* Segmentation Tab */}
          {activeTab === "segmentation" && (
            <div className="space-y-6 pt-4">
              <div className="grid sm:grid-cols-4 gap-4 max-w-4xl">
                <ColumnDropdown
                  label="Customer ID Field (Optional)"
                  columns={columns}
                  value={segmentationForm.id_column}
                  onChange={(val) => setSegmentationForm((p) => ({ ...p, id_column: val }))}
                  placeholder="Auto-detect ID column"
                />
                <ColumnDropdown
                  label="Date Field (Optional)"
                  columns={columns}
                  value={segmentationForm.date_column}
                  onChange={(val) => setSegmentationForm((p) => ({ ...p, date_column: val }))}
                  placeholder="Auto-detect date column"
                />
                <ColumnDropdown
                  label="Amount Field (Optional)"
                  columns={columns}
                  value={segmentationForm.monetary_column}
                  onChange={(val) => setSegmentationForm((p) => ({ ...p, monetary_column: val }))}
                  placeholder="Auto-detect amount column"
                />
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Number of Clusters</label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={segmentationForm.n_clusters}
                    onChange={(e) => setSegmentationForm((p) => ({ ...p, n_clusters: parseInt(e.target.value) || 4 }))}
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
              </div>
              <button
                onClick={runSegmentation}
                disabled={isLoadingSegmentation}
                className="inline-flex items-center gap-2 bg-black hover:bg-transparent hover:text-black border-2 border-black text-white text-xs font-semibold px-6 py-2.5 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-none"
              >
                {isLoadingSegmentation && <Loader2 size={14} className="animate-spin" />}
                Run Segmentation
              </button>
              {segmentation && <SegmentationResult segmentation={segmentation} />}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === "reports" && (
            <div className="space-y-6 pt-4">
              <div className="grid sm:grid-cols-3 gap-4 max-w-3xl">
                <ColumnDropdown
                  label="Target Column"
                  required
                  columns={columns}
                  value={reportForm.target_column}
                  onChange={(val) => setReportForm((p) => ({ ...p, target_column: val }))}
                  placeholder="Select target column..."
                />
                <ColumnDropdown
                  label="Date Column (Optional)"
                  columns={columns}
                  value={reportForm.date_column}
                  onChange={(val) => setReportForm((p) => ({ ...p, date_column: val }))}
                  placeholder="Select date column..."
                />
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
                      <button
                        type="button"
                        onClick={() => handleDownload(report.pdf_download_url, report.pdf_filename)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-800 cursor-pointer"
                      >
                        <Download size={16} /> Download PDF
                      </button>
                    )}
                    {report.pptx_download_url && (
                      <button
                        type="button"
                        onClick={() => handleDownload(report.pptx_download_url, report.pptx_filename)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-800 cursor-pointer"
                      >
                        <Download size={16} /> Download PPTX
                      </button>
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
