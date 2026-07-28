import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Shield, Key, Bell, Lock, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { apiFetch } from "../lib/api";

const MIN_PASSWORD_LENGTH = 8;

function ChangePasswordModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
    setApiError("");
  };

  const validate = () => {
    const next = {};
    if (!form.current) next.current = "Current password is required";
    if (!form.next) next.next = "New password is required";
    else if (form.next.length < MIN_PASSWORD_LENGTH) next.next = `Min ${MIN_PASSWORD_LENGTH} characters required`;
    else if (form.next.trim() !== form.next) next.next = "Password must not begin or end with whitespace";
    else if (form.next === form.current) next.next = "New password must differ from the current one";
    if (form.confirm !== form.next) next.confirm = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError("");
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: { current_password: form.current, new_password: form.next },
      });
      setSuccess(true);
      // Changing the password invalidates the current session token server-side, so sign
      // the user out and send them to login to re-authenticate with the new password.
      setTimeout(onSuccess, 1800);
    } catch (err) {
      setApiError(err.message || "Could not change password. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="px-6 py-8 sm:p-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
              <p className="text-xs text-gray-500">Update your account password.</p>
            </div>
          </div>

          {success ? (
            <div className="flex flex-col items-center justify-center text-center py-6 space-y-3">
              <div className="h-14 w-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 size={30} />
              </div>
              <p className="text-sm font-semibold text-gray-900">Password updated successfully</p>
              <p className="text-xs text-gray-500">Signing you out — please sign in again with your new password.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {apiError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              {[
                { name: "current", label: "Current Password", placeholder: "Enter current password" },
                { name: "next", label: "New Password", placeholder: "Enter new password" },
                { name: "confirm", label: "Confirm New Password", placeholder: "Re-enter new password" },
              ].map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3 text-gray-400" />
                    <input
                      type="password"
                      name={field.name}
                      value={form[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      autoComplete={field.name === "current" ? "current-password" : "new-password"}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                    />
                  </div>
                  {errors[field.name] && (
                    <p className="text-[11px] text-red-500 mt-1 ml-1">{errors[field.name]}</p>
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 text-white bg-black border-2 border-black rounded-full hover:bg-transparent hover:text-black transition-all duration-200 text-sm font-semibold cursor-pointer shadow-md hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Update Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

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
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left cursor-pointer"
              >
                <div>
                  <div className="font-medium text-gray-900">Change Password</div>
                  <div className="text-sm text-gray-500">Update your account password</div>
                </div>
                <Key size={18} className="text-gray-400" />
              </button>

              <button
                onClick={() => navigate("/preferences")}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left cursor-pointer"
              >
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

      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
            setShowPasswordModal(false);
            logout();
          }}
        />
      )}
    </div>
  );
}
