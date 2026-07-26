import React, { useState } from "react";
import { Bell, Monitor, Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// Notification preferences persist to localStorage so they survive navigation. (There is
// no server-side notification system yet; these are client preferences only.)
const NOTIF_KEY = "notif_prefs";
function loadNotifs() {
  try {
    return { email: true, push: false, ...JSON.parse(localStorage.getItem(NOTIF_KEY) || "{}") };
  } catch {
    return { email: true, push: false };
  }
}

export default function Preferences() {
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(loadNotifs);

  const updateNotif = (patch) => {
    const next = { ...notifications, ...patch };
    setNotifications(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-show-panel">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Preferences</h1>
        <p className="text-gray-500">Customize your workspace and application settings.</p>
      </div>

      <div className="space-y-6">
        {/* Appearance Section */}
        <div className="bg-white border border-gray-200/50 rounded-3xl shadow-sm overflow-hidden p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Monitor size={20} className="text-indigo-500" />
            Appearance
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <button 
              onClick={() => setTheme("light")}
              className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-colors ${
                theme === "light" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Sun size={24} />
              <span className="font-medium">Light</span>
            </button>
            <button 
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-colors ${
                theme === "dark" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Moon size={24} />
              <span className="font-medium">Dark</span>
            </button>
            <button 
              onClick={() => setTheme("system")}
              className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-colors ${
                theme === "system" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Laptop size={24} />
              <span className="font-medium">System</span>
            </button>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-white border border-gray-200/50 rounded-3xl shadow-sm overflow-hidden p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Bell size={20} className="text-orange-500" />
            Notifications
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <div className="font-medium text-gray-900">Email Notifications</div>
                <div className="text-sm text-gray-500">Receive daily summaries and activity alerts.</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={notifications.email}
                  onChange={(e) => updateNotif({ email: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <div className="font-medium text-gray-900">Push Notifications</div>
                <div className="text-sm text-gray-500">Real-time alerts in your browser.</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={notifications.push}
                  onChange={(e) => updateNotif({ push: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
