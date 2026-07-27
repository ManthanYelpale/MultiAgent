import React, { useState, useRef, useEffect } from "react";
import { Table, FileText, File, Sparkles, ChevronDown, Check } from "lucide-react";

// Custom file dropdown: a styled trigger + floating menu with per-file icons and
// row/column metadata, replacing the plain native <select>.

function iconFor(type, size = 15) {
  if (type === "csv" || type === "xlsx") return <Table size={size} className="text-emerald-600" />;
  if (type === "pdf") return <FileText size={size} className="text-rose-500" />;
  return <File size={size} className="text-slate-400" />;
}

export default function FilePicker({ files = [], value = "", onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selected = files.find((f) => String(f.id) === String(value));

  const pick = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`group flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer max-w-[280px] ${
          selected
            ? "border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 text-violet-800 shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
        }`}
      >
        <span className="shrink-0">
          {selected ? iconFor(selected.file_type) : <Sparkles size={15} className="text-violet-500" />}
        </span>
        <span className="truncate">
          {selected ? selected.original_filename : "General chat"}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 max-w-[85vw] z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Chat context
          </div>

          {/* General chat option */}
          <button
            type="button"
            onClick={() => pick("")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
              !value ? "bg-violet-50" : "hover:bg-slate-50"
            }`}
          >
            <span className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-violet-600" />
            </span>
            <span className="flex-grow min-w-0">
              <span className="block text-sm font-medium text-slate-800">General chat</span>
              <span className="block text-xs text-slate-400">No file — general questions</span>
            </span>
            {!value && <Check size={16} className="text-violet-600 shrink-0" />}
          </button>

          {files.length > 0 && <div className="h-px bg-slate-100 mx-3 my-1" />}

          <div className="max-h-64 overflow-y-auto pb-2">
            {files.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400 text-center">
                No files yet. Upload one on the Files page.
              </p>
            ) : (
              files.map((f) => {
                const active = String(f.id) === String(value);
                const meta =
                  f.row_count != null
                    ? `${f.row_count.toLocaleString()} rows · ${f.column_count ?? "?"} cols`
                    : f.file_type?.toUpperCase();
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => pick(String(f.id))}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-violet-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      {iconFor(f.file_type)}
                    </span>
                    <span className="flex-grow min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {f.original_filename}
                      </span>
                      <span className="block text-xs text-slate-400">{meta}</span>
                    </span>
                    {active && <Check size={16} className="text-violet-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
