import React, { useEffect, useState, useMemo, useRef, useCallback, useDeferredValue, memo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  MapPin,
  Clock,
  X,
  Radio,
  ShieldCheck,
  ArrowUpRight,
  Calendar
} from 'lucide-react';
import { advisoryService, ActiveAdvisoryResponse } from '../../services/advisoryService';
import { Area, PublicScheduleGroup, BrownoutPost } from '../../types';
import { PowerWatchMap, MapAreaSchedule } from '../../components/map/PowerWatchMap';
import { formatDateRange, formatDate, getScheduleTimeStatus } from '../../utils/formatters';

// =============================================================================
// TYPES & MODULE-LEVEL CONSTANTS
// =============================================================================

export interface PublicHomePageProps {
  initialCity?: string;
  onAreaClick?: (area: Area) => void;
}

interface PublicLayoutOutletContext {
  activeData: ActiveAdvisoryResponse | null;
  advisory: BrownoutPost | null;
  loading: boolean;
}

const POPULAR_BARANGAYS = [
  'Guadalupe',
  'Lahug',
  'Mabolo',
  'Labangon',
  'Banilad',
  'Basak',
  'Subangdaku',
  'Bulacao'
] as const;

const CEBU_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

interface EnrichedMapAreaSchedule extends MapAreaSchedule {
  formattedSummary: string;
}

interface SearchableEntry {
  area: Area;
  schedule: PublicScheduleGroup;
  timeWindow: string;
  date: string;
  formattedDate: string;
  normalizedName: string;
  normalizedCity: string;
}

const compareStringAsc = (a: string = '', b: string = ''): number => (a < b ? -1 : a > b ? 1 : 0);

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ScheduleAreaBadgeProps {
  area: Area;
  isSelected: boolean;
  onSelect: (area: Area) => void;
}

const ScheduleAreaBadge = memo(function ScheduleAreaBadge({
  area,
  isSelected,
  onSelect
}: ScheduleAreaBadgeProps) {
  const handleClick = useCallback(() => onSelect(area), [area, onSelect]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95 touch-manipulation cursor-pointer select-none max-w-full ${
        isSelected
          ? 'bg-stone-950 text-white shadow-xs ring-2 ring-amber-400'
          : 'bg-white border border-stone-200 text-stone-700 hover:border-amber-400 hover:bg-amber-50/50 hover:text-stone-950'
      }`}
    >
      <MapPin className={`h-3 w-3 shrink-0 ${isSelected ? 'text-amber-400' : 'text-stone-400'}`} />
      <span className="truncate max-w-[130px] sm:max-w-[200px] md:max-w-none">{area.name}</span>
    </button>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PublicHomePage({ initialCity = 'All', onAreaClick }: PublicHomePageProps) {
  const outletCtx = useOutletContext<PublicLayoutOutletContext | null>();

  const [internalData, setInternalData] = useState<ActiveAdvisoryResponse | null>(null);
  const [internalLoading, setInternalLoading] = useState<boolean>(!outletCtx?.activeData);

  const activeData = outletCtx?.activeData ?? internalData;
  const loading = outletCtx ? outletCtx.loading : internalLoading;

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [selectedCityFilter] = useState<string>(initialCity);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [focusCoordinates, setFocusCoordinates] = useState<[number, number] | null>(null);

  // Active Schedule Window Tab
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | 'all'>('auto');

  // Dynamic Map Height for preventing mobile scroll-traps
  const [mapHeight, setMapHeight] = useState<string>('400px');

  // Section Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const scheduleSectionRef = useRef<HTMLElement>(null);

  // Responsive map height tracker
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setMapHeight('320px');
      } else if (width < 1024) {
        setMapHeight('420px');
      } else {
        setMapHeight('560px');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ---------------------------------------------------------------------------
  // Data Fetching Fallback
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (outletCtx?.activeData) return;

    let isMounted = true;
    setInternalLoading(true);

    advisoryService
      .getActiveAdvisory()
      .then(data => {
        if (isMounted) {
          setInternalData(data);
          setInternalLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('Failed to load active PowerWatch advisory:', err);
          setInternalLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [outletCtx?.activeData]);

  const todayIso = useMemo(() => CEBU_DATE_FORMATTER.format(new Date()), []);

  // ---------------------------------------------------------------------------
  // Indexing
  // ---------------------------------------------------------------------------
  const {
    affectedAreasForMap,
    areaMapById,
    searchIndex,
    areasByCityMap
  } = useMemo(() => {
    if (!activeData?.schedules || activeData.schedules.length === 0) {
      return {
        affectedAreasForMap: [] as EnrichedMapAreaSchedule[],
        areaMapById: new Map<string, EnrichedMapAreaSchedule>(),
        searchIndex: [] as SearchableEntry[],
        areasByCityMap: new Map<string, EnrichedMapAreaSchedule[]>()
      };
    }

    const areaMap = new Map<string, EnrichedMapAreaSchedule>();
    const searchEntries: SearchableEntry[] = [];
    const cityMap = new Map<string, EnrichedMapAreaSchedule[]>();
    const advisory = activeData.advisory;
    const formattedDateMap = new Map<string, string>();

    const schedules = activeData.schedules;
    const schedLen = schedules.length;

    for (let i = 0; i < schedLen; i++) {
      const schedule = schedules[i];
      const groups = schedule.areasByCity;
      const grpLen = groups.length;

      let fDate = formattedDateMap.get(schedule.scheduleDate);
      if (!fDate) {
        fDate = formatDate(schedule.scheduleDate);
        formattedDateMap.set(schedule.scheduleDate, fDate);
      }

      const mapSchedulePayload = {
        schedule: {
          id: schedule.id,
          brownoutPostId: advisory.id,
          scheduleDate: schedule.scheduleDate,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          scheduleType: schedule.scheduleType,
          status: 'Scheduled' as const,
          createdAt: advisory.createdAt
        },
        post: advisory,
        timeWindow: schedule.timeWindow
      };

      for (let j = 0; j < grpLen; j++) {
        const group = groups[j];
        const areas = group.areas;
        const areaLen = areas.length;

        for (let k = 0; k < areaLen; k++) {
          const area = areas[k];

          searchEntries.push({
            area,
            schedule,
            timeWindow: schedule.timeWindow,
            date: schedule.scheduleDate,
            formattedDate: fDate,
            normalizedName: area.name.toLowerCase(),
            normalizedCity: area.city.toLowerCase()
          });

          let existing = areaMap.get(area.id);
          if (!existing) {
            existing = {
              area,
              schedules: [],
              formattedSummary: ''
            };
            areaMap.set(area.id, existing);
          }
          existing.schedules.push(mapSchedulePayload);
        }
      }
    }

    const affectedList = Array.from(areaMap.values());
    const affectedLen = affectedList.length;

    for (let i = 0; i < affectedLen; i++) {
      const item = affectedList[i];
      item.formattedSummary = item.schedules.map(s => s.timeWindow).join(', ');

      const cityKey = item.area.city.toLowerCase();
      let bucket = cityMap.get(cityKey);
      if (!bucket) {
        bucket = [];
        cityMap.set(cityKey, bucket);
      }
      bucket.push(item);
    }

    return {
      affectedAreasForMap: affectedList,
      areaMapById: areaMap,
      searchIndex: searchEntries,
      areasByCityMap: cityMap
    };
  }, [activeData]);

  // Today's Schedules
  const todaySchedules = useMemo(() => {
    if (!activeData?.schedules) return [];
    const sourceList = activeData.schedules.filter(s => s.scheduleDate === todayIso);
    const effectiveList = sourceList.length > 0 ? sourceList : activeData.schedules;
    return [...effectiveList].sort((a, b) => compareStringAsc(a.startTime, b.startTime));
  }, [activeData, todayIso]);

  // Auto-detect ongoing window or default to first window
  const activeWindowSchedule = useMemo(() => {
    if (selectedScheduleId === 'all') return null;
    if (selectedScheduleId !== 'auto') {
      return todaySchedules.find(s => s.id === selectedScheduleId) || todaySchedules[0] || null;
    }
    const ongoing = todaySchedules.find(
      s => getScheduleTimeStatus(s.scheduleDate, s.startTime, s.endTime) === 'ongoing'
    );
    return ongoing || todaySchedules[0] || null;
  }, [todaySchedules, selectedScheduleId]);

  // Fast Top Search
  const searchResults = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];

    const results: SearchableEntry[] = [];
    const len = searchIndex.length;

    for (let i = 0; i < len; i++) {
      const item = searchIndex[i];
      if (item.normalizedName.includes(q) || item.normalizedCity.includes(q)) {
        results.push(item);
        if (results.length === 6) break;
      }
    }
    return results;
  }, [searchIndex, deferredQuery]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleSelectArea = useCallback((area: Area) => {
    setSelectedAreaId(area.id);
    if (area.latitude && area.longitude) {
      setFocusCoordinates([area.latitude, area.longitude]);
    }

    const areaDetail = areaMapById.get(area.id);
    if (areaDetail && areaDetail.schedules.length > 0) {
      setSelectedScheduleId(areaDetail.schedules[0].schedule.id);
    }

    if (onAreaClick) {
      onAreaClick(area);
    }
  }, [areaMapById, onAreaClick]);

  const handleBarangayLocate = useCallback((area: Area) => {
    handleSelectArea(area);
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [handleSelectArea]);

  const handleMapSelectArea = useCallback((areaId: string) => {
    const match = areaMapById.get(areaId);
    if (match) handleSelectArea(match.area);
  }, [areaMapById, handleSelectArea]);

  const handleQuickSearch = useCallback((term: string) => {
    setSearchQuery(term);
    searchInputRef.current?.focus();
  }, []);

  const clearSelectedArea = useCallback(() => {
    setSelectedAreaId(null);
  }, []);

  const selectedAreaDetail = selectedAreaId ? areaMapById.get(selectedAreaId) : null;
  const advisory: BrownoutPost | undefined = activeData?.advisory;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 sm:px-5 sm:py-3.5 shadow-2xs">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          <span className="font-mono text-xs font-medium uppercase tracking-wider text-stone-700">
            Loading Live Grid Telemetry...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-10 space-y-6 sm:space-y-8 lg:space-y-10 selection:bg-amber-400 selection:text-stone-950">
      {/* 1. HERO & SEARCH SECTION */}
      <section className="space-y-4 sm:space-y-6">
        {/* Status Bar */}
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 border-b border-stone-200/80 pb-3 sm:pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-600" />
            </span>
            <span className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-900">
              Rotational Advisory Active
            </span>
            <span className="hidden xs:inline text-stone-300">•</span>
            <span className="font-mono text-[11px] sm:text-xs text-stone-500">
              {advisory ? formatDateRange(advisory.startDate, advisory.endDate) : 'Live Window'}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-mono text-stone-600 self-start xs:self-auto">
            <span>
              <strong className="font-semibold text-stone-900">{affectedAreasForMap.length}</strong> areas
            </span>
            <span className="text-stone-300">•</span>
            <span>
              <strong className="font-semibold text-stone-900">{activeData?.schedules.length ?? 0}</strong> windows
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5 sm:space-y-2">
          <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-light tracking-tight text-stone-950 leading-tight">
            Check your power schedule.
          </h1>
          <p className="max-w-xl text-xs sm:text-base font-light text-stone-600">
            Instant look-up for rotational brownouts across Metro Cebu municipalities.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-2xl">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-3.5 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-stone-400 transition-colors duration-150 group-focus-within:text-amber-600" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search barangay (e.g. Guadalupe, Lahug)..."
              className="w-full rounded-xl border border-stone-300 bg-white py-3 sm:py-3.5 pl-10 sm:pl-12 pr-10 text-sm sm:text-base text-stone-900 placeholder:text-stone-400 shadow-2xs transition-all duration-200 hover:border-stone-400 focus:border-stone-900 focus:outline-none focus:ring-3 focus:ring-stone-900/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 active:scale-90 touch-manipulation cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown Overlay */}
          {deferredQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 z-30 mt-2 max-h-[55vh] overflow-y-auto rounded-xl border border-stone-300 bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
              {searchResults.length > 0 ? (
                <div className="divide-y divide-stone-100">
                  {searchResults.map((item, idx) => (
                    <div
                      key={`${item.area.id}-${idx}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:p-4 hover:bg-stone-50 transition-colors"
                    >
                      <div className="space-y-0.5 sm:space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif text-base sm:text-lg font-medium text-stone-950 truncate">
                            {item.area.name}
                          </span>
                          <span className="text-[11px] sm:text-xs text-stone-400 font-mono">
                            {item.area.city}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-xs text-amber-800">
                          <span className="font-semibold text-stone-900">{item.timeWindow}</span>
                          <span>•</span>
                          <span className="text-stone-500">{item.formattedDate}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBarangayLocate(item.area)}
                        className="inline-flex items-center justify-center gap-1.5 self-stretch sm:self-center rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 font-mono text-xs font-semibold text-stone-800 hover:bg-stone-950 hover:text-white active:scale-95 touch-manipulation cursor-pointer transition-colors"
                      >
                        <span>View on map</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 text-center text-xs text-stone-500 font-mono">
                  No scheduled brownout found for &quot;{deferredQuery}&quot;.
                </div>
              )}
            </div>
          )}

          {/* Quick Check Bar: Horizontally scrollable carousel on mobile, wraps on larger devices */}
          {!deferredQuery && (
            <div className="pt-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 sm:flex-wrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className="font-mono text-[11px] sm:text-xs text-stone-400 shrink-0 mr-1">
                  Quick check:
                </span>
                {POPULAR_BARANGAYS.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => handleQuickSearch(b)}
                    className="shrink-0 rounded-md border border-stone-200/90 bg-white px-2.5 py-1 font-mono text-xs text-stone-600 transition-all hover:border-amber-400 hover:bg-amber-50 hover:text-stone-900 active:scale-95 touch-manipulation cursor-pointer"
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. MAP & TELEMETRY SECTION */}
      <section
        ref={scheduleSectionRef}
        id="today-schedule"
        className="space-y-3.5 sm:space-y-4 pt-1"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-amber-600 shrink-0" />
            <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-light text-stone-950">
              Today&apos;s Grid Telemetry
            </h2>
          </div>

          <span className="font-mono text-[11px] sm:text-xs text-stone-500">
            {todaySchedules.length} rotational windows
          </span>
        </div>

        {/* Responsive Grid: Schedule tabs stack on top on mobile, sits side-by-side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Map Column */}
          <div
            ref={mapContainerRef}
            className="lg:col-span-7 space-y-2.5 sm:space-y-3 order-2 lg:order-1"
          >
            <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-stone-300 bg-stone-100 shadow-2xs">
              <PowerWatchMap
                affectedAreas={affectedAreasForMap}
                selectedAreaId={selectedAreaId}
                onSelectArea={handleMapSelectArea}
                focusCoordinates={focusCoordinates}
                height={mapHeight}
              />
            </div>

            {/* Selected Pin Alert Ribbon */}
            {selectedAreaDetail && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50/90 p-3 sm:p-3.5 shadow-2xs animate-in fade-in duration-150">
                <div className="space-y-0.5 min-w-0">
                  <span className="font-serif font-semibold text-stone-900 text-xs sm:text-sm truncate block">
                    {selectedAreaDetail.area.name}, {selectedAreaDetail.area.city}
                  </span>
                  <p className="font-mono text-[11px] sm:text-xs text-stone-600 truncate">
                    Active Window: <span className="font-bold text-amber-900">{selectedAreaDetail.formattedSummary}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedArea}
                  className="font-mono text-xs text-stone-500 hover:text-stone-900 px-2 py-1 cursor-pointer underline shrink-0 touch-manipulation"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Schedule Column */}
          <div className="lg:col-span-5 space-y-3 order-1 lg:order-2">
            {/* Horizontal Window Selector Tabs: Swipeable on Mobile, Wrap on Desktop */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono text-stone-500 px-1">
                <span>Select Window</span>
                <span className="hidden xs:inline">Tap to inspect areas</span>
              </div>

              <div className="flex gap-1.5 p-1 sm:p-1.5 bg-stone-100/90 rounded-xl border border-stone-200 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
                {todaySchedules.map(sched => {
                  const isOngoing = getScheduleTimeStatus(sched.scheduleDate, sched.startTime, sched.endTime) === 'ongoing';
                  const isSelected = activeWindowSchedule?.id === sched.id && selectedScheduleId !== 'all';

                  return (
                    <button
                      key={sched.id}
                      type="button"
                      onClick={() => setSelectedScheduleId(sched.id)}
                      className={`snap-start shrink-0 min-w-fit sm:flex-1 py-1.5 px-2.5 sm:px-3 rounded-lg font-mono text-xs transition-all flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer select-none ${
                        isSelected
                          ? 'bg-stone-950 text-white shadow-xs font-bold'
                          : isOngoing
                          ? 'bg-amber-100 text-amber-950 border border-amber-300 font-semibold'
                          : 'bg-white text-stone-700 hover:bg-stone-200 hover:text-stone-950 border border-stone-200/60'
                      }`}
                    >
                      {isOngoing && (
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                        </span>
                      )}
                      <span className="whitespace-nowrap">{sched.startTime}–{sched.endTime}</span>
                    </button>
                  );
                })}

                {todaySchedules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedScheduleId('all')}
                    className={`snap-start shrink-0 py-1.5 px-3 rounded-lg font-mono text-xs transition-all touch-manipulation cursor-pointer whitespace-nowrap ${
                      selectedScheduleId === 'all'
                        ? 'bg-stone-950 text-white shadow-xs font-bold'
                        : 'bg-white text-stone-600 hover:bg-stone-200 border border-stone-200/60'
                    }`}
                  >
                    View All
                  </button>
                )}
              </div>
            </div>

            {/* Active Window Barangay Card */}
            {activeWindowSchedule && selectedScheduleId !== 'all' && (
              <div className="rounded-xl sm:rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-5 shadow-2xs space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3 gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 shrink-0" />
                      <h3 className="font-mono text-lg sm:text-2xl font-bold tracking-tight text-stone-950 truncate">
                        {activeWindowSchedule.timeWindow}
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] sm:text-xs text-stone-400">
                      {formatDate(activeWindowSchedule.scheduleDate)}
                    </span>
                  </div>

                  {getScheduleTimeStatus(activeWindowSchedule.scheduleDate, activeWindowSchedule.startTime, activeWindowSchedule.endTime) === 'ongoing' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2 sm:px-2.5 py-0.5 sm:py-1 font-mono text-[9px] sm:text-[10px] font-bold text-amber-900 shadow-2xs shrink-0">
                      <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-amber-600" />
                      </span>
                      ACTIVE NOW
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-stone-500 bg-stone-100 px-2 py-0.5 rounded shrink-0">
                      Scheduled
                    </span>
                  )}
                </div>

                {/* Categorized barangay badge clouds */}
                <div className="space-y-3 sm:space-y-3.5 max-h-[380px] sm:max-h-[420px] overflow-y-auto pr-1">
                  {activeWindowSchedule.areasByCity.map(group => (
                    <div key={group.city} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-stone-900">{group.city}</span>
                        <span className="text-[10px] text-stone-400 font-medium">
                          {group.areas.length} {group.areas.length === 1 ? 'barangay' : 'barangays'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        {group.areas.map(area => (
                          <ScheduleAreaBadge
                            key={area.id}
                            area={area}
                            isSelected={selectedAreaId === area.id}
                            onSelect={handleSelectArea}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expanded "All Windows" Mode */}
            {selectedScheduleId === 'all' && (
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {todaySchedules.map(schedule => (
                  <div key={schedule.id} className="rounded-xl border border-stone-200 bg-white p-3 sm:p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                      <span className="font-mono text-xs sm:text-sm font-bold text-stone-900">{schedule.timeWindow}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedScheduleId(schedule.id)}
                        className="text-xs font-mono text-amber-800 underline cursor-pointer touch-manipulation"
                      >
                        Focus Window
                      </button>
                    </div>
                    {schedule.areasByCity.map(group => (
                      <div key={group.city} className="space-y-1">
                        <span className="text-[11px] font-mono font-semibold text-stone-700">{group.city}</span>
                        <div className="flex flex-wrap gap-1 sm:gap-1.5">
                          {group.areas.map(a => (
                            <ScheduleAreaBadge
                              key={a.id}
                              area={a}
                              isSelected={selectedAreaId === a.id}
                              onSelect={handleSelectArea}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. OFFICIAL SOURCE & ADVISORY REFERENCE */}
      {advisory && (
        <section className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-stone-200/90 bg-white p-4 sm:p-6 lg:p-7 shadow-xs">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-transparent" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
            <div className="space-y-2 sm:space-y-3 max-w-3xl">
              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-semibold bg-amber-50 text-amber-900 border border-amber-200/70">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Verified Ingestion</span>
                </span>

                <span className="text-stone-300 select-none">•</span>

                <span className="font-mono text-[11px] sm:text-xs text-stone-500">
                  Source: <strong className="text-stone-900 font-semibold">{advisory.source || 'Visayan Electric'}</strong>
                </span>

                {advisory.startDate && (
                  <>
                    <span className="hidden xs:inline text-stone-300 select-none">•</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] sm:text-xs text-stone-600">
                      <Calendar className="w-3 h-3 text-stone-400 shrink-0" />
                      <span>{formatDateRange(advisory.startDate, advisory.endDate)}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Title & Context */}
              <div className="space-y-1">
                <h3 className="font-serif text-lg sm:text-xl lg:text-2xl font-normal tracking-tight text-stone-950 leading-snug">
                  {advisory.title}
                </h3>
                <p className="text-xs text-stone-500 font-mono leading-relaxed">
                  Rotational interruptions are implemented under NGCP generation reserve balance directives to safeguard regional transmission line integrity.
                </p>
              </div>
            </div>

            {/* External Verified Source Link Button */}
            {advisory.sourceUrl && (
              <div className="shrink-0 flex items-center pt-1 lg:pt-0">
                <a
                  href={advisory.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 font-mono text-xs font-semibold text-white shadow-xs transition-all hover:bg-stone-800 hover:shadow-sm active:scale-95 touch-manipulation w-full sm:w-auto"
                >
                  <span>Read Original Advisory</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-amber-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}