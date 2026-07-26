import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#a855f7"];

export default function SegmentationResult({ segmentation }) {
  if (!segmentation) return null;
  const clusters = segmentation.cluster_summary || [];
  const sizeData = clusters.map((c) => ({ name: `Cluster ${c.cluster_id}`, size: c.size }));
  const metricKeys = clusters.length
    ? Object.keys(clusters[0]).filter((k) => k.startsWith("avg_"))
    : [];

  return (
    <div className="pt-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">
        Segmentation — {segmentation.n_clusters} clusters
      </h3>

      <div className="bg-white border border-slate-200 rounded-2xl p-4" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sizeData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="size" radius={[4, 4, 0, 0]}>
              {sizeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-4xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 font-semibold text-slate-700">Cluster</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Size</th>
              {metricKeys.map((k) => (
                <th key={k} className="px-3 py-2 font-semibold text-slate-700">
                  {k.replace("avg_", "Avg ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clusters.map((c) => (
              <tr key={c.cluster_id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-700">Cluster {c.cluster_id}</td>
                <td className="px-3 py-2 text-slate-600">{c.size}</td>
                {metricKeys.map((k) => (
                  <td key={k} className="px-3 py-2 text-slate-600">
                    {Number(c[k]).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
