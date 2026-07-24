import React, { useState, useEffect, useCallback } from "react";
import { Upload, FileText, Table, Trash2, Loader2, AlertCircle, CheckCircle2, File } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export default function Files() {
  const { token } = useAuth();
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const fetchPaginatedData = async (file, page = 1) => {
    if (!file || (file.file_type !== 'csv' && file.file_type !== 'xlsx')) return;
    setIsPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/files/${file.id}/data?page=${page}&limit=25`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
        setPreviewPage(page);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }
      setSuccess(`"${file.name}" uploaded successfully`);
      setTimeout(() => setSuccess(null), 3000);
      fetchFiles();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleIndexPDF = async (fileId, filename) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/rag/index/${fileId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Indexing failed");
      }
      const data = await res.json();
      setSuccess(`"${filename}" indexed successfully (${data.chunks_indexed} chunks)`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const fileIcon = (type) => {
    if (type === "csv" || type === "xlsx") return <Table size={18} className="text-emerald-600" />;
    if (type === "pdf") return <FileText size={18} className="text-red-500" />;
    return <File size={18} className="text-slate-400" />;
  };

  const renderPreview = () => {
    if (!selectedPreview) return null;
    
    let profile = null;
    if (selectedPreview.columns_preview) {
      try {
        profile = JSON.parse(selectedPreview.columns_preview);
      } catch (e) {}
    }

    if (selectedPreview.file_type === "pdf") {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mt-6 animate-show-panel">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><FileText size={18}/> PDF Preview</h3>
          {profile ? (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm text-slate-600">
                <p>Pages: <span className="font-semibold text-slate-900">{profile.page_count}</span></p>
                <p>Characters: <span className="font-semibold text-slate-900">{profile.char_count?.toLocaleString()}</span></p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs font-mono text-slate-600 overflow-hidden whitespace-pre-wrap">
                {profile.preview}
              </div>
            </div>
          ) : <p className="text-sm text-slate-500">No profile data available.</p>}
        </div>
      );
    }

    if (!profile || !profile.preview) {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mt-6 animate-show-panel">
          <p className="text-sm text-slate-500">No profile data available for this file. It may have been uploaded before profiling was enabled.</p>
        </div>
      );
    }

    const dataToRender = previewData || profile.preview;

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mt-6 space-y-6 animate-show-panel">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Table size={18}/> Data Health & Preview</h3>
        
        {/* Health Card */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Rows & Columns</p>
            <p className="text-lg font-bold text-slate-900">{selectedPreview.row_count?.toLocaleString()} × {selectedPreview.column_count}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Overall Nulls</p>
            <p className="text-lg font-bold text-slate-900">{profile.nulls?.overall_percentage}%</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Exact Duplicates</p>
            <p className="text-lg font-bold text-slate-900">{profile.duplicates?.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Cleaning Suggestions</p>
            <p className="text-lg font-bold text-slate-900">{profile.suggestions?.length || 0}</p>
          </div>
        </div>

        {profile.suggestions?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5"><AlertCircle size={16}/> Cleaning Suggestions</h4>
            <ul className="list-disc pl-5 text-xs text-amber-700 space-y-1">
              {profile.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {/* Data Preview Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800">
              Data Preview {previewData ? `(Page ${previewPage})` : `(First ${dataToRender.length} Rows)`}
              {isPreviewLoading && <Loader2 size={14} className="inline ml-2 animate-spin text-slate-400" />}
            </h4>
            <div className="flex gap-2">
              <button 
                onClick={() => fetchPaginatedData(selectedPreview, previewPage - 1)}
                disabled={previewPage === 1 || isPreviewLoading}
                className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>
              <button 
                onClick={() => fetchPaginatedData(selectedPreview, previewPage + 1)}
                disabled={dataToRender.length < 25 || isPreviewLoading}
                className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Next 25
              </button>
            </div>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {profile.columns.map((col) => (
                    <th key={col} className="px-4 py-3 font-semibold text-slate-700">
                      <div>{col}</div>
                      {profile.dtypes?.[col] && (
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                          {profile.dtypes[col].inferred}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataToRender.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {profile.columns.map((col) => (
                      <td key={col} className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate">
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Files</h1>
        <p className="text-sm text-slate-500 mt-1">Upload CSV, Excel, or PDF files to use with Analytics, RAG, and Data QA.</p>
      </div>

      {/* Upload Zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`block border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          dragActive
            ? "border-violet-400 bg-violet-50"
            : "border-slate-200 hover:border-slate-300 bg-white"
        }`}
      >
        <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.pdf" onChange={handleFileInput} disabled={isUploading} />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={28} className="animate-spin text-violet-600" />
            <p className="text-sm font-medium text-slate-600">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} className="text-slate-400" />
            <p className="text-sm font-medium text-slate-700">Drop a file here or click to browse</p>
            <p className="text-xs text-slate-400">CSV, Excel, PDF — max 25MB</p>
          </div>
        )}
      </label>

      {/* Feedback */}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* File List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Your files</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-violet-600" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">No files uploaded yet.</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
            {files.map((f) => (
              <div 
                key={f.id} 
                className={`flex items-center justify-between px-5 py-4 transition-colors cursor-pointer ${selectedPreview?.id === f.id ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
                onClick={() => {
                  if (selectedPreview?.id === f.id) {
                    setSelectedPreview(null);
                    setPreviewData(null);
                  } else {
                    setSelectedPreview(f);
                    setPreviewData(null);
                    fetchPaginatedData(f, 1);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  {fileIcon(f.file_type)}
                  <div>
                    <p className="text-sm font-medium text-slate-900">{f.original_filename}</p>
                    <p className="text-xs text-slate-400">
                      {f.file_type?.toUpperCase()}
                      {f.row_count != null && ` · ${f.row_count.toLocaleString()} rows`}
                      {f.column_count != null && ` · ${f.column_count} cols`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {f.file_type === "pdf" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleIndexPDF(f.id, f.original_filename); }}
                      className="text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Index for RAG
                    </button>
                  )}
                  <span className="text-xs text-slate-400 font-mono">ID: {f.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderPreview()}
    </div>
  );
}
