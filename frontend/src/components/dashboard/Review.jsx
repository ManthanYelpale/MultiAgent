import React, { useState, useEffect, useRef } from 'react';
import { 
  Loader2, 
  AlertCircle, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Bookmark, 
  AlertTriangle,
  Layers,
  ArrowRight
} from 'lucide-react';
import { apiFetch } from "../../lib/api";

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
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Array of { column_name, issue_type, strategy, params }
  const [configs, setConfigs] = useState([]);

  // UI state for group expanders & minor issues
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showAllGroups, setShowAllGroups] = useState(false);

  // Save as template modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [autoApplying, setAutoApplying] = useState(false);
  const autoApplyTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch(`/cleaning/file/${fileId}/quality-report`);
        if (cancelled) return;
        setReport(data);

        // Initialise one config per (column, issue_type) so a column with two distinct
        // issues gets two independently-editable rows instead of colliding on the name.
        const initialConfigs = (data.issues || []).map(iss => ({
          column_name: iss.column_name,
          issue_type: iss.issue_type,
          strategy: iss.suggested_strategy || 'leave_as_is',
          params: { value: '' }
        }));
        setConfigs(initialConfigs);

        // If a template matches, auto-apply after a brief toast. The timer is tracked so
        // it can be cancelled if the component unmounts before it fires (previously it
        // still ran, writing on an unmounted component).
        if (data.has_template && data.template_rules?.length > 0) {
          setAutoApplying(true);
          autoApplyTimer.current = setTimeout(() => {
            handleApplyRaw(data.template_rules);
          }, 1200);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchReport();
    return () => {
      cancelled = true;
      if (autoApplyTimer.current) clearTimeout(autoApplyTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Match on column AND issue type: a column can appear under two issue groups, and
  // editing one must not silently overwrite the other's strategy.
  const updateColumnConfig = (colName, issueType, field, value) => {
    setConfigs(prev => prev.map(c => {
      if (c.column_name === colName && c.issue_type === issueType) {
        if (field === 'params.value') {
          return { ...c, params: { ...c.params, value } };
        }
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  const updateGroupStrategy = (group, newStrategy) => {
    const affected = new Set(group.columns_affected);
    setConfigs(prev => prev.map(c => {
      if (affected.has(c.column_name) && c.issue_type === group.issue_type) {
        return { ...c, strategy: newStrategy };
      }
      return c;
    }));
  };

  const toggleGroupExpanded = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleApplyRaw = async (rulesToApply) => {
    setProcessing(true);
    try {
      await apiFetch(`/cleaning/file/${fileId}/apply`, {
        method: 'POST',
        body: { configs: rulesToApply },
      });
      onComplete();
    } catch (e) {
      setError(e.message);
      setProcessing(false);
      setAutoApplying(false);
    }
  };

  const handleApplyClick = () => {
    // Offer to save as template if no existing template matched
    if (report && !report.has_template && report.issue_groups?.length > 0) {
      setTemplateName(`Report Shape (${report.total_columns} columns)`);
      setShowSaveModal(true);
    } else {
      handleApplyRaw(configs);
    }
  };

  const handleSaveTemplateAndContinue = async () => {
    setProcessing(true);
    try {
      // file_id must be sent: without it the backend derives the schema signature from
      // the rule column names (only the *dirty* columns), which can never equal the
      // dataset's full column set — so the template could never match on a later upload.
      await apiFetch(`/cleaning/file/${fileId}/save-template`, {
        method: 'POST',
        body: { name: templateName || 'My Report Template', rules: configs },
      });
    } catch (e) {
      // Ignore template error and continue with applying the cleaning.
    }
    await handleApplyRaw(configs);
  };

  const handleSkip = async () => {
    setProcessing(true);
    try {
      await apiFetch(`/cleaning/file/${fileId}/skip`, { method: 'POST' });
      onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="animate-spin text-violet-600 w-8 h-8" />
        <p className="text-sm text-slate-500 font-medium">Analyzing dataset quality and semantic column types...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 flex items-center justify-center text-red-500 bg-red-50/50 rounded-2xl border border-red-200 p-6">
        <AlertCircle className="mr-2 w-5 h-5"/>
        <span className="font-semibold">{error}</span>
      </div>
    );
  }

  if (autoApplying) {
    return (
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-8 text-white text-center shadow-lg animate-show-panel space-y-3">
        <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h3 className="font-bold text-xl">Saved Template Matched!</h3>
        <p className="text-sm text-emerald-100 max-w-md mx-auto">
          We recognized this report shape (matching template: <span className="font-semibold text-white">"{report?.template_name}"</span>) and are automatically applying your saved cleaning rules...
        </p>
      </div>
    );
  }

  if (report?.issue_groups?.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
        <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
          <Check size={24} />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-lg">{report?.quality_headline || "100/100 — All columns clean!"}</h3>
          <p className="text-sm text-slate-500 mt-1">
            We analyzed {report.total_columns} columns across {report.total_rows} rows and found zero issues requiring manual review.
          </p>
          {report?.auto_safe_issues?.length > 0 && (
            <p className="text-xs text-emerald-600 mt-2 font-medium">
              ✓ {report.auto_safe_issues.length} auto-safe rules applied silently (e.g. whitespace trimming, string null normalizations)
            </p>
          )}
        </div>
        <button 
          onClick={handleSkip} 
          className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm shadow-md hover:shadow-lg"
        >
          Continue to Dashboard
        </button>
      </div>
    );
  }

  const score = report?.quality_score ?? 100;
  const scoreColorClass = score >= 90 
    ? 'text-emerald-400 border-emerald-400/30 bg-emerald-500/10' 
    : score >= 70 
    ? 'text-amber-400 border-amber-400/30 bg-amber-500/10' 
    : 'text-rose-400 border-rose-400/30 bg-rose-500/10';

  const visibleGroups = showAllGroups ? report.issue_groups : report.issue_groups.slice(0, 3);
  const hiddenGroupCount = Math.max(0, report.issue_groups.length - 3);

  return (
    <div className="space-y-6 animate-show-panel">
      {/* 1. Headline Data Quality Score Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-300 text-xs font-semibold">
            <Sparkles size={14} />
            Data Quality Score
          </div>
          <h2 className="font-bold text-2xl tracking-tight text-white">
            {report?.quality_headline}
          </h2>
          <p className="text-sm text-slate-300 max-w-xl">
            We grouped issues across {report?.total_columns} columns into {report?.issue_groups.length} high-impact issue types.
            {report?.auto_safe_issues?.length > 0 && (
              <span className="text-emerald-300 ml-1 font-medium">
                ({report.auto_safe_issues.length} minor formatting fixes applied silently.)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className={`px-5 py-3 rounded-2xl border ${scoreColorClass} flex flex-col items-center justify-center font-bold`}>
            <span className="text-3xl tracking-tight">{score}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">Out of 100</span>
          </div>
        </div>
      </div>

      {/* 2. Grouped Issue Cards (O(issue-types) Review) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <Layers size={16} className="text-violet-600" />
            Issue Groups requiring judgment ({report?.issue_groups.length})
          </h3>
          <span className="text-xs text-slate-400">Ranked by rows affected & KPI importance</span>
        </div>

        {visibleGroups.map((group, idx) => {
          const isBlocking = group.confidence_tier === 'blocking';
          const currentGroupStrategy = group.suggested_strategy || 'leave_as_is';
          const isExpanded = !!expandedGroups[group.group_id];

          return (
            <div 
              key={idx} 
              className={`bg-white rounded-2xl border transition-all shadow-sm overflow-hidden ${
                isBlocking ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Title & Metadata */}
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      isBlocking 
                        ? 'bg-rose-100 text-rose-700' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isBlocking ? 'Blocking Format Conflict' : 'Needs Judgment'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Impact Score: {group.impact_score}
                    </span>
                  </div>
                  
                  <h4 className="font-bold text-slate-800 text-base">
                    {group.title}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {group.description}
                  </p>
                </div>

                {/* Right: Bulk Strategy Selector */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {!isBlocking ? (
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                      <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                        Apply to all ({group.columns_affected.length}):
                      </span>
                      <select
                        value={currentGroupStrategy}
                        onChange={e => updateGroupStrategy(group, e.target.value)}
                        className="p-1 bg-transparent text-xs font-semibold text-violet-700 focus:outline-none cursor-pointer"
                      >
                        {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-xl bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      Manual check recommended
                    </div>
                  )}

                  <button
                    onClick={() => toggleGroupExpanded(group.group_id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  >
                    <span>Review individually ({group.columns_affected.length})</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expandable Per-Column Override Sub-Table */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/70 p-4 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="text-[11px] uppercase font-semibold text-slate-400 border-b border-slate-200">
                      <tr>
                        <th className="pb-2">Column Name</th>
                        <th className="pb-2">Sample Values</th>
                        <th className="pb-2">AI Reason</th>
                        <th className="pb-2">Override Strategy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.column_details.map((col, colIdx) => {
                        const configObj = configs.find(c => c.column_name === col.column_name && c.issue_type === group.issue_type) || {};
                        return (
                          <tr key={colIdx} className="hover:bg-white/50">
                            <td className="py-2.5 font-semibold text-slate-700">
                              {col.column_name}
                            </td>
                            <td className="py-2.5 font-mono text-slate-500 max-w-[200px] truncate">
                              {col.sample_values?.join(', ') || '-'}
                            </td>
                            <td className="py-2.5 text-slate-500 italic">
                              "{col.reason || 'Optimal default strategy'}"
                            </td>
                            <td className="py-2.5">
                              <select
                                value={configObj.strategy || 'leave_as_is'}
                                onChange={e => updateColumnConfig(col.column_name, group.issue_type, 'strategy', e.target.value)}
                                className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-violet-500 cursor-pointer"
                              >
                                {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Show More Minor Issues Button */}
        {hiddenGroupCount > 0 && (
          <button
            onClick={() => setShowAllGroups(!showAllGroups)}
            className="w-full py-3 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            {showAllGroups ? (
              <>
                <span>Show top high-impact groups only</span>
                <ChevronUp size={14} />
              </>
            ) : (
              <>
                <span>{hiddenGroupCount} more minor issue group{hiddenGroupCount !== 1 ? 's' : ''} — show all</span>
                <ChevronDown size={14} />
              </>
            )}
          </button>
        )}
      </div>

      {/* 3. Action Bar */}
      <div className="flex items-center justify-between pt-2">
        <button 
          onClick={handleSkip} 
          disabled={processing}
          className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        >
          Skip Cleaning
        </button>
        <button 
          onClick={handleApplyClick} 
          disabled={processing}
          className="uiverse-btn inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer px-6 py-2.5"
        >
          {processing ? <Loader2 size={16} className="animate-spin"/> : null}
          Apply Cleaning & Render
          <ArrowRight size={16} />
        </button>
      </div>

      {/* 4. Save-as-Template Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4 animate-show-panel">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                <Bookmark size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-base">Save as Reusable Template?</h4>
                <p className="text-xs text-slate-500">Auto-clean future uploads with the same report format.</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g. Sales Export CSV"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => handleApplyRaw(configs)}
                disabled={processing}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                No Thanks, Just Continue
              </button>
              <button
                onClick={handleSaveTemplateAndContinue}
                disabled={processing}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-md"
              >
                {processing ? 'Saving & Applying...' : 'Save Template & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
