import React, { useEffect, useState, useMemo, memo } from 'react';
import { Link, Outlet } from 'react-router-dom';
import {
  Zap,
  ArrowUpRight,
  Radio
} from 'lucide-react';
import { advisoryService, ActiveAdvisoryResponse } from '../services/advisoryService';
import { formatDateTime } from '../utils/formatters';
import { BrownoutPost } from '../types';

// Context interface so child routes (like PublicHomePage) can inherit data 
// without duplicate API requests
export interface PublicLayoutOutletContext {
  activeData: ActiveAdvisoryResponse | null;
  advisory: BrownoutPost | null;
  loading: boolean;
}

// -----------------------------------------------------------------------------
// MEMOIZED CIVIC FOOTER (Simple, Clean, & Responsive)
// -----------------------------------------------------------------------------
interface CivicFooterProps {
  advisory: BrownoutPost | null;
}

const CivicFooter = memo(function CivicFooter({ advisory }: CivicFooterProps) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const hasActiveAdvisory = Boolean(advisory);

  return (
    <footer className="w-full border-t border-stone-800 bg-stone-950 text-stone-400">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          {/* Brand & Mission */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white font-serif font-bold tracking-tight hover:text-amber-400 transition-colors"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/20 text-amber-500">
                <Zap className="h-3.5 w-3.5 fill-current" />
              </span>
              <span>POWERWATCH</span>
            </Link>

            <span className="hidden sm:inline text-stone-700" aria-hidden="true">•</span>

            <p className="text-xs text-stone-400 font-light max-w-xs sm:max-w-md">
              Public civic infrastructure monitor for Metro Cebu.
            </p>

            {hasActiveAdvisory && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400">
                <Radio className="h-2.5 w-2.5 animate-pulse" />
                <span>Advisory Active</span>
              </span>
            )}
          </div>

          {/* Copyright & Admin Portal Action */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-mono">
            <span className="text-[11px] text-stone-500">&copy; {currentYear} PowerWatch</span>
            <span className="text-stone-700 select-none" aria-hidden="true">•</span>

            {/* Admin Portal Button */}
            <Link
              to="/admin/login"
              className="group inline-flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-[11px] font-medium text-stone-300 transition-all hover:border-amber-500/40 hover:bg-stone-800 hover:text-amber-400 active:scale-95"
            >
              <span>Admin Portal</span>
              <ArrowUpRight className="h-3 w-3 text-stone-500 group-hover:text-amber-400 transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
});
CivicFooter.displayName = 'CivicFooter';

// -----------------------------------------------------------------------------
// MAIN LAYOUT COMPONENT
// -----------------------------------------------------------------------------
export function PublicLayout() {
  const [activeData, setActiveData] = useState<ActiveAdvisoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Non-blocking asynchronous fetch with unmount guard
  useEffect(() => {
    let isSubscribed = true;

    advisoryService
      .getActiveAdvisory()
      .then(data => {
        if (isSubscribed) {
          setActiveData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isSubscribed) {
          console.error('Failed to load active advisory in PublicLayout:', err);
          setLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const advisory = activeData?.advisory ?? null;

  // Memoize the context object to prevent cascading re-renders to child routes
  const outletContext = useMemo<PublicLayoutOutletContext>(
    () => ({
      activeData,
      advisory,
      loading
    }),
    [activeData, advisory, loading]
  );

  return (
    <div
      id="top"
      className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#FAF9F6] font-sans text-slate-900 antialiased selection:bg-amber-400 selection:text-slate-950"
    >
      {/* Accessibility Skip-To-Main Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-amber-400 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-slate-950 focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
      >
        Skip to main content
      </a>

      {/* Top Telemetry Loading Progress Bar */}
      <div
        role="progressbar"
        aria-hidden={!loading}
        className={`fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden bg-transparent transition-opacity duration-500 ease-in-out ${
          loading ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="h-full w-full origin-left animate-[pulse_1.5s_ease-in-out_infinite] bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
      </div>

      {/* Main Viewport Container */}
      <main
        id="main-content"
        className="flex-1 w-full min-w-0 transition-all duration-300 ease-in-out"
      >
        <Outlet context={outletContext} />
      </main>

      {/* Clean & Responsive Civic Footer */}
      <CivicFooter advisory={advisory} />
    </div>
  );
}