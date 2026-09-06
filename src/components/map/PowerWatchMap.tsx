import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import {
  Plus,
  Minus,
  Crosshair,
  Maximize2,
  Minimize2,
  Navigation,
  AlertCircle,
  Zap
} from 'lucide-react';
import { Area, BrownoutSchedule, BrownoutPost } from '../../types';
import { formatDate, getScheduleTimeStatus } from '../../utils/formatters';

// =============================================================================
// TYPES & CONSTANTS
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

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

// Helper to create custom electric marker icons
const createElectricMarkerIcon = (isOngoing: boolean, isSelected: boolean) => {
  const size = isSelected ? 34 : isOngoing ? 30 : 26;
  const iconSize = isSelected ? 17 : isOngoing ? 15 : 13;

  const bgClass = isSelected
    ? 'bg-stone-900 text-amber-400 ring-3 ring-amber-400/80 shadow-lg scale-110'
    : isOngoing
    ? 'bg-amber-500 text-white ring-2 ring-white shadow-md'
    : 'bg-stone-800/90 text-amber-300 ring-1.5 ring-white/90 shadow-sm hover:scale-105';

  return L.divIcon({
    className: 'powerwatch-electric-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
    html: `
      <div class="marker-wrapper relative flex items-center justify-center w-full h-full cursor-pointer transition-transform">
        ${
          isOngoing
            ? '<span class="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60 animate-ping"></span>'
            : ''
        }
        <div class="relative flex items-center justify-center w-full h-full rounded-full ${bgClass}">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="${iconSize}"
            height="${iconSize}"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
      </div>
    `
  });
};

// =============================================================================
// COMPONENT
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
  const markersRef = useRef<Record<string, L.Marker>>({});
  const userMarkerGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeCityPill, setActiveCityPill] = useState<string>('All Cebu');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Compute stats
  const stats = useMemo(() => {
    let ongoing = 0;
    let upcoming = 0;

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
      if (isOngoing) ongoing++;
      else if (isUpcoming) upcoming++;
    });

    return {
      total: affectedAreas.length,
      ongoing,
      upcoming
    };
  }, [affectedAreas]);

  // Esc key closes fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [10.3157, 123.8854],
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    L.control
      .attribution({
        position: 'bottomright',
        prefix: false
      })
      .addTo(map);

    L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
      minZoom: 9
    }).addTo(map);

    userMarkerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render Electric Icon Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    const bounds = L.latLngBounds([]);

    affectedAreas.forEach(({ area, schedules }) => {
      if (!area.latitude || !area.longitude) return;

      const isSelected = selectedAreaId === area.id;

      const hasOngoing = schedules.some(
        s =>
          getScheduleTimeStatus(
            s.schedule.scheduleDate,
            s.schedule.startTime,
            s.schedule.endTime
          ) === 'ongoing'
      );

      // Create Custom Electric Icon
      const customIcon = createElectricMarkerIcon(hasOngoing, isSelected);

      const marker = L.marker([area.latitude, area.longitude], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : hasOngoing ? 500 : 0
      });

      const schedulesListHtml = schedules
        .map(s => {
          const isCurrentWindow =
            getScheduleTimeStatus(
              s.schedule.scheduleDate,
              s.schedule.startTime,
              s.schedule.endTime
            ) === 'ongoing';

          return `
            <div class="schedule-row ${isCurrentWindow ? 'active' : ''}">
              <span>${s.schedule.scheduleDate ? formatDate(s.schedule.scheduleDate) : 'Today'}</span>
              <strong class="font-mono">${s.schedule.startTime}–${s.schedule.endTime}</strong>
            </div>
          `;
        })
        .join('');

      const popupHtml = `
        <div class="pw-popup">
          <div class="pw-popup-header">
            <div class="pw-popup-city">${area.city}</div>
            <div class="pw-popup-title">${area.name}</div>
            <span class="pw-popup-badge ${hasOngoing ? 'badge-alert' : 'badge-scheduled'}">
              ${hasOngoing ? '⚡ ACTIVE BROWNOUT' : 'SCHEDULED'}
            </span>
          </div>

          <div class="pw-popup-body">
            <div class="pw-popup-sublabel">
              <span>Time Windows</span>
              <span>${schedules.length} window${schedules.length > 1 ? 's' : ''}</span>
            </div>
            <div class="pw-popup-list">
              ${schedulesListHtml}
            </div>
          </div>

          <div class="pw-popup-footer">
            <span>Visayan Electric</span>
            <span class="status-indicator ${hasOngoing ? 'text-amber' : ''}">
              ${hasOngoing ? 'Active Now' : 'Upcoming'}
            </span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        maxWidth: 290,
        className: 'powerwatch-custom-popup',
        closeButton: true
      });

      marker.bindTooltip(`${area.name} (${area.city})`, {
        direction: 'top',
        offset: [0, -14],
        opacity: 0.95,
        className: 'powerwatch-tooltip'
      });

      marker.on('click', () => {
        onSelectArea?.(area.id);
      });

      marker.addTo(map);
      markersRef.current[area.id] = marker;
      bounds.extend([area.latitude, area.longitude]);
    });

    if (affectedAreas.length > 0 && !selectedAreaId && !focusCoordinates) {
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 13 });
    }
  }, [affectedAreas, selectedAreaId, onSelectArea]);

  // 3. Focus and Coordinates Reaction
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

  // Resize handler
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [isFullscreen, height]);

  // Handlers
  const handleCityJump = useCallback((city: string) => {
    setActiveCityPill(city);
    const target = CITY_COORDINATES[city];
    if (mapInstanceRef.current && target) {
      mapInstanceRef.current.flyTo(target.center, target.zoom, { duration: 1 });
    }
  }, []);

  const handleResetView = useCallback(() => {
    setActiveCityPill('All Cebu');
    mapInstanceRef.current?.flyTo([10.3157, 123.8854], 12, { duration: 1 });
  }, []);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported by browser.');
      return;
    }

    setIsLocating(true);
    setLocationStatus('Locating device...');

    navigator.geolocation.getCurrentPosition(
      pos => {
        setIsLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        const map = mapInstanceRef.current;
        if (!map || !userMarkerGroupRef.current) return;

        userMarkerGroupRef.current.clearLayers();

        // Accuracy radius
        L.circle([latitude, longitude], {
          radius: Math.min(accuracy, 500),
          color: '#3b82f6',
          weight: 1,
          fillColor: '#60a5fa',
          fillOpacity: 0.15
        }).addTo(userMarkerGroupRef.current);

        // Core marker
        const userMarker = L.circleMarker([latitude, longitude], {
          radius: 7,
          fillColor: '#2563eb',
          fillOpacity: 1,
          color: '#ffffff',
          weight: 2.5
        }).addTo(userMarkerGroupRef.current);

        userMarker
          .bindPopup(`<div class="font-mono text-xs p-1"><strong>Your Location</strong></div>`, {
            className: 'powerwatch-custom-popup'
          })
          .openPopup();

        map.flyTo([latitude, longitude], 14, { duration: 1.2 });
        setLocationStatus(null);
      },
      () => {
        setIsLocating(false);
        setLocationStatus('Could not access device location.');
        setTimeout(() => setLocationStatus(null), 3000);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-stone-200/80 bg-stone-100 transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : ''
      }`}
    >
      {/* Municipality Navigation */}
      <div className="absolute top-3.5 left-3.5 right-14 z-[400] pointer-events-none flex items-center">
        <nav
          aria-label="Municipality navigation"
          className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 pr-4 max-w-full [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {Object.keys(CITY_COORDINATES).map(city => (
            <button
              key={city}
              type="button"
              onClick={() => handleCityJump(city)}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg whitespace-nowrap transition-all shadow-2xs backdrop-blur-md cursor-pointer ${
                activeCityPill === city
                  ? 'bg-stone-900 text-white font-semibold shadow-xs'
                  : 'bg-white/90 hover:bg-white text-stone-700 hover:text-stone-900 border border-stone-200/90'
              }`}
            >
              {city}
            </button>
          ))}
        </nav>
      </div>

      {/* Floating Map Controls */}
      <aside
        aria-label="Map tools"
        className="absolute top-3.5 right-3.5 z-[400] flex flex-col items-center gap-2 pointer-events-auto"
      >
        <button
          type="button"
          onClick={() => setIsFullscreen(prev => !prev)}
          title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-stone-700 hover:text-stone-900 border border-stone-200/90 flex items-center justify-center shadow-xs cursor-pointer transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <div className="flex flex-col rounded-lg border border-stone-200/90 bg-white/95 backdrop-blur-md overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            title="Zoom In"
            aria-label="Zoom In"
            className="w-8 h-8 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:bg-stone-100/80 border-b border-stone-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="w-8 h-8 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:bg-stone-100/80 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleResetView}
          title="Reset to Metro Cebu"
          aria-label="Reset View"
          className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-stone-700 hover:text-stone-900 border border-stone-200/90 flex items-center justify-center shadow-xs cursor-pointer transition-colors"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleLocateMe}
          title="Find my location"
          aria-label="Find my location"
          disabled={isLocating}
          className={`w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-stone-700 hover:text-stone-900 border border-stone-200/90 flex items-center justify-center shadow-xs cursor-pointer transition-colors ${
            isLocating ? 'animate-pulse text-blue-600' : ''
          }`}
        >
          <Navigation className="w-4 h-4" />
        </button>
      </aside>

      {/* Geolocation Notice Toast */}
      {locationStatus && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[400] bg-stone-900 text-white text-xs font-mono px-3 py-1.5 rounded-lg shadow-md pointer-events-auto flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>{locationStatus}</span>
        </div>
      )}

      {/* Leaflet Render Container */}
      <div
        ref={mapContainerRef}
        style={{ height: isFullscreen ? '100vh' : height, width: '100%' }}
        className="z-0"
      />

      {/* Bottom Status Bar & Icon Legend */}
      <footer
        aria-label="Live map stats and legend"
        className="absolute bottom-3.5 left-3.5 right-3.5 sm:right-auto z-[400] pointer-events-auto bg-white/95 backdrop-blur-md rounded-xl border border-stone-200/80 px-3.5 py-2 shadow-sm text-xs font-mono flex flex-wrap items-center justify-between sm:justify-start gap-x-4 gap-y-1.5 text-stone-600"
      >
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-2xs">
            <Zap className="w-2.5 h-2.5 fill-current" />
          </span>
          <span className="font-semibold text-stone-900">{stats.total}</span>
          <span>Affected Areas</span>
        </div>

        {stats.ongoing > 0 && (
          <div className="flex items-center gap-1.5 text-amber-900 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600" />
            </span>
            <span>{stats.ongoing} Active Now</span>
          </div>
        )}

        
      </footer>

      {/* Leaflet & Custom Marker Styles */}
      <style>{`
        /* Reset Leaflet divIcon square defaults */
        .powerwatch-electric-marker {
          background: transparent !important;
          border: none !important;
        }

        .powerwatch-custom-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(231, 229, 228, 0.9);
          overflow: hidden;
        }
        .powerwatch-custom-popup .leaflet-popup-content {
          margin: 0;
          line-height: 1.4;
        }
        .powerwatch-custom-popup .leaflet-popup-tip {
          background: #ffffff;
        }
        .powerwatch-tooltip {
          background: #1c1917 !important;
          border: none !important;
          color: #ffffff !important;
          font-family: ui-monospace, monospace !important;
          font-size: 11px !important;
          border-radius: 6px !important;
          padding: 3px 7px !important;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1) !important;
        }
        .powerwatch-tooltip::before {
          border-top-color: #1c1917 !important;
        }
        .pw-popup {
          font-family: system-ui, -apple-system, sans-serif;
          color: #1c1917;
          min-width: 230px;
        }
        .pw-popup-header {
          padding: 12px 14px 10px;
          border-bottom: 1px solid #f5f5f4;
          background: #fafaf9;
        }
        .pw-popup-city {
          font-size: 10px;
          font-family: ui-monospace, monospace;
          color: #78716c;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        .pw-popup-title {
          font-size: 15px;
          font-weight: 700;
          color: #1c1917;
          margin: 1px 0 6px;
        }
        .pw-popup-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-family: ui-monospace, monospace;
          font-weight: 700;
          letter-spacing: 0.03em;
        }
        .badge-alert {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fcd34d;
        }
        .badge-scheduled {
          background: #f5f5f4;
          color: #57534e;
          border: 1px solid #e7e5e4;
        }
        .pw-popup-body {
          padding: 10px 14px;
        }
        .pw-popup-sublabel {
          font-size: 10px;
          font-family: ui-monospace, monospace;
          color: #78716c;
          text-transform: uppercase;
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .pw-popup-list {
          max-height: 120px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .schedule-row {
          padding: 5px 8px;
          border-radius: 6px;
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          font-family: ui-monospace, monospace;
          background: #f5f5f4;
          color: #44403c;
          border: 1px solid #e7e5e4;
        }
        .schedule-row.active {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
          font-weight: 600;
        }
        .pw-popup-footer {
          font-size: 10px;
          font-family: ui-monospace, monospace;
          color: #a8a29e;
          background: #fafaf9;
          border-top: 1px solid #f5f5f4;
          padding: 8px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .text-amber {
          color: #b45309;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}