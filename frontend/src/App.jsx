import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Menu } from 'lucide-react';
import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';
import OverviewView from './views/OverviewView';
import AnalyticsView from './views/AnalyticsView';
import CatalogView from './views/CatalogView';
import PipelineCenterView from './views/PipelineCenterView';
import UserApprovalsView from './views/UserApprovalsView';
import api from './api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for automatic logout events triggered by api.js on 401
    const handleLogoutEvent = () => {
      setCurrentUser(null);
    };
    window.addEventListener('auth:logout', handleLogoutEvent);

    // Validate active token with /api/auth/me if logged in
    const token = localStorage.getItem('token');
    if (token) {
      api
        .get('/auth/me')
        .then((res) => {
          const freshUser = { id: res.data.id, email: res.data.email, role: res.data.role };
          localStorage.setItem('user', JSON.stringify(freshUser));
          setCurrentUser(freshUser);
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setCurrentUser(null);
        });
    }

    return () => {
      window.removeEventListener('auth:logout', handleLogoutEvent);
    };
  }, []);

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    if (location.pathname === '/' || location.pathname === '') {
      navigate('/overview');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  const getWorkspaceTitle = (pathname) => {
    if (pathname === '/analytics') return 'Analytics';
    if (pathname === '/catalog') return 'Catalog';
    if (pathname === '/pipeline') return 'Pipeline Center';
    if (pathname.startsWith('/admin')) return 'User Governance';
    return 'Overview';
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      {!currentUser ? (
        <AuthModal onAuthSuccess={handleAuthSuccess} />
      ) : (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
          <Sidebar
            isMobileOpen={isMobileMenuOpen}
            setIsMobileOpen={setIsMobileMenuOpen}
            currentUser={currentUser}
            onLogout={handleLogout}
          />

          <div className="flex flex-1 flex-col h-full overflow-hidden">
            {/* Top bar with Mobile Hamburger toggle */}
            <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <LayoutDashboard className="h-5 w-5 text-indigo-600" />
                <span>RetailPulse</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition"
                aria-label="Toggle Navigation"
              >
                <Menu className="h-6 w-6" />
              </button>
            </header>

            {/* Desktop Top Workspace Bar */}
            <header className="hidden md:flex h-14 items-center justify-between border-b border-slate-200/80 bg-white px-8 shrink-0 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Active Workspace /
                </span>
                <span className="text-sm font-bold text-slate-800 capitalize">
                  {getWorkspaceTitle(location.pathname)}
                </span>
              </div>
            </header>

            {/* Independent Scrollable Content Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-6xl mx-auto">
                <Routes>
                  <Route path="/" element={<OverviewView />} />
                  <Route path="/overview" element={<OverviewView />} />
                  <Route path="/analytics" element={<AnalyticsView />} />
                  <Route path="/catalog" element={<CatalogView user={currentUser} />} />
                  <Route path="/pipeline" element={<PipelineCenterView user={currentUser} />} />
                  <Route
                    path="/admin/users"
                    element={
                      currentUser?.role === 'admin' ? (
                        <UserApprovalsView currentUser={currentUser} />
                      ) : (
                        <Navigate to="/overview" replace />
                      )
                    }
                  />
                  <Route path="*" element={<Navigate to="/overview" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
