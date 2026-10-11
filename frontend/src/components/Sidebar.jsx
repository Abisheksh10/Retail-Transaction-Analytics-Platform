import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Database,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';

export default function Sidebar({
  isMobileOpen,
  setIsMobileOpen,
  currentUser,
  user,
  onLogout,
}) {
  const location = useLocation();
  const activeUser = currentUser || user;
  const isAdmin = activeUser?.role === 'admin';

  const navItems = [
    { path: '/overview', label: 'Overview & KPIs', icon: LayoutDashboard },
    { path: '/analytics', label: 'Deep-Dive Analytics', icon: TrendingUp },
    { path: '/catalog', label: 'Product Catalog', icon: Package },
    { path: '/pipeline', label: 'ETL & Pipeline Center', icon: Database },
  ];

  if (isAdmin) {
    navItems.push({ path: '/admin/users', label: 'User Governance', icon: ShieldCheck });
  }

  const isItemActive = (path) => {
    const currentPath = location.pathname.replace(/\/$/, '') || '/';
    if (path === '/overview') {
      return currentPath === '/' || currentPath === '/overview';
    }
    return currentPath === path;
  };

  const handleLinkClick = () => {
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col justify-between border-r border-slate-800 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out md:static md:w-64 md:flex-shrink-0 md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Header & Navigation */}
        <div>
          {/* Brand Logo Header */}
          <div className="flex h-16 items-center justify-between border-b border-slate-800 px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 shadow-md shadow-indigo-950/50">
                <LayoutDashboard className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white">Retail Analytics</h1>
              </div>
            </div>

            {/* Close Button on Mobile Drawer */}
            <button
              onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 md:hidden transition"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="p-4 space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-3 py-2">
              Workspace
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleLinkClick}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs transition-colors group ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Pinned User Profile Footer */}
        <div className="border-t border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400 shrink-0">
                {activeUser?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 truncate" title={activeUser?.email}>
                  {activeUser?.email}
                </p>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                      isAdmin
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {activeUser?.role || 'user'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md p-1.5 transition-colors shrink-0"
              aria-label="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
