import React from 'react';
import { Info, ExternalLink } from 'lucide-react';

interface DisclaimerCardProps {
  sourceUrl?: string;
  className?: string;
}

export function DisclaimerCard({ sourceUrl, className = '' }: DisclaimerCardProps) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xs ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-1 rounded-md bg-amber-50 text-amber-700 mt-0.5 shrink-0 border border-amber-200/60">
          <Info className="w-4 h-4" />
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Notice on Rotational Brownouts
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500">
                Source: <strong className="text-slate-700">Visayan Electric</strong>
              </span>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[11px] text-blue-600 hover:text-blue-800 underline underline-offset-2 ml-1"
                >
                  <span>Official Post</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <p className="leading-relaxed text-slate-600 text-xs">
            Schedules are based on official advisories from <strong>Visayan Electric</strong>. These represent <em>possible rotational brownout schedules</em> and may be cancelled, adjusted, or altered depending on prevailing grid supply and NGCP dispatch directives.
          </p>
        </div>
      </div>
    </div>
  );
}
