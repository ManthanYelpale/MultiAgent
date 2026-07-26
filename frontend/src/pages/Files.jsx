import React, { useState, useEffect, useCallback } from "react";
import { FileText, Table, Trash2, Loader2, AlertCircle, CheckCircle2, File } from "lucide-react";
import { apiFetch } from "../lib/api";

export default function Files() {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewHasMore, setPreviewHasMore] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchPaginatedData = async (file, page = 1) => {
    if (!file || (file.file_type !== 'csv' && file.file_type !== 'xlsx')) return;
    if (page < 1) return;
    setIsPreviewLoading(true);
    try {
      const data = await apiFetch(`/files/${file.id}/data?page=${page}&limit=25`);
      setPreviewData(data.rows || []);
      setPreviewHasMore(!!data.has_more);
      setPreviewPage(page);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const fetchFiles = useCallback(async () => {
    try {
      const data = await apiFetch(`/files`);
      setFiles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      await apiFetch(`/files/upload`, { method: "POST", body: formData });
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

  const handleDelete = async (fileId, filename, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${filename}"? This also removes its dashboard, cleaned versions, and any RAG index. This cannot be undone.`)) {
      return;
    }
    setDeletingId(fileId);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/files/${fileId}`, { method: "DELETE" });
      setSuccess(`"${filename}" deleted`);
      setTimeout(() => setSuccess(null), 3000);
      if (selectedPreview?.id === fileId) {
        setSelectedPreview(null);
        setPreviewData(null);
      }
      fetchFiles();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleIndexPDF = async (fileId, filename) => {
    setError(null);
    setSuccess(null);
    try {
      const data = await apiFetch(`/rag/index/${fileId}`, { method: "POST" });
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

    const dataToRender = previewData || profile.preview || [];
    const isPaged = previewData != null;

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
              Data Preview {isPaged ? `(Page ${previewPage})` : `(First ${dataToRender.length} Rows)`}
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
                disabled={!previewHasMore || isPreviewLoading}
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
      <div className="flex justify-center w-full my-6">
        <form className="w-fit h-fit flex items-center justify-center" onSubmit={(e) => e.preventDefault()}>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`cursor-pointer py-[30px] px-[70px] rounded-[40px] border-2 border-dashed transition-all duration-300 ${
              dragActive 
                ? "bg-violet-50 border-violet-400" 
                : "bg-white border-slate-300 hover:border-slate-400"
            }`}
          >
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls,.pdf" onChange={handleFileInput} disabled={isUploading} />
            <div className="flex flex-col items-center justify-center gap-[5px]">
              {isUploading ? (
                <>
                  <Loader2 size={28} className="animate-spin text-slate-700" />
                  <p className="font-semibold text-slate-700 mt-2">Uploading...</p>
                </>
              ) : (
                <>
                  <svg className="w-[50px] h-[50px] fill-[#525252] mb-[20px]" viewBox="0 0 1024 1024" focusable="false" data-icon="inbox" aria-hidden="true"><path d="M717 773.5c-30.8 0-60.6-5.8-88.7-16.8-27.4-10.7-52-25.7-73.4-44.5l-45.7-39.6-45.7 39.6c-21.4 18.8-46 33.8-73.4 44.5-28.1 11-57.9 16.8-88.7 16.8H144V250.5h736V773.5H717z m183-595H124c-22.1 0-40 17.9-40 40v672c0 22.1 17.9 40 40 40h776c22.1 0 40-17.9 40-40v-672c0-22.1-17.9-40-40-40z m-524.3 268h-74v152.9H205.1l146.4 145.4 146.4-145.4H401.5V446.5z m286.3-88.7h-74v152.9H517.1l146.4 145.4 146.4-145.4H688.3v-152.9z"></path></svg>
                  <p className="text-sm font-semibold text-slate-700">Drag and Drop</p>
                  <p className="text-xs text-slate-500 mb-2">or</p>
                  <span className="bg-slate-700 hover:bg-slate-900 py-2.5 px-6 rounded-xl text-white transition-all duration-300 text-sm font-semibold mt-1">Browse file</span>
                </>
              )}
            </div>
          </label>
        </form>
      </div>

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
          <div className="flex flex-col gap-3">
            {files.map((f) => (
              <div 
                key={f.id} 
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                  selectedPreview?.id === f.id 
                    ? 'bg-violet-50 border-violet-200 shadow-violet-100' 
                    : 'bg-white border-slate-200 hover:border-violet-200'
                }`}
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
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl flex items-center justify-center ${
                    f.file_type === 'csv' || f.file_type === 'xlsx' ? 'bg-emerald-50' : f.file_type === 'pdf' ? 'bg-red-50' : 'bg-slate-100'
                  }`}>
                    {fileIcon(f.file_type)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{f.original_filename}</p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center">
                      <span className={`font-bold ${
                        f.file_type === 'csv' || f.file_type === 'xlsx' ? 'text-emerald-600' : f.file_type === 'pdf' ? 'text-red-500' : 'text-slate-600'
                      }`}>
                        {f.file_type?.toUpperCase()}
                      </span>
                      {f.row_count != null && (
                        <>
                          <span className="mx-2 text-slate-300">•</span>
                          <span>{f.row_count.toLocaleString()} rows</span>
                        </>
                      )}
                      {f.column_count != null && (
                        <>
                          <span className="mx-2 text-slate-300">•</span>
                          <span>{f.column_count} cols</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4 sm:mt-0">
                  {f.file_type === "pdf" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleIndexPDF(f.id, f.original_filename); }}
                      className="text-[11px] font-bold tracking-wider text-violet-700 bg-violet-100 hover:bg-violet-200 px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-sm uppercase"
                    >
                      Index for RAG
                    </button>
                  )}
                  <div className="flex items-center justify-center bg-slate-50 text-slate-400 text-[10px] font-mono font-bold px-2 py-1 rounded-md border border-slate-100">
                    ID: {f.id}
                  </div>
                  <button
                    onClick={(e) => handleDelete(f.id, f.original_filename, e)}
                    disabled={deletingId === f.id}
                    title="Delete file"
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {deletingId === f.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
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
