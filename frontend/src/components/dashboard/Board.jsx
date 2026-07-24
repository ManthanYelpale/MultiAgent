import React, { useState, useEffect } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Loader2, Plus, X } from 'lucide-react';
import { useAuth } from "../../context/AuthContext";
import Chart from './Chart';
import Review from './Review';

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

export default function Board({ fileId, columnsPreview }) {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cleaningStatus, setCleaningStatus] = useState(null); // 'pending', 'skipped', 'applied'
  
  const [showModal, setShowModal] = useState(false);
  const [newChart, setNewChart] = useState({ chart_type: 'bar', x_column: '', y_column: '', agg_function: 'sum' });

  let columns = [];
  try { if (columnsPreview) columns = JSON.parse(columnsPreview).columns || []; } catch(e){}

  const fetchDashboard = async () => {
    try {
      // First check cleaning status
      const cleanRes = await fetch(`${API_BASE_URL}/cleaning/file/${fileId}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (cleanRes.ok) {
        const { status } = await cleanRes.json();
        setCleaningStatus(status);
        if (status === 'pending') {
          setLoading(false);
          return; // Stop here, render Review
        }
      }

      const res = await fetch(`${API_BASE_URL}/dashboards/file/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDashboard(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDashboard();
  }, [fileId]);

  const onLayoutChange = async (layout) => {
    if (!dashboard) return;
    if (layout.length === 0) return;
    
    for (const l of layout) {
      fetch(`${API_BASE_URL}/dashboards/charts/${l.i}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ layout: { x: l.x, y: l.y, w: l.w, h: l.h } })
      }).catch(console.error);
    }
  };

  const deleteChart = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/dashboards/charts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboard(prev => ({...prev, charts: prev.charts.filter(c => c.id !== id)}));
    } catch (e) { console.error(e); }
  };

  const addChart = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/dashboards/file/${fileId}/charts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newChart)
      });
      if (res.ok) {
        setShowModal(false);
        fetchDashboard(); 
      }
    } catch(e) { console.error(e); }
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-violet-600" /></div>;
  
  if (cleaningStatus === 'pending') {
    return <Review fileId={fileId} onComplete={fetchDashboard} />;
  }

  if (!dashboard) return <div className="py-12 text-center text-slate-500">Failed to load dashboard</div>;

  const layout = dashboard.charts.map(c => ({
    i: c.id.toString(),
    x: c.layout?.x || 0,
    y: c.layout?.y || 0,
    w: c.layout?.w || 4,
    h: c.layout?.h || 4,
    minW: 2, minH: 2
  }));

  return (
    <div className="space-y-4 animate-show-panel">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="font-semibold text-slate-800">{dashboard.name}</h2>
          <p className="text-xs text-slate-500">{dashboard.charts.length} charts auto-generated</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-violet-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-violet-700">
          <Plus size={14}/> Add Chart
        </button>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 min-h-[500px]">
        {dashboard.charts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
            <p>No charts in this dashboard yet.</p>
          </div>
        ) : (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={60}
            width={900}
            onDragStop={onLayoutChange}
            onResizeStop={onLayoutChange}
            isDraggable={true}
            isResizable={true}
          >
            {dashboard.charts.map(chart => (
              <div key={chart.id.toString()} className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-200 overflow-hidden relative group">
                <button 
                  onClick={() => deleteChart(chart.id)}
                  className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-100 cursor-pointer"
                >
                  <X size={12}/>
                </button>
                <Chart chart={chart} fileId={fileId} />
              </div>
            ))}
          </GridLayout>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-slate-800">Add New Chart</h3>
            
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase">Chart Type</label>
              <select className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500" value={newChart.chart_type} onChange={e => setNewChart({...newChart, chart_type: e.target.value})}>
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="kpi">KPI Card</option>
              </select>
            </div>

            {newChart.chart_type !== 'kpi' && (
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">X-Axis (Group By)</label>
                <select className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500" value={newChart.x_column} onChange={e => setNewChart({...newChart, x_column: e.target.value})}>
                  <option value="">Select column...</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase">Y-Axis (Value)</label>
              <select className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500" value={newChart.y_column} onChange={e => setNewChart({...newChart, y_column: e.target.value})}>
                <option value="">Select column...</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase">Aggregation</label>
              <select className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500" value={newChart.agg_function} onChange={e => setNewChart({...newChart, agg_function: e.target.value})}>
                <option value="sum">Sum</option>
                <option value="mean">Average</option>
                <option value="count">Count</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">Cancel</button>
              <button onClick={addChart} className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors cursor-pointer">Create Chart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
