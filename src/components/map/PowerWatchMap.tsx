import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Plus,
  Minus,
  Crosshair,
  Maximize2,
  Minimize2,
  Navigation
} from 'lucide-react';
import { Area, BrownoutSchedule, BrownoutPost } from '../../types';
import { formatDate, getScheduleTimeStatus } from '../../utils/formatters';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface MapAreaSchedule {
  area: Area;
  schedules: {
    schedule: BrownoutSchedule;
    post?: BrownoutPost;
    timeWindow?: string;
  }[];
}

export interface PowerWatchMapProps {
  affectedAreas: MapAreaSchedule[];
  selectedAreaId?: string | null;
  onSelectArea?: (areaId: string) => void;
  height?: string;
  focusCoordinates?: [number, number] | null;
}

// =============================================================================
// METRO CEBU PRESET COORDINATES
// =============================================================================

const CITY_COORDINATES: Record<string, { center: [number, number]; zoom: number }> = {
  'All Cebu': { center: [10.3157, 123.8854], zoom: 12 },
  'Cebu City': { center: [10.3157, 123.8854], zoom: 13 },
  'Mandaue City': { center: [10.3321, 123.9357], zoom: 13 },
  'Talisay City': { center: [10.2555, 123.8398], zoom: 13 },
  'Consolacion': { center: [10.3783, 123.9575], zoom: 13 },
  'Liloan': { center: [10.4042, 123.9786], zoom: 13 },
  'Minglanilla': { center: [10.2444, 123.7963], zoom: 13 },
  'City of Naga': { center: [10.2072, 123.7578], zoom: 13 },
  'San Fernando': { center: [10.1622, 123.7094], zoom: 13 }
};

// OpenStreetMap: 100% Free, Public Domain, No API Key or Account Required
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// =============================================================================
// COMPONENT IMPLEMENTATION
// =============================================================================

export function PowerWatchMap({
  affectedAreas,
  selectedAreaId,
  onSelectArea,
  height = '580px',
  focusCoordinates
}: PowerWatchMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.CircleMarker>>({});
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  const [activeCityPill, setActiveCityPill] = useState<string>('All Cebu');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Calculate active vs upcoming brownouts count
  const stats = useMemo(() => {
    let ongoingCount = 0;
    let upcomingCount = 0;

    affectedAreas.forEach(item => {
      let isOngoing = false;
      let isUpcoming = false;
      item.schedules.forEach(s => {
        const st = getScheduleTimeStatus(
          s.schedule.scheduleDate,
          s.schedule.startTime,
          s.schedule.endTime
        );
        if (st === 'ongoing') isOngoing = true;
        if (st === 'upcoming') isUpcoming = true;
      });
      if (isOngoing) ongoingCount++;
      else if (isUpcoming) upcomingCount++;
    });

    return {
      total: affectedAreas.length,
      ongoing: ongoingCount,
      upcoming: upcomingCount
    };
  }, [affectedAreas]);

  // ---------------------------------------------------------------------------
  // 1. Initialize Map with Pure OpenStreetMap (Zero API Keys)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = [10.3157, 123.8854];
    const defaultZoom = 12;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      scrollWheelZoom: true,
      attributionControl: false
    });

    // Add Attribution Control in bottom right
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    // Standard OpenStreetMap Tiles
    L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
      minZoom: 9
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Render Vector Markers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    const bounds = L.latLngBounds([]);

    affectedAreas.forEach(({ area, schedules }) => {
      if (!area.latitude || !area.longitude) return;

      const isSelected = selectedAreaId === area.id;

      let hasOngoing = false;
      let hasUpcoming = false;
      schedules.forEach(s => {
        const st = getScheduleTimeStatus(
          s.schedule.scheduleDate,
          s.schedule.startTime,
          s.schedule.endTime
        );
        if (st === 'ongoing') hasOngoing = true;
        if (st === 'upcoming') hasUpcoming = true;
      });

      // Amber/Yellow civic palette
      let fillColor = '#f59e0b';
      let strokeColor = '#ffffff';
      let radius = 7;
      let strokeWidth = 2;
      let fillOpacity = 0.9;

      if (hasOngoing) {
        fillColor = '#d97706';
        radius = 9;
        strokeWidth = 2.5;
        strokeColor = '#fef3c7';
      }

      if (isSelected) {
        fillColor = '#f59e0b';
        strokeColor = '#0f172a';
        radius = 12;
        strokeWidth = 3.5;
        fillOpacity = 1;
      }

      const marker = L.circleMarker([area.latitude, area.longitude], {
        radius,
        fillColor,
        fillOpacity,
        color: strokeColor,
        weight: strokeWidth
      });

      const schedulesListHtml = schedules
        .map(s => {
          const st = getScheduleTimeStatus(
            s.schedule.scheduleDate,
            s.schedule.startTime,
            s.schedule.endTime
          );
          const isCurrentWindow = st === 'ongoing';

          return `
            <div style="padding: 6px 8px; margin-bottom: 4px; border-radius: 6px; font-size: 11px; display: flex; justify-content: space-between; font-family: monospace; ${
              isCurrentWindow
                ? 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;'
                : 'background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0;'
            }">
              <span>${s.schedule.scheduleDate ? formatDate(s.schedule.scheduleDate) : 'Today'}</span>
              <strong>${s.schedule.startTime} – ${s.schedule.endTime}</strong>
            </div>
          `;
        })
        .join('');

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 220px; color: #0f172a; padding: 4px;">
          <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
            <div style="font-size: 10px; text-transform: uppercase; font-family: monospace; color: #64748b;">${area.city}</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 2px 0;">${area.name}</div>
            <div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-family: monospace; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; font-weight: 600;">
              Possible Rotational Brownout
            </div>
          </div>

          <div style="margin-bottom: 6px;">
            <div style="font-size: 10px; font-family: monospace; color: #64748b; text-transform: uppercase; margin-bottom: 4px; display: flex; justify-content: space-between;">
              <span>Time Windows</span>
              <span>${schedules.length} window${schedules.length > 1 ? 's' : ''}</span>
            </div>
            <div style="max-height: 120px; overflow-y: auto;">
              ${schedulesListHtml}
            </div>
          </div>

          <div style="font-size: 10px; font-family: monospace; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px; display: flex; justify-content: space-between;">
            <span>Visayan Electric</span>
            <span style="color: ${hasOngoing ? '#b45309' : '#64748b'}; font-weight: 600;">
              ${hasOngoing ? '• Active Now' : 'Scheduled'}
            </span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 280 });

      marker.bindTooltip(`${area.name} (${area.city})`, {
        direction: 'top',
        offset: [0, -6],
        opacity: 0.95
      });

      marker.on('click', () => {
        if (onSelectArea) {
          onSelectArea(area.id);
        }
      });

      marker.addTo(map);
      markersRef.current[area.id] = marker;
      bounds.extend([area.latitude, area.longitude]);
    });

    if (affectedAreas.length > 0 && !selectedAreaId && !focusCoordinates) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [affectedAreas, selectedAreaId, onSelectArea]);

  // ---------------------------------------------------------------------------
  // 3. Focus & Fly Animation
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (focusCoordinates) {
      map.flyTo(focusCoordinates, 14, { duration: 1.1 });
    } else if (selectedAreaId && markersRef.current[selectedAreaId]) {
      const marker = markersRef.current[selectedAreaId];
      const latLng = marker.getLatLng();
      map.flyTo(latLng, 14, { duration: 1 });
      marker.openPopup();
    }
  }, [selectedAreaId, focusCoordinates]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 200);
    }
  }, [isFullscreen, height]);

  // Actions
  const handleCityJump = (city: string) => {
    setActiveCityPill(city);
    const map = mapInstanceRef.current;
    if (!map) return;

    const target = CITY_COORDINATES[city];
    if (target) {
      map.flyTo(target.center, target.zoom, { duration: 1.1 });
    }
  };

  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setActiveCityPill('All Cebu');
    map.flyTo([10.3157, 123.8854], 12, { duration: 1 });
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationStatus('Locating device...');

    navigator.geolocation.getCurrentPosition(
      pos => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        const map = mapInstanceRef.current;
        if (!map) return;

        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
        }

        const userMarker = L.circleMarker([latitude, longitude], {
          radius: 8,
          fillColor: '#2563eb',
          fillOpacity: 1,
          color: '#ffffff',
          weight: 2
        });

        userMarker.bindPopup(`
          <div style="font-family: monospace; font-size: 11px; padding: 4px;">
            <strong>Your Location</strong><br/>
            ${latitude.toFixed(4)}, ${longitude.toFixed(4)}
          </div>
        `).openPopup();

        userMarker.addTo(map);
        userMarkerRef.current = userMarker;

        map.flyTo([latitude, longitude], 14, { duration: 1.2 });
        setLocationStatus(null);
      },
      err => {
        setIsLocating(false);
        setLocationStatus('Could not access device location.');
        setTimeout(() => setLocationStatus(null), 3000);
      },
      { timeout: 8000 }
    );
  };

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border border-neutral-300 bg-neutral-100 transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : ''
      }`}
    >
      {/* Municipality Quick Jump Bar */}
      <nav
        aria-label="Municipality quick jump"
        className="absolute top-3 left-3 right-16 z-[400] flex items-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto pr-2"
      >
        {Object.keys(CITY_COORDINATES).map(city => (
          <button
            key={city}
            type="button"
            onClick={() => handleCityJump(city)}
            className={`text-xs font-mono px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all backdrop-blur-md cursor-pointer ${
              activeCityPill === city
                ? 'bg-neutral-900 text-white shadow-xs font-medium'
                : 'bg-white/90 hover:bg-white text-neutral-700 border border-neutral-200 shadow-2xs'
            }`}
          >
            {city}
          </button>
        ))}
      </nav>

      {/* Floating Control Toolbar (No Layer Switcher) */}
      <aside
        aria-label="Map controls"
        className="absolute top-3 right-3 z-[400] flex flex-col items-center gap-1.5 pointer-events-auto"
      >
        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? 'Exit Fullscreen' : 'Expand Map'}
          className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-neutral-800 border border-neutral-200 flex items-center justify-center shadow-xs cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Zoom Controls */}
        <div className="flex flex-col rounded-lg border border-neutral-200 bg-white/95 backdrop-blur-md overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            title="Zoom In"
            className="w-8 h-8 flex items-center justify-center text-neutral-800 hover:bg-neutral-100 border-b border-neutral-100 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            title="Zoom Out"
            className="w-8 h-8 flex items-center justify-center text-neutral-800 hover:bg-neutral-100 cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Recenter Metro Cebu */}
        <button
          type="button"
          onClick={handleResetView}
          title="Reset to Metro Cebu"
          className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-neutral-800 border border-neutral-200 flex items-center justify-center shadow-xs cursor-pointer"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {/* Geolocation */}
        <button
          type="button"
          onClick={handleLocateMe}
          title="Locate Me"
          disabled={isLocating}
          className={`w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-neutral-800 border border-neutral-200 flex items-center justify-center shadow-xs cursor-pointer ${
            isLocating ? 'animate-pulse text-blue-600' : ''
          }`}
        >
          <Navigation className="w-4 h-4" />
        </button>
      </aside>

      {/* Geolocation Feedback Toast */}
      {locationStatus && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[400] bg-neutral-900 text-white text-xs font-mono px-3 py-1.5 rounded-lg shadow-md pointer-events-auto">
          {locationStatus}
        </div>
      )}

      {/* Leaflet DOM Node */}
      <div
        ref={mapContainerRef}
        style={{ height: isFullscreen ? '100vh' : height, width: '100%' }}
        className="z-0"
      />

      {/* Bottom Status Bar & Legend */}
      <footer
        aria-label="Legend and live summary"
        className="absolute bottom-3 left-3 z-[400] pointer-events-auto bg-white/90 backdrop-blur-md rounded-xl border border-neutral-200/80 px-3 py-2 shadow-xs text-xs font-mono flex items-center gap-3 text-neutral-600"
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block ring-2 ring-amber-200" />
          <span className="text-neutral-900 font-medium">{stats.total}</span>
          <span className="text-neutral-500">affected areas</span>
        </div>

        {stats.ongoing > 0 && (
          <>
            <span className="text-neutral-200">|</span>
            <div className="flex items-center gap-1.5 text-neutral-900 font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-600 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600"></span>
              </span>
              <span>{stats.ongoing} active now</span>
            </div>
          </>
        )}

        <span className="text-neutral-200">|</span>
        
      </footer>
    </div>
  );
}