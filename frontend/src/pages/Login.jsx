import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, User, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, signup, user, token, loading: authLoading, sessionExpired } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Active state for right panel sliding (true = signup active, false = login active)
  const [isRightPanelActive, setIsRightPanelActive] = useState(
    location.pathname === "/signup"
  );

  // Sync state if URL changes
  useEffect(() => {
    setIsRightPanelActive(location.pathname === "/signup");
  }, [location.pathname]);

  // Login state
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [loginErrors, setLoginErrors] = useState({});
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [loginApiError, setLoginApiError] = useState("");

  // Signup state
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [signupErrors, setSignupErrors] = useState({});
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupApiError, setSignupApiError] = useState("");

  // Redirect to home if logged in
  useEffect(() => {
    if (user || token) {
      navigate("/home");
    }
  }, [user, token, navigate]);

  // Login handlers
  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
    if (loginErrors[name]) setLoginErrors((prev) => ({ ...prev, [name]: "" }));
    setLoginApiError("");
  };

  const validateLogin = () => {
    const tempErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!loginData.email) tempErrors.email = "Email is required";
    else if (!emailRegex.test(loginData.email)) tempErrors.email = "Invalid email address";

    if (!loginData.password) tempErrors.password = "Password is required";

    setLoginErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!validateLogin()) return;

    setIsLoginSubmitting(true);
    setLoginApiError("");

    const result = await login(loginData.email, loginData.password);
    if (result.success) {
      navigate("/home");
    } else {
      setLoginApiError(result.error || "Incorrect email or password");
    }
    setIsLoginSubmitting(false);
  };

  // Signup handlers
  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
    if (signupErrors[name]) setSignupErrors((prev) => ({ ...prev, [name]: "" }));
    setSignupApiError("");
  };

  const validateSignup = () => {
    const tempErrors = {};
    if (!signupData.fullName.trim()) tempErrors.fullName = "Full name is required";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!signupData.email) tempErrors.email = "Email is required";
    else if (!emailRegex.test(signupData.email)) tempErrors.email = "Invalid email address";

    if (!signupData.password) tempErrors.password = "Password is required";
    else if (signupData.password.length < 8) tempErrors.password = "Min 8 characters required";

    if (signupData.password !== signupData.confirmPassword) {
      tempErrors.confirmPassword = "Passwords do not match";
    }

    setSignupErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!validateSignup()) return;

    setIsSignupSubmitting(true);
    setSignupApiError("");

    const result = await signup(signupData.email, signupData.password, signupData.fullName);

    if (result.success) {
      setSignupSuccess(true);
      setTimeout(() => {
        setSignupSuccess(false);
        setIsRightPanelActive(false);
        navigate("/login");
      }, 2500);
    } else {
      setSignupApiError(result.error || "Signup failed. Try again.");
    }
    setIsSignupSubmitting(false);
  };

  const togglePanel = (toSignup) => {
    setIsRightPanelActive(toSignup);
    navigate(toSignup ? "/signup" : "/login");
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 text-violet-600 animate-spin" />
        <p className="mt-4 text-sm text-slate-500 font-medium">Loading session...</p>
      </div>
    );
  }


  return (
    <div className="w-full flex justify-center items-center py-6 px-4">
      {/* Sliding Double Container */}
      <div
        className={`relative bg-white rounded-2xl shadow-[0_14px_28px_rgba(0,0,0,0.18),0_10px_10px_rgba(0,0,0,0.12)] overflow-hidden w-[1000px] max-w-full min-h-[580px] transition-all duration-600`}
      >
        {/* Sign Up Container (Left side when active) */}
        <div
          className={`absolute top-0 h-full transition-all duration-600 ease-in-out left-0 w-1/2 ${
            isRightPanelActive
              ? "translate-x-full opacity-100 z-5 animate-show-panel"
              : "opacity-0 z-1 pointer-events-none"
          }`}
        >
          {signupSuccess ? (
            <div className="flex flex-col items-center justify-center h-full px-10 text-center">
              <div className="h-14 w-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Account Created!</h2>
              <p className="text-slate-500 text-xs leading-relaxed max-w-xs mb-4">
                Welcome, <span className="font-semibold text-slate-800">{signupData.fullName}</span>. Redirecting to login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignupSubmit} className="bg-white flex flex-col items-center justify-center px-10 sm:px-14 h-full text-center">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-1">Create Account</h1>
              <p className="text-xs text-slate-400 mb-5">Use your email for registration</p>

              {signupApiError && (
                <div className="w-full mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium text-left">
                  {signupApiError}
                </div>
              )}

              <div className="w-full space-y-3">
                <div>
                  <div className="relative">
                    <User size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      name="fullName"
                      placeholder="Full Name"
                      value={signupData.fullName}
                      onChange={handleSignupChange}
                      className="w-full bg-slate-100 border-0 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  {signupErrors.fullName && <p className="text-[11px] text-red-500 text-left mt-1 ml-1">{signupErrors.fullName}</p>}
                </div>

                <div>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      value={signupData.email}
                      onChange={handleSignupChange}
                      className="w-full bg-slate-100 border-0 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  {signupErrors.email && <p className="text-[11px] text-red-500 text-left mt-1 ml-1">{signupErrors.email}</p>}
                </div>

                <div>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      value={signupData.password}
                      onChange={handleSignupChange}
                      className="w-full bg-slate-100 border-0 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  {signupErrors.password && <p className="text-[11px] text-red-500 text-left mt-1 ml-1">{signupErrors.password}</p>}
                </div>

                <div>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="password"
                      name="confirmPassword"
                      placeholder="Confirm Password"
                      value={signupData.confirmPassword}
                      onChange={handleSignupChange}
                      className="w-full bg-slate-100 border-0 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  {signupErrors.confirmPassword && <p className="text-[11px] text-red-500 text-left mt-1 ml-1">{signupErrors.confirmPassword}</p>}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSignupSubmitting}
                className="mt-6 rounded-full border border-[#FF4B2B] bg-[#FF4B2B] text-white text-xs font-bold py-3.5 px-12 tracking-widest uppercase transition-transform duration-80 active:scale-95 hover:bg-[#ff3b19] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg"
              >
                {isSignupSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Sign Up"}
              </button>
            </form>
          )}
        </div>

        {/* Sign In Container */}
        <div
          className={`absolute top-0 h-full transition-all duration-600 ease-in-out left-0 w-1/2 z-2 ${
            isRightPanelActive ? "translate-x-full opacity-0 pointer-events-none" : ""
          }`}
        >
          <form onSubmit={handleLoginSubmit} className="bg-white flex flex-col items-center justify-center px-10 sm:px-14 h-full text-center">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-1">Sign In</h1>
            <p className="text-xs text-slate-400 mb-6">Enter your account credentials</p>

            {sessionExpired && !loginApiError && (
              <div className="w-full mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium text-left">
                Your session expired. Please sign in again.
              </div>
            )}

            {loginApiError && (
              <div className="w-full mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium text-left flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{loginApiError}</span>
              </div>
            )}

            <div className="w-full space-y-4">
              <div>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={loginData.email}
                    onChange={handleLoginChange}
                    className="w-full bg-slate-100 border-0 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
                {loginErrors.email && <p className="text-[11px] text-red-500 text-left mt-1 ml-1">{loginErrors.email}</p>}
              </div>

              <div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={loginData.password}
                    onChange={handleLoginChange}
                    className="w-full bg-slate-100 border-0 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
                {loginErrors.password && <p className="text-[11px] text-red-500 text-left mt-1 ml-1">{loginErrors.password}</p>}
              </div>
            </div>

            <button type="button" className="text-xs text-slate-500 hover:text-slate-800 my-4 focus:outline-none font-medium">
              Forgot your password?
            </button>

            <button
              type="submit"
              disabled={isLoginSubmitting}
              className="rounded-full border border-[#FF4B2B] bg-[#FF4B2B] text-white text-xs font-bold py-3.5 px-12 tracking-widest uppercase transition-transform duration-80 active:scale-95 hover:bg-[#ff3b19] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg"
            >
              {isLoginSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Sign In"}
            </button>
          </form>
        </div>

        {/* Overlay Container (Sliding Cover) */}
        <div
          className={`absolute top-0 left-1/2 w-1/2 h-full overflow-hidden transition-transform duration-600 ease-in-out z-50 ${
            isRightPanelActive ? "-translate-x-full" : ""
          }`}
        >
          {/* Overlay Background */}
          <div
            className={`bg-gradient-to-r from-[#FF4B2B] to-[#FF416C] text-white relative -left-full h-full w-[200%] transition-transform duration-600 ease-in-out ${
              isRightPanelActive ? "translate-x-1/2" : "translate-x-0"
            }`}
          >
            {/* Left Overlay Panel (Visible when right panel active / signup) */}
            <div
              className={`absolute top-0 flex flex-col items-center justify-center px-12 text-center h-full w-1/2 transition-transform duration-600 ease-in-out ${
                isRightPanelActive ? "translate-x-0" : "-translate-x-[20%]"
              }`}
            >
              <h1 className="text-3xl font-extrabold mb-3">Welcome Back!</h1>
              <p className="text-xs font-light tracking-wide leading-relaxed mb-8 max-w-xs text-slate-100">
                To keep connected with us please login with your personal info
              </p>
              <button
                type="button"
                onClick={() => togglePanel(false)}
                className="rounded-full border-2 border-white bg-transparent text-white text-xs font-bold py-3.5 px-12 tracking-widest uppercase transition-all duration-150 active:scale-95 hover:bg-white hover:text-[#FF4B2B] cursor-pointer shadow-sm"
              >
                Sign In
              </button>
            </div>

            {/* Right Overlay Panel (Visible when left panel active / login) */}
            <div
              className={`absolute top-0 right-0 flex flex-col items-center justify-center px-12 text-center h-full w-1/2 transition-transform duration-600 ease-in-out ${
                isRightPanelActive ? "translate-x-[20%]" : "translate-x-0"
              }`}
            >
              <h1 className="text-3xl font-extrabold mb-3">Hello, Friend!</h1>
              <p className="text-xs font-light tracking-wide leading-relaxed mb-8 max-w-xs text-slate-100">
                Enter your personal details and start your journey with us
              </p>
              <button
                type="button"
                onClick={() => togglePanel(true)}
                className="rounded-full border-2 border-white bg-transparent text-white text-xs font-bold py-3.5 px-12 tracking-widest uppercase transition-all duration-150 active:scale-95 hover:bg-white hover:text-[#FF4B2B] cursor-pointer shadow-sm"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
