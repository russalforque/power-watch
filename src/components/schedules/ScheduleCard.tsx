import React from 'react';
import { Clock, MapPin, Zap } from 'lucide-react';
import { PublicScheduleGroup, Area } from '../../types';
import { formatDate, getScheduleTimeStatus } from '../../utils/formatters';

interface ScheduleCardProps {
  schedule: PublicScheduleGroup;
  onSelectArea?: (area: Area) => void;
  selectedAreaId?: string | null;
  className?: string;
}

export function ScheduleCard({
  schedule,
  onSelectArea,
  selectedAreaId,
  className = ''
}: ScheduleCardProps) {
  const timeStatus = getScheduleTimeStatus(
    schedule.scheduleDate,
    schedule.startTime,
    schedule.endTime
  );

  const isActive = timeStatus === 'ongoing';
  const isUpcoming = timeStatus === 'upcoming';

  return (
    <div
      className={`rounded-xl p-4.5 transition-all ${
        isActive
          ? 'border border-blue-200 bg-blue-50/30 shadow-xs ring-1 ring-blue-100'
          : 'border border-slate-200 bg-white hover:border-slate-300 shadow-xs'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-3.5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : isUpcoming
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
              {isActive ? 'Active Now' : isUpcoming ? 'Upcoming' : 'Concluded'}
            </span>

            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {formatDate(schedule.scheduleDate)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
            <h3
              className={`text-base font-bold tracking-tight ${
                isActive ? 'text-blue-900 font-mono' : 'text-slate-900 font-mono'
              }`}
            >
              {schedule.timeWindow}
            </h3>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            Advisory Window
          </span>
          <span className="text-xs font-semibold text-slate-600">
            {schedule.totalAreas ?? schedule.areasByCity.reduce((sum, g) => sum + g.areas.length, 0)} areas
          </span>
        </div>
      </div>

      {/* Affected Areas by City */}
      <div className="space-y-3.5">
        {schedule.areasByCity.map(group => (
          <div key={group.city} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                {group.city}
              </p>
              <span className="text-[10px] text-slate-400">
                {group.areas.length} {group.areas.length === 1 ? 'barangay' : 'barangays'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {group.areas.map(area => {
                const isSelected = selectedAreaId === area.id;
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => onSelectArea && onSelectArea(area)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold border-blue-600 shadow-xs ring-2 ring-blue-300'
                        : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-900 border-slate-200 hover:border-blue-200'
                    }`}
                  >
                    {area.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
