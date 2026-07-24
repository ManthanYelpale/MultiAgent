import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Database, Check } from 'lucide-react';
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

const STRATEGIES = [
  { value: 'fill_mean', label: 'Fill with Mean' },
  { value: 'fill_median', label: 'Fill with Median' },
  { value: 'fill_mode', label: 'Fill with Mode' },
  { value: 'fill_custom', label: 'Fill Custom Value' },
  { value: 'drop_rows', label: 'Drop Rows' },
  { value: 'convert_numeric', label: 'Extract Numeric (Remove $,%)' },
  { value: 'leave_as_is', label: 'Leave As Is' }
];

export default function Review({ fileId, onComplete }) {
  const { token } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  // Array of { column_name, issue_type, strategy, params }
  const [configs, setConfigs] = useState([]);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/cleaning/file/${fileId}/quality-report`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to load quality report");
        const data = await res.json();
        setReport(data);
        
        // Initialize configs from AI suggestions
        setConfigs(data.issues.map(iss => ({
          column_name: iss.column_name,
          issue_type: iss.issue_type,
          strategy: iss.suggested_strategy || 'leave_as_is',
          params: { value: '' }
        })));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [fileId, token]);

  const updateConfig = (idx, field, value) => {
    const newConfigs = [...configs];
    if (field === 'params.value') {
      newConfigs[idx].params.value = value;
    } else {
      newConfigs[idx][field] = value;
    }
    setConfigs(newConfigs);
  };

  const handleApply = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/cleaning/file/${fileId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ configs })
      });
      if (res.ok) {
        onComplete();
      } else {
        throw new Error("Failed to apply cleaning");
      }
    } catch(e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/cleaning/file/${fileId}/skip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        onComplete();
      }
    } catch(e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-violet-600" /></div>;
  if (error) return <div className="py-12 flex justify-center text-red-500"><AlertCircle className="mr-2"/> {error}</div>;

  if (report?.issues?.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
          <Check size={24} />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-lg">Dataset looks perfectly clean!</h3>
          <p className="text-sm text-slate-500 mt-1">We didn't detect any missing values or type mismatches in {report.total_rows} rows.</p>
        </div>
        <button onClick={handleSkip} className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors cursor-pointer text-sm">
          Continue to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-show-panel">
      <div className="bg-white p-5 rounded-2xl border border-slate-200">
        <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          <Database size={20} className="text-violet-600" />
          Data Quality Report
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          We found {report?.issues?.length} issues in your dataset ({report?.total_rows} total rows). Review our AI's suggested fixes below.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">Column</th>
                <th className="px-4 py-3">Issue Detected</th>
                <th className="px-4 py-3">Suggested Strategy</th>
                <th className="px-4 py-3">AI Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report?.issues.map((issue, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-4 py-4 align-top">
                    <span className="font-semibold text-slate-700">{issue.column_name}</span>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">Ex: {issue.sample_values.join(', ')}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-red-500 font-medium">
                    {issue.description}
                  </td>
                  <td className="px-4 py-4 align-top min-w-[200px]">
                    <select
                      value={configs[idx].strategy}
                      onChange={e => updateConfig(idx, 'strategy', e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-violet-500 cursor-pointer"
                    >
                      {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    {configs[idx].strategy === 'fill_custom' && (
                      <input 
                        type="text" 
                        placeholder="Custom value..." 
                        value={configs[idx].params.value}
                        onChange={e => updateConfig(idx, 'params.value', e.target.value)}
                        className="mt-2 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-violet-500"
                      />
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <p className="text-xs text-slate-500 italic">"{issue.reason}"</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button 
          onClick={handleSkip} 
          disabled={processing}
          className="px-6 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
        >
          Skip Cleaning
        </button>
        <button 
          onClick={handleApply} 
          disabled={processing}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {processing ? <Loader2 size={16} className="animate-spin"/> : null}
          Apply Cleaning & Render
        </button>
      </div>
    </div>
  );
}
