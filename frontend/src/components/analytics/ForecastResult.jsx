import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// Replaces a raw JSON.stringify dump with an actual chart of history vs forecast.
export default function ForecastResult({ forecast }) {
  if (!forecast) return null;

  const history = (forecast.historical || []).map((h, i) => ({
    label: h.date || h.period || `#${i + 1}`,
    actual: h.value,
  }));
  const projected = (forecast.forecast || []).map((f) => ({
    label: f.period_label,
    forecast: f.forecast_value,
  }));
  const data = [...history, ...projected];

  return (
    <div className="pt-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">
        Forecast — {forecast.target_column}
        <span className="ml-2 text-xs font-normal text-slate-400">{forecast.method}</span>
      </h3>
      <div className="bg-white border border-slate-200 rounded-2xl p-4" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
