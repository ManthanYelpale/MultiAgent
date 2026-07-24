import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter
} from 'recharts';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";
const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function ChartRenderer({ chart, fileId }) {
  const { token } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      let fetchedJson = null;
      try {
        const res = await fetch(`${API_BASE_URL}/dashboards/charts/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            file_id: fileId,
            chart_type: chart.chart_type,
            x_column: chart.x_column,
            y_column: chart.y_column,
            agg_function: chart.agg_function
          })
        });
        if (!res.ok) throw new Error('Failed to load chart data');
        fetchedJson = await res.json();
        setData(fetchedJson);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }

      // Fetch AI Insight for KPIs asynchronously
      if (fetchedJson && chart.chart_type === 'kpi' && fetchedJson.value !== undefined) {
        setInsightLoading(true);
        try {
          const insRes = await fetch(`${API_BASE_URL}/ai/insights`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              metric_name: chart.y_column,
              metric_value: String(fetchedJson.value),
              agg_function: chart.agg_function,
              dataset_name: "Uploaded Dataset"
            })
          });
          if (insRes.ok) {
            const insJson = await insRes.json();
            setInsight(insJson.insight);
          }
        } catch(e) { console.error("Insight error", e); }
        finally { setInsightLoading(false); }
      }
    };
    fetchData();
  }, [chart, fileId, token]);

  if (loading) return <div className="flex h-full w-full items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;
  if (error) return <div className="flex h-full w-full items-center justify-center text-xs text-red-500"><AlertCircle size={14} className="mr-1"/> Error</div>;

  if (chart.chart_type === 'kpi') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{chart.agg_function} of {chart.y_column}</p>
        <p className="text-3xl font-bold text-slate-800 mt-1">
          {typeof data.value === 'number' ? data.value.toLocaleString() : data.value}
        </p>
        <div className="mt-2 min-h-[40px] flex items-center justify-center">
          {insightLoading ? (
            <span className="text-[10px] text-slate-400 animate-pulse">Generating insight...</span>
          ) : insight ? (
            <span className="text-[10px] text-slate-500 italic">✨ {insight}</span>
          ) : null}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No data to display</div>;
  }

  return (
    <div className="w-full h-full pt-4 pb-2 pr-4">
      <h4 className="text-[11px] font-semibold text-slate-500 text-center mb-2 uppercase tracking-wide">
        {chart.chart_type === 'pie' ? `${chart.agg_function} by ${chart.x_column}` : `${chart.y_column} by ${chart.x_column}`}
      </h4>
      <ResponsiveContainer width="100%" height="85%">
        {chart.chart_type === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
            <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
            <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : chart.chart_type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
            <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 0}} activeDot={{r: 6}} />
          </LineChart>
        ) : chart.chart_type === 'pie' ? (
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
            <Legend wrapperStyle={{fontSize: 10}} />
          </PieChart>
        ) : (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="category" dataKey="name" name="category" tick={{fontSize: 10}} />
            <YAxis type="number" dataKey="value" name="value" tick={{fontSize: 10}} />
            <Tooltip cursor={{strokeDasharray: '3 3'}} />
            <Scatter name="Data" data={data} fill="#10b981" />
          </ScatterChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
