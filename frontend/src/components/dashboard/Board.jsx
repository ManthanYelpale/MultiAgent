import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { GridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Loader2, Plus, X, Download, FileText, Presentation } from 'lucide-react';
import Chart from './Chart';
import Review from './Review';
import { apiFetch, downloadProtectedFile, pollJob } from '../../lib/api';

// react-grid-layout v2 dropped WidthProvider, so measure the container ourselves with a
// ResizeObserver and feed the width to GridLayout — instead of the old hardcoded 900px
// that broke on every other viewport.
function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const el = ref.current;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export default function Board({ fileId, columnsPreview }) {
  const [gridRef, gridWidth] = useContainerWidth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cleaningStatus, setCleaningStatus] = useState(null); // 'pending', 'skipped', 'applied'
  
  const [showModal, setShowModal] = useState(false);
  const [newChart, setNewChart] = useState({ chart_type: 'bar', x_column: '', y_column: '', agg_function: 'sum' });

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportConfig, setExportConfig] = useState({ format: 'both', sections: ['kpis', 'charts', 'insights', 'forecast'] });
  const [exporting, setExporting] = useState(false);
  const [downloadLinks, setDownloadLinks] = useState({ pdf: null, pptx: null });
  const [exportError, setExportError] = useState(null);

  let columns = [];
  try { if (columnsPreview) columns = JSON.parse(columnsPreview).columns || []; } catch(e){}

  const layoutSaveTimer = useRef(null);

  const fetchDashboard = async () => {
    try {
      const { status } = await apiFetch(`/cleaning/file/${fileId}/status`);
      setCleaningStatus(status);
      if (status === 'pending') {
        setLoading(false);
        return; // Stop here, render Review
      }
      const data = await apiFetch(`/dashboards/file/${fileId}`);
      setDashboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Persist layout changes, debounced: a drag/resize fires many events, and firing one
  // PUT per chart per event flooded the API and could leave the DB inconsistent.
  const onLayoutChange = (layout) => {
    if (!dashboard || layout.length === 0) return;
    if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
    layoutSaveTimer.current = setTimeout(() => {
      Promise.all(
        layout.map((l) =>
          apiFetch(`/dashboards/charts/${l.i}/layout`, {
            method: 'PUT',
            body: { layout: { x: l.x, y: l.y, w: l.w, h: l.h } },
          }).catch((e) => console.error(e))
        )
      );
    }, 600);
  };

  useEffect(() => () => layoutSaveTimer.current && clearTimeout(layoutSaveTimer.current), []);

  const deleteChart = async (id) => {
    if (!window.confirm('Remove this chart from the dashboard?')) return;
    try {
      await apiFetch(`/dashboards/charts/${id}`, { method: 'DELETE' });
      setDashboard(prev => ({...prev, charts: prev.charts.filter(c => c.id !== id)}));
    } catch (e) { console.error(e); }
  };

  const addChart = async () => {
    try {
      const isKpi = newChart.chart_type === 'kpi';
      const layoutObj = { x: 0, y: 999, w: isKpi ? 3 : 4, h: isKpi ? 2 : 4 };
      await apiFetch(`/dashboards/file/${fileId}/charts`, {
        method: 'POST',
        body: { ...newChart, layout: layoutObj },
      });
      setShowModal(false);
      fetchDashboard();
    } catch (e) { console.error(e); }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setDownloadLinks({ pdf: null, pptx: null });
    try {
      // Report generation is now a background job: enqueue, then poll until it finishes,
      // so a slow report never holds a request open (or times out the browser).
      const { job_id } = await apiFetch(`/reports/generate`, {
        method: 'POST',
        body: { file_id: fileId, format: exportConfig.format, sections: exportConfig.sections },
      });
      const data = await pollJob(`/reports/jobs/${job_id}`);
      setDownloadLinks({
        pdf: data.pdf_download_url,
        pptx: data.pptx_download_url,
        pdfName: data.pdf_filename,
        pptxName: data.pptx_filename,
      });
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = async (url, filename) => {
    try {
      await downloadProtectedFile(url, filename);
    } catch (e) {
      setExportError(e.message);
    }
  };

  const toggleSection = (section) => {
    setExportConfig(prev => {
      const sections = prev.sections.includes(section)
        ? prev.sections.filter(s => s !== section)
        : [...prev.sections, section];
      return { ...prev, sections };
    });
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
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowExportModal(true)} 
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download size={16} /> Export Report
          </button>
          <button onClick={() => setShowModal(true)} className="uiverse-btn inline-flex items-center gap-2">
            <Plus size={16}/> Add Chart
          </button>
        </div>
      </div>

      <div className="min-h-[500px] pt-4" ref={gridRef}>
        {dashboard.charts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
            <p>No charts in this dashboard yet.</p>
          </div>
        ) : gridWidth === 0 ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-600" /></div>
        ) : (
          <GridLayout
            className="layout"
            layout={layout}
            cols={gridWidth < 640 ? 4 : gridWidth < 1024 ? 6 : 12}
            rowHeight={60}
            width={gridWidth}
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

      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="flex flex-col bg-white rounded-3xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setShowExportModal(false); setDownloadLinks({pdf: null, pptx: null}); }}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="px-6 py-8 sm:p-10 sm:pb-6">
              <div className="grid items-center justify-center w-full grid-cols-1 text-left">
                <div>
                  <h2 className="text-lg font-medium tracking-tighter text-gray-600 lg:text-3xl">
                    Export Report
                  </h2>
                  <p className="mt-2 text-sm text-gray-500">Generate a polished executive summary.</p>
                </div>
                
                <div className="mt-6 space-y-6">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-2">Sections to Include</label>
                    <div className="space-y-2">
                      {[
                        { id: 'kpis', label: 'Key Performance Indicators' },
                        { id: 'insights', label: 'AI Executive Insights' },
                        { id: 'charts', label: 'Dashboard Visualizations' },
                        { id: 'forecast', label: 'Metric Projections (Forecast)' }
                      ].map(sec => (
                        <label key={sec.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={exportConfig.sections.includes(sec.id)}
                            onChange={() => toggleSection(sec.id)}
                            className="w-4 h-4 text-violet-600 bg-gray-100 border-gray-300 rounded focus:ring-violet-500"
                          />
                          <span className="text-sm font-medium text-slate-700">{sec.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-2">Export Format</label>
                    <select 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all cursor-pointer"
                      value={exportConfig.format} 
                      onChange={e => setExportConfig({...exportConfig, format: e.target.value})}
                    >
                      <option value="both">Both (PDF & PPTX)</option>
                      <option value="pdf">PDF Document</option>
                      <option value="pptx">PowerPoint Presentation</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 px-6 pb-8 sm:px-10">
              {exportError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                  {exportError}
                </div>
              )}
              {downloadLinks.pdf || downloadLinks.pptx ? (
                <div className="flex gap-2">
                  {downloadLinks.pdf && (
                    <button type="button" onClick={() => handleDownload(downloadLinks.pdf, downloadLinks.pdfName)} className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 text-center text-white bg-rose-600 hover:bg-rose-700 rounded-full font-semibold shadow-md transition-colors cursor-pointer">
                      <FileText size={18} /> PDF
                    </button>
                  )}
                  {downloadLinks.pptx && (
                    <button type="button" onClick={() => handleDownload(downloadLinks.pptx, downloadLinks.pptxName)} className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 text-center text-white bg-orange-600 hover:bg-orange-700 rounded-full font-semibold shadow-md transition-colors cursor-pointer">
                      <Presentation size={18} /> PPTX
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleExport}
                  disabled={exporting || exportConfig.sections.length === 0}
                  className="flex items-center justify-center w-full px-6 py-3.5 text-center text-white duration-200 bg-black border-2 border-black rounded-full hover:bg-transparent hover:text-black focus:outline-none focus-visible:outline-black text-sm font-semibold focus-visible:ring-black cursor-pointer shadow-md hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</> : "Generate Document"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
