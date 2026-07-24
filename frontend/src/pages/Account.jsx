import React from "react";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Shield, Key, Bell } from "lucide-react";

export default function Account() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-show-panel">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Account</h1>
        <p className="text-gray-500">Manage your profile and account settings.</p>
      </div>

      <div className="bg-white border border-gray-200/50 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-r from-cyan-400 via-pink-500 to-orange-400 p-[2px]">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <User size={40} className="text-gray-400" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{user?.full_name || "User"}</h2>
            <div className="flex items-center gap-2 text-gray-500 mt-1">
              <Mail size={16} />
              <span>{user?.email || "user@example.com"}</span>
            </div>
          </div>
        </div>

        <div className="p-8 grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User size={20} className="text-blue-500" />
              Personal Info
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  disabled 
                  value={user?.full_name || ""} 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  disabled 
                  value={user?.email || ""} 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 focus:outline-none"
                />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield size={20} className="text-indigo-500" />
              Security
            </h3>
            <div className="space-y-4">
              <button className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left cursor-pointer">
                <div>
                  <div className="font-medium text-gray-900">Change Password</div>
                  <div className="text-sm text-gray-500">Update your account password</div>
                </div>
                <Key size={18} className="text-gray-400" />
              </button>
              
              <button className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left cursor-pointer">
                <div>
                  <div className="font-medium text-gray-900">Notification Settings</div>
                  <div className="text-sm text-gray-500">Manage email preferences</div>
                </div>
                <Bell size={18} className="text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
