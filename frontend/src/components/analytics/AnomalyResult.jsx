import React from "react";

export default function AnomalyResult({ anomalies }) {
  if (!anomalies) return null;
  const rows = anomalies.anomalies || [];
  const columns = rows.length ? Object.keys(rows[0].data || {}) : [];

  return (
    <div className="pt-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">
        Anomalies: <span className="text-rose-600">{anomalies.anomaly_count}</span>{" "}
        <span className="text-slate-400 font-normal">/ {anomalies.total_rows} rows</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No anomalies detected.</p>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-5xl">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 font-semibold text-slate-700">Row</th>
                <th className="px-3 py-2 font-semibold text-slate-700">Score</th>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-2 font-semibold text-slate-700">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-rose-50/40">
                  <td className="px-3 py-2 font-mono text-slate-500">{r.row_index}</td>
                  <td className="px-3 py-2 font-mono text-rose-600">{r.anomaly_score}</td>
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-2 text-slate-600 max-w-[180px] truncate">
                      {String(r.data?.[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
