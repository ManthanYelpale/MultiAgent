import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, User, Settings, Menu, X } from "lucide-react";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <div className="h-[72px] w-full shrink-0" /> {/* Spacer */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between py-3">

        <div className="flex items-center gap-8">
          {/* Brand Logo */}
          <Link to="/home" className="font-extrabold text-xl tracking-tight text-slate-900 group">
            <span>Insyte</span>
          </Link>

          {/* Nav Links (desktop) */}
          <nav className="hidden md:flex items-center gap-2">
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

        {/* Profile Action with Dropdown (desktop) */}
        <div className="hidden md:flex items-center pr-1 relative" ref={dropdownRef}>
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

        {/* Hamburger toggle (mobile only) */}
        <button
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="md:hidden p-2 -mr-1 rounded-lg text-slate-700 hover:bg-gray-100/70 transition-colors cursor-pointer"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        </div>

        {/* Mobile Menu Panel */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200/60 bg-white/95 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <nav className="max-w-7xl mx-auto px-6 py-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive(link.path)
                      ? "bg-gray-900 text-white font-medium"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 font-normal"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Account section */}
            <div className="max-w-7xl mx-auto px-6 pb-4 pt-1 border-t border-gray-100">
              {user && (
                <div className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.full_name || "User"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <Link
                  to="/account"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <User size={16} />
                  My Account
                </Link>
                <Link
                  to="/preferences"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Settings size={16} />
                  Preferences
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
