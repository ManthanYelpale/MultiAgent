import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthCard from "./pages/AuthCard";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Files from "./pages/Files";
import Analytics from "./pages/Analytics";
import Account from "./pages/Account";
import Preferences from "./pages/Preferences";
import Navbar from "./components/Navbar";

// Protected Route wrapper component
function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Layout wrapper to conditionally show Navbar on non-auth pages
function AppLayout() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <div className="min-h-screen flex flex-col text-slate-900 bg-[#fafafa]">
      {/* Conditionally render navbar */}
      {!isAuthPage && <Navbar />}

      <main className={`flex-grow ${isAuthPage ? "flex flex-col justify-center items-center px-4 py-8" : ""}`}>
        <Routes>
          <Route path="/login" element={<AuthCard />} />
          <Route path="/signup" element={<AuthCard />} />

          {/* Protected Application Routes */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/files"
            element={
              <ProtectedRoute>
                <Files />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route
            path="/preferences"
            element={
              <ProtectedRoute>
                <Preferences />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </Router>
  );
}
