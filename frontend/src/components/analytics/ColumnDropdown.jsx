import React from "react";

export default function ColumnDropdown({
  columns = [],
  value = "",
  onChange,
  label,
  placeholder = "Select column...",
  required = false,
  className = "",
  helpText
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-700 block uppercase tracking-wider">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        value={value || ""}
        onChange={(e) => onChange && onChange(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer shadow-sm transition-all"
      >
        <option value="">{placeholder}</option>
        {Array.isArray(columns) &&
          columns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
      </select>
      {helpText && <p className="text-[11px] text-slate-500">{helpText}</p>}
    </div>
  );
}
