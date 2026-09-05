import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  FileUp,
  MapPin,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  Zap,
  Shield
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/advisories/import', label: 'Import Advisory', icon: FileUp },
    { to: '/admin/advisories', label: 'All Advisories', icon: FileText },
    { to: '/admin/areas', label: 'Barangay Database', icon: MapPin }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FAF9F6] font-sans text-stone-900 antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between bg-stone-950 text-white px-4 py-3 border-b border-stone-800 sticky top-0 z-50">
        <Link to="/admin" className="flex items-center gap-2 font-serif font-bold text-base tracking-tight">
          <span className="w-6 h-6 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 fill-current stroke-[2.5]" />
          </span>
          <span>POWERWATCH</span>
          <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.2 rounded bg-stone-800 text-stone-400">
            Admin
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 rounded-lg bg-stone-900 text-stone-300 hover:text-white hover:bg-stone-800 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`${
          isMobileMenuOpen ? 'block fixed inset-y-0 left-0 shadow-2xl' : 'hidden'
        } md:flex flex-col w-64 bg-stone-950 text-stone-300 md:min-h-screen border-r border-stone-800/90 shrink-0 z-50`}
      >
        {/* Brand Header */}
        <div className="hidden md:flex items-center gap-2.5 px-6 py-5 border-b border-stone-800/80">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 fill-current stroke-[2.5]" />
          </div>
          <div>
            <div className="text-sm font-serif font-bold text-white tracking-tight leading-tight flex items-center gap-2">
              <span>POWERWATCH</span>
              <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 border border-stone-700">
                Console
              </span>
            </div>
            <p className="text-[10px] font-mono text-stone-400">Metro Cebu Grid Watch</p>
          </div>
        </div>

        {/* Authorized User Pill */}
        <div className="px-5 py-3.5 bg-stone-900/40 border-b border-stone-800/70 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-amber-400 border border-stone-700 shrink-0">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-mono font-medium text-white truncate">
              {user?.username || 'Administrator'}
            </div>
            <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{user?.role || 'Grid Operator'}</span>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-stone-400">
            Management
          </div>
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-mono transition-all ${
                    isActive
                      ? 'bg-stone-800 text-white font-semibold border-l-2 border-amber-500 shadow-2xs'
                      : 'text-stone-400 hover:bg-stone-900 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-stone-800/80 space-y-1.5">
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-mono text-stone-400 hover:bg-stone-900 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <ArrowUpRight className="w-3.5 h-3.5 text-stone-500" />
              <span>Public Watch</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold uppercase">Live</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-mono text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}