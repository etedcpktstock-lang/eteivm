import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, Navigation, MapPin, Store, Filter, RotateCcw, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResultsMapModalProps {
 isOpen: boolean;
 onClose: () => void;
 customers: any[];
 userLocation: { lat: number, lng: number } | null;
 onSelectCustomer: (customer: any) => void;
 thaiAddressData?: any[];
}

// 📏 Haversine Distance Calculation
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
 const R = 6371; // km
 const dLat = (lat2 - lat1) * Math.PI / 180;
 const dLon = (lon2 - lon1) * Math.PI / 180;
 const a = 
 Math.sin(dLat/2) * Math.sin(dLat/2) +
 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
 Math.sin(dLon/2) * Math.sin(dLon/2);
 const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
 return R * c;
};

const ResultsMapModal: React.FC<ResultsMapModalProps> = ({ 
 isOpen, onClose, customers, userLocation, onSelectCustomer, thaiAddressData = []
}) => {
 const mapRef = useRef<HTMLDivElement>(null);
 const lMap = useRef<any>(null);
 const markersRef = useRef<any[]>([]);
 const circleRef = useRef<any>(null);

 // 📝 Filter States
 const [showFilters, setShowFilters] = useState(false);
 const [filterRadius, setFilterRadius] = useState<number | null>(null); // null = all
 const [selProvince, setSelProvince] = useState('');
 const [selDistrict, setSelDistrict] = useState('');
 const [selSubdistrict, setSelSubdistrict] = useState('');

 // 🌍 Derived Area Data
 const districts = useMemo(() => {
 if (!selProvince) return [];
 const p = thaiAddressData.find(prov => prov.name_th === selProvince);
 return p ? p.amphure.map((a: any) => a.name_th).sort() : [];
 }, [selProvince, thaiAddressData]);

 const subdistricts = useMemo(() => {
 if (!selDistrict || !selProvince) return [];
 const p = thaiAddressData.find(prov => prov.name_th === selProvince);
 if (!p) return [];
 const a = p.amphure.find((amp: any) => amp.name_th === selDistrict);
 return a ? a.tambon.map((t: any) => t.name_th).sort() : [];
 }, [selDistrict, selProvince, thaiAddressData]);

 // 🔍 Filtering Logic
 const filteredCustomers = useMemo(() => {
 return customers.filter(c => {
 // 1. Radius Filter (Priority)
 if (filterRadius && userLocation) {
 const cLat = parseFloat(c.lat);
 const cLng = parseFloat(c.lng);
 if (isNaN(cLat) || isNaN(cLng)) return false;
 const dist = getDistance(userLocation.lat, userLocation.lng, cLat, cLng);
 if (dist > filterRadius) return false;
 }

 // 2. Area Filters
 if (selProvince && c.province !== selProvince) return false;
 if (selDistrict && c.district !== selDistrict) return false;
 if (selSubdistrict && c.subdistrict !== selSubdistrict) return false;

 return true;
 });
 }, [customers, filterRadius, userLocation, selProvince, selDistrict, selSubdistrict]);

 // 🚀 Initialize Map and Draw Content
 useEffect(() => {
 if (!isOpen) return;

 // Load Leaflet if needed
 if (!(window as any).L) {
 if (!document.getElementById('leaflet-css')) {
 const link = document.createElement('link');
 link.id = 'leaflet-css';
 link.rel = 'stylesheet';
 link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
 document.head.appendChild(link);
 }
 if (!document.getElementById('leaflet-js')) {
 const script = document.createElement('script');
 script.id = 'leaflet-js';
 script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
 document.head.appendChild(script);
 }
 }

 const timer = setTimeout(() => {
 const L = (window as any).L;
 if (!L || !mapRef.current) return;

 if (!lMap.current) {
 const center = userLocation ? [userLocation.lat, userLocation.lng] : [7.8804, 98.3923];
 const map = L.map(mapRef.current, { zoomControl: false }).setView(center, 14);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(map);
 L.control.zoom({ position: 'topleft' }).addTo(map);
 lMap.current = map;
 }

 const map = lMap.current;

 // 🧹 Clear existing markers
 markersRef.current.forEach(m => m.remove());
 markersRef.current = [];
 if (circleRef.current) {
 circleRef.current.remove();
 circleRef.current = null;
 }

 // 🔵 User Marker
 if (userLocation) {
 const userIcon = L.divIcon({
 className: 'custom-div-icon',
 html:`<div style="background-color: #3b82f6; width: 15px; height: 15px; border-radius: 50%; border: 3px solid white; box-: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
 iconSize: [15, 15],
 iconAnchor: [7, 7]
 });
 const m = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map).bindPopup("คุณอยู่ที่นี่", { closeButton: false });
 markersRef.current.push(m);

 // 🟢 Radius Circle
 if (filterRadius) {
 circleRef.current = L.circle([userLocation.lat, userLocation.lng], {
 radius: filterRadius * 1000,
 color: '#10b981',
 fillColor: '#10b981',
 fillOpacity: 0.1,
 weight: 1
 }).addTo(map);
 }
 }

 // 🏪 Shop Markers
 const bounds = L.latLngBounds([]);
 if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);

 filteredCustomers.forEach((c) => {
 const cLat = parseFloat(c.lat);
 const cLng = parseFloat(c.lng);
 if (isNaN(cLat) || isNaN(cLng)) return;

 const shopIcon = L.divIcon({
 className: 'shop-div-icon',
 html:`<div style="background-color: #10b981; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; : rotate(-45deg); border: 2px solid white; display: flex; align-items: center; justify-center; box-: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
 <div style=": rotate(45deg); color: white; display: flex;"><span class="material-symbols-outlined" style="font-size: 18px;">store</span></div>
 </div>`,
 iconSize: [32, 32],
 iconAnchor: [16, 32]
 });

 const marker = L.marker([cLat, cLng], { icon: shopIcon }).addTo(map);
 
 const popupContent = document.createElement('div');
 popupContent.innerHTML =`
 <div style="padding: 10px; min-width: 160px; font-family: sans-serif;">
 <p style="margin: 0 0 4px 0; font-weight: 900; color: #1e293b; font-size: 14px;">${c.name}</p>
 <p style="margin: 0 0 10px 0; font-size: 10px; font-weight: bold; color: #64748b; opacity: 0.8; text-: uppercase;">CV: ${c.cv}</p>
 <button id="select-shop-${c.cv}" style="width: 100%; padding: 10px; background: #0b1b32; color: white; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 11px; text-: uppercase; letter-spacing: 1px;">เลือกเพื่อสำรวจ</button>
 </div>`;

 marker.bindPopup(popupContent, { closeButton: false });
 marker.on('popupopen', () => {
 const btn = document.getElementById(`select-shop-${c.cv}`);
 if (btn) btn.onclick = () => { onSelectCustomer(c); onClose(); };
 });

 bounds.extend([cLat, cLng]);
 markersRef.current.push(marker);
 });

 // 🎯 Auto-center
 if (filteredCustomers.length > 0 || userLocation) {
 map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
 }
 }, 400);

 return () => {
 clearTimeout(timer);
 };
 }, [isOpen, filteredCustomers, userLocation, filterRadius, onSelectCustomer, onClose]);

 // 🧹 Cleanup on full unmount
 useEffect(() => {
 return () => {
 if (lMap.current) {
 lMap.current.remove();
 lMap.current = null;
 }
 };
 }, []);

 if (!isOpen) return null;

 const resetFilters = () => {
 setFilterRadius(null);
 setSelProvince('');
 setSelDistrict('');
 setSelSubdistrict('');
 };

 return (
 <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-0 md:p-6">
 <div className="bg-white w-full h-full md:max-w-5xl md:h-[85vh] md:rounded-[3rem] flex flex-col overflow-hidden border border-white/20">
 
 {/* Header */}
 <div className="bg-[#0b1b32] p-6 text-white mobile-row flex items-center justify-between shrink-0 relative z-20">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20">
 <MapPin size={24} />
 </div>
 <div>
 <h2 className="text-xl font-black tracking-tight leading-none uppercase">Nearby Shops Map</h2>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-60">Visualizing {filteredCustomers.length} shops</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button 
 onClick={() => setShowFilters(!showFilters)}
 className={`flex items-center gap-2 h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest ${showFilters ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60'}`}
 >
 <Filter size={14} /> ตัวกรอง { (filterRadius || selProvince) ? '(เปิดอยู่)' : '' }
 </button>
 <button 
 onClick={onClose}
 className="btn no-animation w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
 >
 <X size={20} />
 </button>
 </div>
 </div>

 <div className="flex-1 w-full bg-slate-50 relative overflow-hidden">
 {/* 🔍 Filter Panel overlay */}
 <AnimatePresence>
 {showFilters && (
 <motion.div 
 initial={{ x: '100%' }} 
 animate={{ x: 0 }} 
 exit={{ x: '100%' }}
 className="absolute top-0 right-0 bottom-0 w-full sm:max-w-sm bg-white/95 z-[1000] border-l border-slate-100 p-6 overflow-y-auto"
 >
 <div className="mobile-row flex items-center justify-between mb-8">
 <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">ตั้งค่าตัวกรอง</h3>
 <button onClick={resetFilters} className="btn no-animation text-[10px] font-black text-rose-500 uppercase flex items-center gap-1">
 <RotateCcw size={12} /> ล้างทั้งหมด
 </button>
 </div>

 <div className="space-y-4">
 {/* Radius Filter */}
 <div className="space-y-3">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">รัศมีรอบตัวคุณ { filterRadius ?`(${filterRadius} กม.)` : '' }</label>
 <div className="grid grid-cols-3 gap-2">
 {[5, 10, 20, 30, 50].map(r => (
 <button 
 key={r} 
 onClick={() => setFilterRadius(r)}
 className={`h-10 rounded-xl text-[11px] font-black ${filterRadius === r ? 'bg-[#0b1b32] text-white' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
 >
 {r} กม.
 </button>
 ))}
 <button 
 onClick={() => setFilterRadius(null)}
 className={`h-10 rounded-xl text-[11px] font-black ${filterRadius === null ? 'bg-[#0b1b32] text-white' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
 >
 ทั้งหมด
 </button>
 </div>
 </div>

 <div className="h-px bg-slate-100" />

 {/* Area Filter */}
 <div className="space-y-4">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ขอบเขตพื้นที่</label>
 
 <div className="space-y-4">
 <div className="space-y-1.5">
 <span className="text-[9px] font-black text-slate-300 uppercase ml-1">จังหวัด</span>
 <select 
 className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold outline-none focus:border-emerald-500"
 value={selProvince}
 onChange={(e) => { setSelProvince(e.target.value); setSelDistrict(''); setSelSubdistrict(''); }}
 >
 <option value="">-- กรองจังหวัด --</option>
 {thaiAddressData.map(p => <option key={p.name_th} value={p.name_th}>{p.name_th}</option>)}
 </select>
 </div>

 <div className="space-y-1.5">
 <span className="text-[9px] font-black text-slate-300 uppercase ml-1">อำเภอ</span>
 <select 
 disabled={!selProvince}
 className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold outline-none focus:border-emerald-500 disabled:opacity-40"
 value={selDistrict}
 onChange={(e) => { setSelDistrict(e.target.value); setSelSubdistrict(''); }}
 >
 <option value="">-- กรองอำเภอ --</option>
 {districts.map(d => <option key={d} value={d}>{d}</option>)}
 </select>
 </div>

 <div className="space-y-1.5">
 <span className="text-[9px] font-black text-slate-300 uppercase ml-1">ตำบล</span>
 <select 
 disabled={!selDistrict}
 className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold outline-none focus:border-emerald-500 disabled:opacity-40"
 value={selSubdistrict}
 onChange={(e) => setSelSubdistrict(e.target.value)}
 >
 <option value="">-- กรองตำบล --</option>
 {subdistricts.map(t => <option key={t} value={t}>{t}</option>)}
 </select>
 </div>
 </div>
 </div>
 </div>

 <div className="mt-12">
 <button 
 onClick={() => setShowFilters(false)}
 className="w-full h-14 bg-[#0b1b32] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2"
 >
 ตกลงและดูผลลัพธ์ <ChevronRight size={18} />
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Map Area */}
 <div ref={mapRef} className="h-full w-full bg-slate-50 relative z-10" />

 {/* Map Overlay Loading */}
 {!lMap.current && (
 <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-20">
 <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full mb-4" />
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">กำลังโหลดพิกัดร้านค้า...</p>
 </div>
 )}
 </div>

 {/* Footer Info */}
 <div className="p-4 bg-white border-t border-slate-100 mobile-row flex items-center justify-between shrink-0">
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">ตำแหน่งปัจจุบัน</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-[#10b981] rounded-full border-2 border-white" />
 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">ร้านค้าที่กรองแล้ว</span>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
 ผลลัพธ์ {filteredCustomers.length} จาก {customers.length}
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};

export default React.memo(ResultsMapModal);
