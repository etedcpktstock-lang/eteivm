/**
 * 🗺️ ResultsMapModal
 * แสดงแผนที่ร้านค้าบริเวณใกล้เคียงด้วย Leaflet (npm package)
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { X, MapPin, Filter, RotateCcw, ChevronRight, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ✅ Fix Vite/Webpack breaking Leaflet's default icon asset paths
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  customers: any[];
  userLocation: { lat: number; lng: number } | null;
  onSelectCustomer: (customer: any) => void;
  thaiAddressData?: any[];
}

// ─────────────────────────────────────────────
// Haversine distance (km)
// ─────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────
// Custom Icons
// ─────────────────────────────────────────────
const userIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:#3b82f6;border:3px solid white;
    box-shadow:0 0 0 4px rgba(59,130,246,0.25),0 2px 8px rgba(0,0,0,0.2);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function makeShopIcon() {
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="#10b981" stroke="white" stroke-width="2"/>
      <text x="14" y="19" text-anchor="middle" font-size="13" fill="white" font-family="system-ui">🏪</text>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  });
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
const ResultsMapModal: React.FC<Props> = ({
  isOpen,
  onClose,
  customers,
  userLocation,
  onSelectCustomer,
  thaiAddressData = [],
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filterRadius, setFilterRadius] = useState<number | null>(20);
  const [selProvince, setSelProvince] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [selDistrict, setSelDistrict] = useState('');

  // ── Derived area lists ──────────────────────
  const districts = useMemo(() => {
    const p = thaiAddressData.find((x: any) => x.name_th === selProvince);
    return p ? p.amphure.map((a: any) => a.name_th) : [];
  }, [selProvince, thaiAddressData]);

  // ── Filtered shops ─────────────────────────
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      if (isNaN(lat) || isNaN(lng)) return false;

      if (filterRadius && userLocation) {
        if (haversine(userLocation.lat, userLocation.lng, lat, lng) > filterRadius) return false;
      }
      if (selProvince && c.province !== selProvince) return false;
      if (selDistrict && c.district !== selDistrict) return false;
      return true;
    });
  }, [customers, filterRadius, userLocation, selProvince, selDistrict]);

  // ── 1. Create map once when modal opens ────
  useEffect(() => {
    if (!isOpen) return;

    // Always wait one tick so the container div is painted
    const t = setTimeout(() => {
      if (!mapContainerRef.current) return;
      // Safety: if somehow a stale map exists, destroy it first
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }

      const center: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lng]
        : [7.8804, 98.3923];

      const map = L.map(mapContainerRef.current, {
        center,
        zoom: 12,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // Signal that map is ready → triggers marker effect
      setTimeout(() => {
        map.invalidateSize();
        setMapReady(true);
      }, 150);
    }, 50);

    return () => clearTimeout(t);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Update markers when map is ready or data changes ────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!isOpen || !mapReady || !map || !layer) return;

    // Clear everything
    layer.clearLayers();
    if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }
    if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }

    const bounds = L.latLngBounds([]);

    // User position
    if (userLocation) {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .bindPopup('<b style="font-family:sans-serif;font-size:13px;">📍 คุณอยู่ที่นี่</b>', { closeButton: false })
        .addTo(map);
      bounds.extend([userLocation.lat, userLocation.lng]);

      if (filterRadius) {
        circleRef.current = L.circle([userLocation.lat, userLocation.lng], {
          radius: filterRadius * 1000,
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.06,
          weight: 2,
          dashArray: '8 5',
        }).addTo(map);
      }
    }

    // Shop markers
    console.log('[ResultsMapModal] Rendering', filteredCustomers.length, 'shop markers');
    let added = 0;
    filteredCustomers.forEach((c) => {
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('[ResultsMapModal] Skip - invalid coords:', c.cv, c.lat, c.lng);
        return;
      }

      const distKm = userLocation
        ? haversine(userLocation.lat, userLocation.lng, lat, lng).toFixed(1)
        : null;

      // Use circleMarker (pure SVG, no icon files needed)
      const cm = L.circleMarker([lat, lng], {
        radius: 10,
        color: '#fff',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 1,
      }).addTo(layer!);

      const popupEl = document.createElement('div');
      popupEl.style.cssText = 'font-family:system-ui,sans-serif;padding:4px 0;min-width:180px;';
      popupEl.innerHTML = `
        <p style="margin:0 0 2px;font-weight:900;font-size:14px;color:#0f172a;">${c.name || '—'}</p>
        <p style="margin:0 0 10px;font-size:11px;color:#64748b;font-weight:600;">
          CV: ${c.cv}${distKm ? ` &nbsp;·&nbsp; ${distKm} กม.` : ''}
        </p>
        <button id="pick-${c.cv}" style="
          display:block;width:100%;padding:9px 0;
          background:#0b1b32;color:#fff;border:none;
          border-radius:10px;font-weight:800;font-size:11px;
          text-transform:uppercase;letter-spacing:1px;cursor:pointer;
        ">เลือกเพื่อสำรวจ</button>
      `;

      cm.bindPopup(L.popup({ closeButton: false, maxWidth: 220 }).setContent(popupEl));
      cm.on('popupopen', () => {
        const btn = document.getElementById(`pick-${c.cv}`);
        if (btn) btn.onclick = () => { onSelectCustomer(c); onClose(); };
      });

      bounds.extend([lat, lng]);
      added++;
    });
    console.log('[ResultsMapModal] Added', added, 'markers to layer');

    // Also add shop markers to map directly as a fallback test
    console.log('[ResultsMapModal] layer has', layer.getLayers().length, 'layers');

    // Fit map to markers
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
    }

    map.invalidateSize();
  }, [isOpen, mapReady, filteredCustomers, userLocation, filterRadius, onSelectCustomer, onClose]);

  // ── 3. Destroy map on unmount ───────────────
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // ── 4. Destroy map + reset filters when closed ────
  useEffect(() => {
    if (!isOpen) {
      // CRITICAL: destroy map before React unmounts the container div
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
      setShowFilters(false);
      setFilterRadius(20);
      setSelProvince('');
      setSelDistrict('');
      setMapReady(false);
    }
  }, [isOpen]);

  const resetFilters = useCallback(() => {
    setFilterRadius(20);
    setSelProvince('');
    setSelDistrict('');
  }, []);

  if (!isOpen) return null;

  const hasFilter = filterRadius !== null || !!selProvince;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#000' }}>
      {/* ── Header ──────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-4"
        style={{ background: '#0b1b32' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.15)' }}>
            <MapPin size={18} color="#60a5fa" />
          </div>
          <div>
            <h2 className="text-[15px] font-black text-white leading-none tracking-tight uppercase">
              Nearby Shops Map
            </h2>
            <p className="text-[10px] font-bold mt-0.5 tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              แสดง {filteredCustomers.length} จาก {customers.filter(c => !isNaN(parseFloat(c.lat))).length} ร้าน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-2 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
            style={{
              height: 36,
              background: showFilters ? '#10b981' : 'rgba(255,255,255,0.1)',
              color: showFilters ? '#fff' : 'rgba(255,255,255,0.7)',
            }}
          >
            <Filter size={13} />
            ตัวกรอง{hasFilter ? ' ●' : ''}
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full transition-all"
            style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Map + Filter Overlay ─────────────── */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>

        {/* Leaflet map — explicit inset-0 with real pixel dimensions */}
        <div
          ref={mapContainerRef}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1,
          }}
        />

        {/* Filter Side Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="absolute top-0 right-0 bottom-0 overflow-y-auto"
              style={{
                width: '100%',
                maxWidth: 320,
                background: 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(20px)',
                borderLeft: '1px solid rgba(0,0,0,0.06)',
                zIndex: 100,
                padding: 24,
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">
                  ตัวกรอง
                </h3>
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-[10px] font-black text-rose-500 uppercase"
                >
                  <RotateCcw size={11} /> ล้างทั้งหมด
                </button>
              </div>

              {/* Radius */}
              <div className="mb-6">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  รัศมีรอบตัว{filterRadius ? ` (${filterRadius} กม.)` : ''}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 10, 20, 30, 50].map((r) => (
                    <button
                      key={r}
                      onClick={() => setFilterRadius(r)}
                      className="h-10 rounded-xl text-[12px] font-black transition-all"
                      style={{
                        background: filterRadius === r ? '#0b1b32' : '#f8fafc',
                        color: filterRadius === r ? '#fff' : '#64748b',
                        border: filterRadius === r ? 'none' : '1px solid #e2e8f0',
                      }}
                    >
                      {r} กม.
                    </button>
                  ))}
                  <button
                    onClick={() => setFilterRadius(null)}
                    className="h-10 rounded-xl text-[12px] font-black transition-all"
                    style={{
                      background: filterRadius === null ? '#0b1b32' : '#f8fafc',
                      color: filterRadius === null ? '#fff' : '#64748b',
                      border: filterRadius === null ? 'none' : '1px solid #e2e8f0',
                    }}
                  >
                    ทั้งหมด
                  </button>
                </div>
              </div>

              <div className="h-px bg-slate-100 mb-6" />

              {/* Province / District */}
              <div className="space-y-3 mb-8">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  ขอบเขตพื้นที่
                </label>
                <select
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none"
                  value={selProvince}
                  onChange={(e) => { setSelProvince(e.target.value); setSelDistrict(''); }}
                >
                  <option value="">-- จังหวัด --</option>
                  {thaiAddressData.map((p: any) => (
                    <option key={p.name_th} value={p.name_th}>{p.name_th}</option>
                  ))}
                </select>
                <select
                  disabled={!selProvince}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none disabled:opacity-40"
                  value={selDistrict}
                  onChange={(e) => setSelDistrict(e.target.value)}
                >
                  <option value="">-- อำเภอ --</option>
                  {districts.map((d: string) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowFilters(false)}
                className="w-full font-black text-[13px] uppercase tracking-widest text-white rounded-2xl flex items-center justify-center gap-2 transition-all"
                style={{ height: 52, background: '#0b1b32' }}
              >
                ดูผลลัพธ์ ({filteredCustomers.length}) <ChevronRight size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* "No location" notice */}
        {!userLocation && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full text-[11px] font-bold"
            style={{ background: 'rgba(15,23,42,0.85)', color: '#94a3b8', backdropFilter: 'blur(8px)', zIndex: 50 }}
          >
            <Navigation size={13} />
            ยังไม่ได้เปิด GPS · แสดงร้านค้าทั้งหมดในระบบ
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3"
        style={{ background: '#fff', borderTop: '1px solid #f1f5f9' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#3b82f6', border: '2px solid #fff', boxShadow: '0 0 0 2px #bfdbfe' }} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">ตำแหน่งคุณ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#10b981', border: '2px solid #fff', boxShadow: '0 0 0 2px #a7f3d0' }} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">ร้านค้า</span>
          </div>
        </div>
        <div
          className="px-4 py-1.5 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest"
          style={{ background: '#f8fafc' }}
        >
          {filteredCustomers.length} / {customers.length} ร้าน
        </div>
      </div>
    </div>
  );
};

export default React.memo(ResultsMapModal);
