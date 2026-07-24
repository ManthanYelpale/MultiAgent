import React from "react";

export default function Card({ children, className = "" }) {
  return (
    <div
      className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-8 shadow-[0_10px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl transition-all duration-300 hover:border-slate-300 hover:shadow-[0_15px_50px_rgba(15,23,42,0.08)] ${className}`}
    >
      {/* Soft light-colored glow inside card */}
      <div className="absolute -right-20 -top-20 -z-10 h-40 w-40 rounded-full bg-violet-500/5 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 -z-10 h-40 w-40 rounded-full bg-pink-500/5 blur-3xl" />
      
      {children}
    </div>
  );
}
