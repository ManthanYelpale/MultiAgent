import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function TrendResult({ trend }) {
  if (!trend) return null;

  const dir = trend.trend;
  const Icon = dir === "increasing" ? TrendingUp : dir === "decreasing" ? TrendingDown : Minus;
  const color =
    dir === "increasing" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : dir === "decreasing" ? "text-rose-600 bg-rose-50 border-rose-200"
        : "text-slate-600 bg-slate-50 border-slate-200";

  return (
    <div className="pt-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">Trend — {trend.target_column}</h3>
      <div className="grid sm:grid-cols-3 gap-4 max-w-2xl">
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${color}`}>
          <Icon size={28} />
          <div>
            <div className="text-lg font-bold capitalize">{dir}</div>
            <div className="text-xs">{trend.pct_change >= 0 ? "+" : ""}{trend.pct_change.toFixed(1)}%</div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <div className="text-xs text-slate-500">Recent avg</div>
          <div className="text-lg font-bold text-slate-900">{trend.recent_avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
          <div className="text-xs text-slate-500">Prior avg</div>
          <div className="text-lg font-bold text-slate-900">{trend.prior_avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
      </div>
      <p className="text-xs text-slate-400">Window: {trend.window} points</p>
    </div>
  );
}
