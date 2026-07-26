import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, User, Settings, Brain } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { path: "/home", label: "Home" },
  { path: "/chat", label: "AI Chat" },
  { path: "/files", label: "Files" },
  { path: "/analytics", label: "Analytics" },
  { path: "/about", label: "About Us" },
];

export default function Nav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="h-[72px] w-full shrink-0" /> {/* Spacer */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between py-3">
        
        <div className="flex items-center gap-8">
          {/* Brand Logo */}
          <Link to="/home" className="flex items-center gap-2.5 font-extrabold text-lg tracking-tight text-slate-900 group">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-sm group-hover:scale-105 transition-transform">
              <Brain size={16} />
            </div>
            <span>Insyte</span>
          </Link>

          {/* Nav Links */}
          <nav className="flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm px-5 py-2.5 rounded-full transition-all duration-300 ${
                  isActive(link.path)
                    ? "bg-gray-900 text-white font-medium"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 font-normal"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Profile Action with Dropdown */}
        <div className="flex items-center pr-1 relative" ref={dropdownRef}>
          <div 
            className="rounded-full p-[1.5px] bg-gradient-to-r from-cyan-400 via-pink-500 to-orange-400 hover:opacity-90 transition-opacity cursor-pointer"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="block rounded-full bg-white px-6 py-2 text-sm font-medium text-gray-900 transition-colors">
              Profile
            </div>
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-3 w-56 pointer-events-auto bg-white/95 backdrop-blur-xl border border-gray-200/50 rounded-2xl shadow-xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200">
              
              {/* User Info Header */}
              {user && (
                <div className="px-4 py-3 border-b border-gray-100 mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.full_name || "User"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                </div>
              )}

              {/* Menu Items */}
              <Link 
                to="/account"
                onClick={() => setIsDropdownOpen(false)} 
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <User size={16} />
                My Account
              </Link>
              
              <Link 
                to="/preferences"
                onClick={() => setIsDropdownOpen(false)} 
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Settings size={16} />
                Preferences
              </Link>

              <div className="h-px bg-gray-100 my-1 mx-2" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          )}
        </div>
        </div>
      </header>
    </>
  );
}
