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
  'Basak',
  'Guadalupe',
  'Lahug',
  'Mabolo',
  'Labangon',
  'Banilad',
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
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-mono transition-all duration-150 active:scale-95 touch-manipulation cursor-pointer select-none min-h-[32px] ${
        isSelected
          ? 'bg-stone-900 text-white shadow-xs ring-2 ring-amber-400'
          : 'bg-white border border-stone-200 text-stone-700 hover:border-amber-400 hover:bg-amber-50/60 hover:text-stone-950'
      }`}
    >
      <MapPin className={`h-3 w-3 shrink-0 ${isSelected ? 'text-amber-400' : 'text-stone-400'}`} />
      <span className="truncate max-w-[110px] xs:max-w-[140px] sm:max-w-[180px]">{area.name}</span>
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

  // Search & Dropdown State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const deferredQuery = useDeferredValue(searchQuery);

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [focusCoordinates, setFocusCoordinates] = useState<[number, number] | null>(null);

  // Active Schedule Window Tab
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | 'all'>('auto');

  // Dynamic Map Height
  const [mapHeight, setMapHeight] = useState<string>('280px');

  // Section Refs
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Responsive map height tracker
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setMapHeight('280px');
      } else if (width < 1024) {
        setMapHeight('380px');
      } else {
        setMapHeight('520px');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Data Fetching Fallback
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

  // Indexing
  const {
    affectedAreasForMap,
    areaMapById,
    searchIndex
  } = useMemo(() => {
    if (!activeData?.schedules || activeData.schedules.length === 0) {
      return {
        affectedAreasForMap: [] as EnrichedMapAreaSchedule[],
        areaMapById: new Map<string, EnrichedMapAreaSchedule>(),
        searchIndex: [] as SearchableEntry[]
      };
    }

    const areaMap = new Map<string, EnrichedMapAreaSchedule>();
    const searchEntries: SearchableEntry[] = [];
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
    }

    return {
      affectedAreasForMap: affectedList,
      areaMapById: areaMap,
      searchIndex: searchEntries
    };
  }, [activeData]);

  // Today's Schedules & Areas
  const todaySchedules = useMemo(() => {
    if (!activeData?.schedules) return [];
    const sourceList = activeData.schedules.filter(s => s.scheduleDate === todayIso);
    const effectiveList = sourceList.length > 0 ? sourceList : activeData.schedules;
    return [...effectiveList].sort((a, b) => compareStringAsc(a.startTime, b.startTime));
  }, [activeData, todayIso]);

  // Today's Affected Areas count
  const todayAffectedAreasCount = useMemo(() => {
    const areaIdSet = new Set<string>();
    todaySchedules.forEach(schedule => {
      schedule.areasByCity.forEach(group => {
        group.areas.forEach(area => areaIdSet.add(area.id));
      });
    });
    return areaIdSet.size;
  }, [todaySchedules]);

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

  // Search Results
  const searchResults = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];

    const results: SearchableEntry[] = [];
    const len = searchIndex.length;

    for (let i = 0; i < len; i++) {
      const item = searchIndex[i];
      if (item.normalizedName.includes(q) || item.normalizedCity.includes(q)) {
        results.push(item);
        if (results.length === 8) break;
      }
    }
    return results;
  }, [searchIndex, deferredQuery]);

  // Action Handlers
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
    setIsDropdownOpen(false);
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [handleSelectArea]);

  const handleMapSelectArea = useCallback((areaId: string) => {
    const match = areaMapById.get(areaId);
    if (match) handleSelectArea(match.area);
  }, [areaMapById, handleSelectArea]);

  const handleQuickSearch = useCallback((term: string) => {
    setSearchQuery(term);
    setIsDropdownOpen(true);
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
        <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-5 py-3.5 shadow-xs">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-800 border-t-transparent" />
          <span className="font-mono text-xs uppercase tracking-widest text-stone-600">
            Checking Grid Status...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6]/80 text-stone-900 selection:bg-amber-400 selection:text-stone-950">
      <div className="mx-auto max-w-5xl px-3.5 sm:px-6 lg:px-8 py-6 sm:py-12 lg:py-16 space-y-8 sm:space-y-14">
        
        {/* =================================================================== */}
        {/* 1. LOOKUP HERO (Elevated Stacking Context relative z-30)            */}
        {/* =================================================================== */}
        <section className="relative z-30 flex flex-col items-center text-center">
          {/* Eyebrow */}
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            <span>Barangay Lookup</span>
            <span className="text-stone-300">/</span>

            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
              {todayAffectedAreasCount || affectedAreasForMap.length} affected today
            </span>
          </div>

          {/* Heading */}
          <h1 className="max-w-2xl font-serif text-3xl font-normal leading-[1.05] tracking-tight text-stone-950 xs:text-4xl sm:text-5xl lg:text-6xl">
            Is your area affected?
          </h1>

          {/* Subtitle */}
          <p className="mt-4 max-w-lg px-4 text-xs sm:text-sm leading-relaxed text-stone-500">
            Search your barangay to check for scheduled or possible rotational
            brownout interruptions.
          </p>

          {/* Search Area */}
          <div ref={searchContainerRef} className="relative mt-7 w-full max-w-2xl">
            {/* Search Input */}
            <div className="group relative">
              <Search
                className="
                  pointer-events-none
                  absolute left-4 sm:left-5 top-1/2
                  h-4 w-4 sm:h-[18px] sm:w-[18px]
                  -translate-y-1/2
                  text-stone-400
                  transition-colors
                  group-focus-within:text-stone-700
                "
              />

              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                placeholder="Search your barangay..."
                aria-label="Search barangay"
                className="
                  w-full
                  rounded-2xl
                  border border-stone-300
                  bg-white
                  py-4 sm:py-[17px]
                  pl-11 sm:pl-12
                  pr-12
                  text-base
                  text-stone-950
                  placeholder:text-stone-400
                  shadow-sm
                  outline-none
                  transition-all
                  hover:border-stone-400
                  focus:border-stone-950
                  focus:ring-4
                  focus:ring-stone-950/[0.04]
                "
              />

              {/* Clear */}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsDropdownOpen(false);
                  }}
                  className="
                    absolute right-2 top-1/2
                    flex h-9 w-9
                    -translate-y-1/2
                    items-center justify-center
                    rounded-xl
                    text-stone-400
                    transition-all
                    hover:bg-stone-100
                    hover:text-stone-700
                    active:scale-90
                  "
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Popular Barangays */}
            {!deferredQuery && (
              <div
                className="
                  mt-3
                  flex items-center gap-2
                  overflow-x-auto
                  pb-1
                  sm:flex-wrap
                  sm:justify-center
                  sm:overflow-visible
                  [-ms-overflow-style:none]
                  [scrollbar-width:none]
                  [&::-webkit-scrollbar]:hidden
                "
              >
                <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  Popular
                </span>

                {POPULAR_BARANGAYS.map((barangay) => (
                  <button
                    key={barangay}
                    type="button"
                    onClick={() => handleQuickSearch(barangay)}
                    className="
                      shrink-0
                      rounded-lg
                      border border-stone-200
                      bg-white
                      px-2.5 py-1.5
                      font-mono text-[10px]
                      text-stone-600
                      shadow-xs
                      transition-all
                      hover:border-stone-400
                      hover:bg-stone-50
                      hover:text-stone-950
                      active:scale-95
                    "
                  >
                    {barangay}
                  </button>
                ))}
              </div>
            )}

            {/* Search Results Dropdown with z-[1100] to sit above Leaflet controls */}
            {isDropdownOpen && deferredQuery.trim().length > 0 && (
              <div
                className="
                  absolute
                  left-0 right-0
                  z-[1100]
                  mt-2.5
                  overflow-hidden
                  rounded-2xl
                  border border-stone-200
                  bg-white
                  text-left
                  shadow-2xl
                  shadow-stone-950/20
                  animate-in
                  fade-in
                  slide-in-from-top-1
                  duration-150
                "
              >
                {searchResults.length > 0 ? (
                  <>
                    {/* Results Header */}
                    <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-5">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400">
                        Affected areas
                      </span>

                      <span className="font-mono text-[10px] text-stone-400">
                        {searchResults.length} result
                        {searchResults.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Results List */}
                    <div className="max-h-[55vh] overflow-y-auto divide-y divide-stone-100">
                      {searchResults.map((item, idx) => (
                        <button
                          key={`${item.area.id}-${idx}`}
                          type="button"
                          onClick={() => handleBarangayLocate(item.area)}
                          className="
                            group
                            flex w-full
                            flex-col
                            gap-4
                            p-4
                            text-left
                            transition-colors
                            hover:bg-stone-50
                            sm:flex-row
                            sm:items-center
                            sm:justify-between
                            sm:p-5
                          "
                        >
                          {/* Area Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-serif text-lg sm:text-xl font-normal leading-tight tracking-tight text-stone-950">
                                {item.area.name}
                              </span>

                              <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.12em] text-stone-400">
                                {item.area.city}
                              </span>
                            </div>

                            <div className="mt-2.5 flex items-center gap-2">
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-40" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                              </span>

                              <span className="font-mono text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                                Possible rotational brownout
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-stone-500">
                              <span className="font-semibold text-stone-900">
                                {item.timeWindow}
                              </span>
                              <span className="text-stone-300">•</span>
                              <span>{item.formattedDate}</span>
                            </div>
                          </div>

                          {/* Map Action */}
                          <div className="
                            flex shrink-0
                            items-center justify-between
                            gap-3
                            rounded-lg
                            border border-stone-200
                            bg-white
                            px-3.5 py-2.5
                            font-mono
                            text-[10px]
                            font-semibold
                            uppercase
                            tracking-wider
                            text-stone-600
                            transition-all
                            group-hover:border-stone-950
                            group-hover:bg-stone-950
                            group-hover:text-white
                            sm:w-auto
                          ">
                            <span>View map</span>
                            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  /* Empty State */
                  <div className="px-5 py-9 text-center sm:py-10">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-stone-100">
                      <Search className="h-4 w-4 text-stone-400" />
                    </div>

                    <p className="font-mono text-xs font-medium text-stone-700">
                      No affected area found
                    </p>

                    <p className="mx-auto mt-1.5 max-w-xs font-mono text-[10px] leading-relaxed text-stone-400">
                      No scheduled interruption matches &quot;{deferredQuery}&quot;. Try another barangay.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* =================================================================== */}
        {/* 2. TODAY'S AFFECTED AREAS & GRID TELEMETRY MAP (relative z-10)     */}
        {/* =================================================================== */}
        <section className="relative z-10 space-y-3.5 sm:space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 border-b border-stone-200 pb-2.5 sm:pb-3">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-amber-700 font-semibold flex items-center gap-1">
                <Radio className="h-3 w-3 text-amber-600 animate-pulse shrink-0" /> Live Telemetry
              </span>
              <h2 className="font-serif text-xl sm:text-3xl font-light text-stone-950">
                Today&apos;s Affected Areas & Map
              </h2>
            </div>

            <div className="font-mono text-[11px] sm:text-xs text-stone-500">
              <span className="text-stone-900 font-semibold">{todaySchedules.length}</span> rotational window(s) scheduled
            </div>
          </div>

          {/* Map + Schedule Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
            {/* Map Column */}
            <div ref={mapContainerRef} className="lg:col-span-7 space-y-2.5 sm:space-y-3">
              <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-stone-300 bg-stone-100 shadow-xs">
                <PowerWatchMap
                  affectedAreas={affectedAreasForMap}
                  selectedAreaId={selectedAreaId}
                  onSelectArea={handleMapSelectArea}
                  focusCoordinates={focusCoordinates}
                  height={mapHeight}
                />
              </div>

              {/* Pin Inspection Ribbon */}
              {selectedAreaDetail && (
                <div className="flex items-center justify-between gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 sm:p-3.5 shadow-2xs animate-in fade-in">
                  <div className="min-w-0">
                    <span className="font-serif font-medium text-stone-900 text-xs sm:text-sm truncate block">
                      {selectedAreaDetail.area.name}, {selectedAreaDetail.area.city}
                    </span>
                    <p className="font-mono text-[11px] sm:text-xs text-stone-600 truncate">
                      Window: <strong className="text-amber-900">{selectedAreaDetail.formattedSummary}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedArea}
                    className="font-mono text-xs text-stone-500 hover:text-stone-900 underline cursor-pointer shrink-0 touch-manipulation px-1 py-1"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Today's Schedule Column */}
            <div className="lg:col-span-5 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-stone-500 px-0.5">
                  <span className="uppercase tracking-wider">Select Time Window</span>
                  <span className="text-[10px] text-stone-400 sm:hidden">Swipe →</span>
                </div>

                <div className="flex gap-1.5 p-1 bg-stone-200/60 rounded-xl border border-stone-200 overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {todaySchedules.map(sched => {
                    const isOngoing = getScheduleTimeStatus(sched.scheduleDate, sched.startTime, sched.endTime) === 'ongoing';
                    const isSelected = activeWindowSchedule?.id === sched.id && selectedScheduleId !== 'all';

                    return (
                      <button
                        key={sched.id}
                        type="button"
                        onClick={() => setSelectedScheduleId(sched.id)}
                        className={`snap-start shrink-0 min-h-[36px] py-1.5 px-2.5 sm:px-3 rounded-lg font-mono text-xs transition-all flex items-center gap-1.5 cursor-pointer select-none touch-manipulation ${
                          isSelected
                            ? 'bg-stone-900 text-white shadow-xs font-semibold'
                            : isOngoing
                            ? 'bg-amber-100 text-amber-950 border border-amber-300 font-medium'
                            : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                        }`}
                      >
                        {isOngoing && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />}
                        <span className="whitespace-nowrap">{sched.startTime}–{sched.endTime}</span>
                      </button>
                    );
                  })}

                  {todaySchedules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedScheduleId('all')}
                      className={`snap-start shrink-0 min-h-[36px] py-1.5 px-3 rounded-lg font-mono text-xs transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                        selectedScheduleId === 'all'
                          ? 'bg-stone-900 text-white shadow-xs font-semibold'
                          : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                      }`}
                    >
                      View All
                    </button>
                  )}
                </div>
              </div>

              {/* Barangay List Card */}
              {activeWindowSchedule && selectedScheduleId !== 'all' && (
                <div className="rounded-xl sm:rounded-2xl border border-stone-200 bg-white p-3.5 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2.5 sm:pb-3 gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 shrink-0" />
                        <h3 className="font-mono text-base sm:text-xl font-bold text-stone-950 truncate">
                          {activeWindowSchedule.timeWindow}
                        </h3>
                      </div>
                      <span className="font-mono text-[11px] sm:text-xs text-stone-400">
                        {formatDate(activeWindowSchedule.scheduleDate)}
                      </span>
                    </div>

                    {getScheduleTimeStatus(activeWindowSchedule.scheduleDate, activeWindowSchedule.startTime, activeWindowSchedule.endTime) === 'ongoing' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 sm:px-2.5 py-0.5 font-mono text-[9px] sm:text-[10px] font-bold text-amber-900 shrink-0">
                        ACTIVE NOW
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] sm:text-[10px] uppercase text-stone-500 bg-stone-100 px-2 py-0.5 rounded shrink-0">
                        Scheduled
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[340px] sm:max-h-[380px] overflow-y-auto pr-0.5">
                    {activeWindowSchedule.areasByCity.map(group => (
                      <div key={group.city} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-stone-900 uppercase tracking-wider">{group.city}</span>
                          <span className="text-[10px] text-stone-400">
                            {group.areas.length} {group.areas.length === 1 ? 'barangay' : 'barangays'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
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

              {/* View All Mode */}
              {selectedScheduleId === 'all' && (
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-0.5">
                  {todaySchedules.map(schedule => (
                    <div key={schedule.id} className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                        <span className="font-mono text-xs font-bold text-stone-900">{schedule.timeWindow}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedScheduleId(schedule.id)}
                          className="text-xs font-mono text-amber-700 underline cursor-pointer touch-manipulation"
                        >
                          Focus
                        </button>
                      </div>
                      {schedule.areasByCity.map(group => (
                        <div key={group.city} className="space-y-1">
                          <span className="text-[10px] font-mono font-bold uppercase text-stone-500">{group.city}</span>
                          <div className="flex flex-wrap gap-1.5">
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

        {/* =================================================================== */}
        {/* 3. OFFICIAL ADVISORY BANNER                                         */}
        {/* =================================================================== */}
        {advisory && (
          <section className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="absolute left-0 top-0 h-full w-1 bg-amber-500" />

            <div className="p-5 sm:p-6 pl-6 sm:pl-7">
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-[10px] sm:text-xs uppercase tracking-wide text-stone-500">
                      <div className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                        <span>Official Advisory</span>
                      </div>

                      <span className="text-stone-300">/</span>

                      <span className="font-semibold text-stone-700">
                        {advisory.source || 'Visayan Electric'}
                      </span>

                      <span className="hidden sm:inline text-stone-300">/</span>

                      <span className="w-full sm:w-auto">
                        {formatDateRange(advisory.startDate, advisory.endDate)}
                      </span>
                    </div>

                    <h3 className="max-w-3xl font-serif text-xl sm:text-2xl lg:text-[26px] leading-tight font-normal tracking-tight text-stone-950">
                      {advisory.title}
                    </h3>
                  </div>

                  <div className="hidden sm:flex shrink-0 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Advisory
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-stone-100 pt-4">
                  <p className="font-mono text-[10px] sm:text-xs text-stone-400">
                    Information sourced from the official utility provider.
                  </p>

                  {advisory.sourceUrl && (
                    <a
                      href={advisory.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-white transition-all hover:bg-stone-800 active:scale-[0.98]"
                    >
                      <span>View Official Post</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-stone-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}