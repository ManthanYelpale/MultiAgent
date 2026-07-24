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
      <div className="flex justify-between items-center py-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{dashboard.name}</h2>
          <p className="text-sm text-slate-500">{dashboard.charts.length} charts auto-generated</p>
        </div>
        <button onClick={() => setShowModal(true)} className="uiverse-btn inline-flex items-center gap-2">
          <Plus size={16}/> Add Chart
        </button>
      </div>

      <div className="min-h-[500px] pt-4">
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
              <div key={chart.id.toString()} className="bg-white rounded-xl ring-1 ring-slate-200/50 shadow-sm hover:shadow-md hover:ring-violet-200/50 transition-all overflow-hidden relative group">
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
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="flex flex-col bg-white rounded-3xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="px-6 py-8 sm:p-10 sm:pb-6">
              <div className="grid items-center justify-center w-full grid-cols-1 text-left">
                <div>
                  <h2 className="text-lg font-medium tracking-tighter text-gray-600 lg:text-3xl">
                    Add Chart
                  </h2>
                  <p className="mt-2 text-sm text-gray-500">Configure your new visualization.</p>
                </div>
                
                <div className="mt-8 space-y-5">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Chart Type</label>
                    <select className="w-full mt-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all cursor-pointer" value={newChart.chart_type} onChange={e => setNewChart({...newChart, chart_type: e.target.value})}>
                      <option value="bar">Bar Chart</option>
                      <option value="line">Line Chart</option>
                      <option value="pie">Pie Chart</option>
                      <option value="kpi">KPI Card</option>
                    </select>
                  </div>

                  {newChart.chart_type !== 'kpi' && (
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">X-Axis (Group By)</label>
                      <select className="w-full mt-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all cursor-pointer" value={newChart.x_column} onChange={e => setNewChart({...newChart, x_column: e.target.value})}>
                        <option value="">Select column...</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Y-Axis (Value)</label>
                    <select className="w-full mt-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all cursor-pointer" value={newChart.y_column} onChange={e => setNewChart({...newChart, y_column: e.target.value})}>
                      <option value="">Select column...</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Aggregation</label>
                    <select className="w-full mt-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all cursor-pointer" value={newChart.agg_function} onChange={e => setNewChart({...newChart, agg_function: e.target.value})}>
                      <option value="sum">Sum</option>
                      <option value="mean">Average</option>
                      <option value="count">Count</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex px-6 pb-8 sm:px-10">
              <button
                onClick={addChart}
                className="flex items-center justify-center w-full px-6 py-3.5 text-center text-white duration-200 bg-black border-2 border-black rounded-full hover:bg-transparent hover:text-black focus:outline-none focus-visible:outline-black text-sm font-semibold focus-visible:ring-black cursor-pointer shadow-md hover:shadow-none"
              >
                Create chart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
