import React, { useState, useEffect, useRef } from 'react';

interface MapPickerModalProps {
 initialLat: number;
 initialLng: number;
 suggestedAddress: string;
 onClose: () => void;
 onSelect: (lat: number, lng: number) => void;
}

const MapPickerModal: React.FC<MapPickerModalProps> = ({ 
 initialLat, 
 initialLng, 
 suggestedAddress, 
 onClose, 
 onSelect 
}) => {
 const [lat, setLat] = useState(initialLat);
 const [lng, setLng] = useState(initialLng);
 const [searchText, setSearchText] = useState(suggestedAddress);
 const [isSearching, setIsSearching] = useState(false);
 const mapRef = useRef<HTMLDivElement>(null);
 const lMap = useRef<any>(null);
 const lMarker = useRef<any>(null);
 const initialTriggerRef = useRef(false);

 useEffect(() => {
 // Load Leaflet if not already loaded (though it should be by the parent)
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

 const map = L.map(mapRef.current, { zoomControl: false }).setView([initialLat, initialLng], 14);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(map);
 L.control.zoom({ position: 'topleft' }).addTo(map);

 const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
 marker.on('dragend', (e: any) => { const pos = e.target.getLatLng(); setLat(pos.lat); setLng(pos.lng); });

 map.on('click', (e: any) => { marker.setLatLng(e.latlng); setLat(e.latlng.lat); setLng(e.latlng.lng); });

 lMap.current = map;
 lMarker.current = marker;

 // Auto search once on initialization if there is a suggestion
 if (!initialTriggerRef.current && suggestedAddress) {
 initialTriggerRef.current = true;
 handleSearchAuto(suggestedAddress);
 }
 }, 500);
 return () => clearTimeout(timer);
 }, []);

 const handleSearchAuto = async (text: string) => {
 if (!text.trim()) return;
 setIsSearching(true);
 try {
 const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}`);
 const data = await resp.json();
 if (data && data.length > 0) {
 const { lat: newLat, lon: newLon } = data[0];
 const lNum = parseFloat(newLat); const lnNum = parseFloat(newLon);
 if (lMap.current && lMarker.current) {
 lMap.current.setView([lNum, lnNum], 16);
 lMarker.current.setLatLng([lNum, lnNum]);
 }
 setLat(lNum); setLng(lnNum);
 }
 } catch (err) { console.error(err); } finally { setIsSearching(false); }
 };

 const handleSearch = (e: React.FormEvent) => {
 e.preventDefault();
 handleSearchAuto(searchText);
 };

 const useCurrentLocation = () => {
 setIsSearching(true);
 navigator.geolocation.getCurrentPosition((pos) => {
 const { latitude, longitude } = pos.coords;
 if (lMap.current && lMarker.current) {
 lMap.current.setView([latitude, longitude], 17);
 lMarker.current.setLatLng([latitude, longitude]);
 }
 setLat(latitude);
 setLng(longitude);
 setIsSearching(false);
 }, (err) => {
 alert("ไม่สามารถเข้าถึงตำแหน่งปัจจุบันได้: " + err.message);
 setIsSearching(false);
 }, { enableHighAccuracy: true });
 };

 return (
 <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 bg-black/60 ">
 <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden border border-slate-100 flex flex-col">
 <div className="p-5 bg-[#0b1b32] text-white flex items-center justify-between">
 <h4 className="font-black flex items-center gap-2 uppercase tracking-[0.1em] text-[14px]">
 <span className="material-symbols-outlined text-blue-400 text-[20px]">location_on</span>
 ปักหมุดตำแหน่ง
 </h4>
 <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center "><span className="material-symbols-outlined text-[20px]">close</span></button>
 </div>
 
 <div className="p-4 border-b border-slate-50 bg-white">
 <form onSubmit={handleSearch} className="flex gap-2">
 <input title="Map Search" type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="จังหวัด อำเภอ ตำบล..." className="flex-1 h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-[13px] font-bold outline-none focus:bg-white " />
 <button type="submit" disabled={isSearching} className="h-12 px-5 bg-blue-600 text-white rounded-xl text-[12px] font-black uppercase disabled:opacity-50 ">
 {isSearching ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full "></div> : "ค้นหา"}
 </button>
 </form>
 
 <div className="flex flex-col gap-2 mt-2">
 <button title="Auto GPS" onClick={useCurrentLocation} className="w-full h-11 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ">
 <span className="material-symbols-outlined text-[16px]">my_location</span> กำหนดพิกัดอัตโนมัติ
 </button>
 </div>
 </div>

 <div ref={mapRef} className="h-[280px] w-full bg-slate-100" />
 
 <div className="p-5 bg-white space-y-4">
 {/* Editable Lat/Lng Inputs */}
 <div className="flex divide-x divide-slate-100 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
 <div className="flex-1 py-1.5 px-3 flex flex-col items-center">
 <span className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-0.5">Latitude</span>
 <input 
 type="number" 
 step="any"
 title="Manual Latitude"
 className="w-full bg-transparent text-center text-[13px] font-bold text-slate-700 outline-none border-none focus:text-blue-600 appearance-none"
 value={lat}
 onChange={(e) => {
 const v = parseFloat(e.target.value);
 setLat(v || 0);
 if (!isNaN(v) && lMap.current && lMarker.current) {
 lMap.current.setView([v, lng], lMap.current.getZoom());
 lMarker.current.setLatLng([v, lng]);
 }
 }}
 />
 </div>
 <div className="flex-1 py-1.5 px-3 flex flex-col items-center">
 <span className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-0.5">Longitude</span>
 <input 
 type="number" 
 step="any"
 title="Manual Longitude"
 className="w-full bg-transparent text-center text-[13px] font-bold text-slate-700 outline-none border-none focus:text-blue-600 appearance-none"
 value={lng}
 onChange={(e) => {
 const v = parseFloat(e.target.value);
 setLng(v || 0);
 if (!isNaN(v) && lMap.current && lMarker.current) {
 lMap.current.setView([lat, v], lMap.current.getZoom());
 lMarker.current.setLatLng([lat, v]);
 }
 }}
 />
 </div>
 </div>
 
 <div className="flex flex-col gap-2 pb-2">
 <button 
 onClick={() => onSelect(lat, lng)} 
 className="w-full h-14 bg-emerald-600 text-white font-black rounded-xl text-[14px] uppercase tracking-widest ] "
 >
 ยืนยันพิกัด
 </button>
 <button 
 onClick={onClose}
 className="w-full h-10 text-slate-400 font-bold rounded-xl text-[12px] ] "
 >
 ยกเลิก
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};

export default React.memo(MapPickerModal);
