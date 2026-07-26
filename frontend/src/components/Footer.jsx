import React from "react";
import { Link } from "react-router-dom";
import {
  Brain,
  ExternalLink,
  Coffee,
} from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-[#09090b] text-slate-400 border-t border-slate-800/60 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs">
        
        {/* Left Side: Brand & Copyright */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 text-white">
            <Brain size={12} />
          </div>
          <span>&copy; {currentYear} Insyte. All rights reserved.</span>
        </div>

        {/* Center/Right: Navigation & Connect Links */}
        <nav className="flex flex-wrap items-center justify-center gap-6 font-medium text-slate-300">
          <Link to="/home" className="hover:text-white transition-colors">
            Home
          </Link>
          <Link to="/analytics" className="hover:text-white transition-colors">
            Analytics
          </Link>
          <Link to="/chat" className="hover:text-white transition-colors">
            AI Chat
          </Link>
          <Link to="/files" className="hover:text-white transition-colors">
            Files
          </Link>
          <Link to="/about" className="hover:text-white transition-colors">
            About Us
          </Link>

          <span className="text-slate-700 hidden sm:inline">|</span>

          <a
            href="https://github.com/ManthanYelpale"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors inline-flex items-center gap-1"
          >
            <span>GitHub</span>
            <ExternalLink size={10} />
          </a>
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors inline-flex items-center gap-1"
          >
            <span>LinkedIn</span>
            <ExternalLink size={10} />
          </a>
          <a
            href="https://buymeacoffee.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 transition-all font-medium"
          >
            <Coffee size={12} className="text-amber-400" />
            <span>Get me a coffee</span>
          </a>
        </nav>

      </div>
    </footer>
  );
}
