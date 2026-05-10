import React, { useState, useMemo, useEffect } from 'react';
import { Search, RefreshCw, X, ZoomIn, Filter, RotateCcw, ChevronRight, MapPin, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageLightbox } from './CommonUI';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { usePossession } from '../../hooks/usePossession';
import { exportJsonToExcel } from '../../utils/excel';
import { formatThaiDate } from '../../utils/dateTimeUtils';
import { SARABUN_REGULAR, SARABUN_BOLD } from '../../utils/pdfFonts';

interface SettingsCustomersProps {
 customers: any[];
 transactions?: any[];
 logisticsJobs?: any[];
 onEditCustomer: (customer: any) => void;
 onDeleteCustomer: (customer: any) => void;
 onAddCustomer: () => void;
 onLoadCustomers: () => void;
 isLoadingCustomers: boolean;
 items: any[];
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

const CustomerAssetBadge: React.FC<{ cv: string, transactions: any[], logisticsJobs: any[], masterItems: any[] }> = ({ cv, transactions, logisticsJobs, masterItems }) => {
 const possession = usePossession(transactions, cv, logisticsJobs, masterItems);
 
 if (!possession || possession.length === 0) return null;

 return (
 <div className="flex flex-col gap-2 mt-4 text-left">
 {possession.map((item, idx) => {
 const nameStr = item.name || '';
 const detailStr = (item.detail && item.detail !== '-') ? ` ${item.detail}` : '';
 const sizeStr = (item.size && item.size !== '-') ? ` ขนาด ${item.size}` : '';
 const condStr = item.condition ? ` สภาพ ${item.condition}` : '';

 return (
 <div key={`${idx}`} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl ">
 <div className="flex flex-col min-w-0 pr-4">
 <p className="text-[14px] font-black leading-snug">
 <span className="text-slate-800">{nameStr}{detailStr}{sizeStr}{condStr}</span>
 </p>
 {item.lastDate && (
 <span className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
 <RefreshCw size={10} /> รับเมื่อ {formatThaiDate(item.lastDate)}
 </span>
 )}
 </div>
 <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center shrink-0 ">
 <span className="text-[18px] font-black text-slate-800">{item.qty}</span>
 </div>
 </div>
 );
 })}
 </div>
 );
};

const SettingsCustomers: React.FC<SettingsCustomersProps> = ({ 
 customers, transactions = [], logisticsJobs = [], items = [], 
 onEditCustomer, onDeleteCustomer, onAddCustomer, onLoadCustomers, isLoadingCustomers,
 thaiAddressData = []
}) => {
 const [customerSearch, setCustomerSearch] = useState('');
 const [visibleCount, setVisibleCount] = useState(100);
 const [previewImage, setPreviewImage] = useState<string | null>(null);

 // 📝 Filter States
 const [showFilters, setShowFilters] = useState(false);
 const [filterRadius, setFilterRadius] = useState<number | null>(null);
 const [selProvince, setSelProvince] = useState('');
 const [selDistrict, setSelDistrict] = useState('');
 const [selSubdistrict, setSelSubdistrict] = useState('');
 const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

 // 🌍 Geolocation Effect
 useEffect(() => {
 if (filterRadius && !userLocation) {
 navigator.geolocation.getCurrentPosition(
 (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
 (err) => console.warn("Geolocation failed:", err),
 { enableHighAccuracy: true }
 );
 }
 }, [filterRadius, userLocation]);

 // 🏠 Cascading Address Options
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
 let list = customers;

 // 1. Text Search
 if (customerSearch) {
 const term = customerSearch.toLowerCase();
 list = list.filter(c => 
 String(c.cv || '').toLowerCase().includes(term) ||
 String(c.name || '').toLowerCase().includes(term) ||
 String(c.phone || '').includes(term) ||
 String(c.address || '').toLowerCase().includes(term)
 );
 }

 // 2. Area Filters
 if (selProvince) list = list.filter(c => c.province === selProvince);
 if (selDistrict) list = list.filter(c => c.district === selDistrict);
 if (selSubdistrict) list = list.filter(c => c.subdistrict === selSubdistrict);

 // 3. Radius Filter
 if (filterRadius && userLocation) {
 list = list.filter(c => {
 const cLat = parseFloat(c.lat);
 const cLng = parseFloat(c.lng);
 if (isNaN(cLat) || isNaN(cLng)) return false;
 const dist = getDistance(userLocation.lat, userLocation.lng, cLat, cLng);
 return dist <= filterRadius;
 });
 }

 return list;
 }, [customers, customerSearch, selProvince, selDistrict, selSubdistrict, filterRadius, userLocation]);

 const displayedCustomers = useMemo(() => {
 return filteredCustomers.slice(0, visibleCount);
 }, [filteredCustomers, visibleCount]);

 const resetFilters = () => {
 setFilterRadius(null);
 setSelProvince('');
 setSelDistrict('');
 setSelSubdistrict('');
 };

 const exportToExcel = async () => {
 const data = filteredCustomers.map(c => ({
 'CV': c.cv,
 'ชื่อลูกค้า': c.name,
 'เบอร์โทร': c.phone,
 'ที่อยู่': [c.address, c.subdistrict, c.district, c.province, c.zipcode].filter(Boolean).join(' '),
 'Latitude': c.lat,
 'Longitude': c.lng
 }));
 await exportJsonToExcel(data, 'Customers', 'Customer_Database.xlsx');
 };

 const exportToPDF = () => {
 const doc = new jsPDF() as any;
 
 // Add Thai Fonts
 doc.addFileToVFS('Sarabun-Regular.ttf', SARABUN_REGULAR);
 doc.addFileToVFS('Sarabun-Bold.ttf', SARABUN_BOLD);
 doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
 doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
 
 doc.setFont('Sarabun', 'normal');
 
 const tableData = filteredCustomers.map(c => [
 c.cv, 
 c.name, 
 c.phone, 
 [c.subdistrict, c.district].filter(Boolean).join(', ')
 ]);

 doc.autoTable({
 head: [['CV', 'Name', 'Phone', 'Area']],
 body: tableData,
 styles: { font: 'Sarabun' }
 });
 doc.save("Customer_Database.pdf");
 };

 return (
 <div className="p-4 md:p-8 space-y-6 text-left relative min-h-[600px]">
 
 {/* 🔍 Filter Panel Slide-over */}
 <AnimatePresence>
 {showFilters && (
 <>
 <motion.div 
 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 onClick={() => setShowFilters(false)}
 className="fixed inset-0 bg-black/40 ] z-[80]"
 />
 <motion.div 
 initial={{ x: '100%' }} 
 animate={{ x: 0 }} 
 exit={{ x: '100%' }}
 className="fixed top-0 right-0 bottom-0 w-full sm:max-w-sm bg-white z-[90] p-8 flex flex-col border-l border-slate-100"
 >
 <div className="flex items-center justify-between mb-10">
 <div>
 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">ตั้งค่าการกรอง</h3>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Smart Search Filters</p>
 </div>
 <button onClick={() => setShowFilters(false)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 ">
 <X size={20} />
 </button>
 </div>

 <div className="flex-1 space-y-8 overflow-y-auto pr-2 scrollbar-hide">
 {/* Radius Filter */}
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
 <Navigation size={14} className="text-emerald-500" /> รัศมีรอบตัวคุณ
 </label>
 {filterRadius && <button onClick={() => setFilterRadius(null)} className="text-[10px] font-black text-rose-500 uppercase tracking-tighter ">Reset</button>}
 </div>
 <div className="grid grid-cols-3 gap-2">
 {[5, 10, 20, 30, 50].map(r => (
 <button 
 key={r} 
 onClick={() => setFilterRadius(r)}
 className={`h-11 rounded-2xl text-[12px] font-black border ${filterRadius === r ? 'bg-slate-900 text-white border-slate-900 ' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
 >
 {r} กม.
 </button>
 ))}
 </div>
 </div>

 <div className="h-px bg-slate-50" />

 {/* Area Filter */}
 <div className="space-y-5">
 <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
 <MapPin size={14} className="text-blue-500" /> ขอบเขตพื้นที่
 </label>
 
 <div className="space-y-4">
 <div className="space-y-2">
 <span className="text-[9px] font-black text-slate-400 uppercase ml-1">จังหวัด</span>
 <select 
 className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-sm font-bold outline-none focus:border-emerald-500 cursor-pointer"
 value={selProvince}
 onChange={(e) => { setSelProvince(e.target.value); setSelDistrict(''); setSelSubdistrict(''); }}
 >
 <option value="">-- กรองจังหวัด --</option>
 {thaiAddressData && thaiAddressData.map(p => <option key={p.name_th} value={p.name_th}>{p.name_th}</option>)}
 </select>
 </div>

 <div className="space-y-2">
 <span className="text-[9px] font-black text-slate-400 uppercase ml-1">อำเภอ</span>
 <select 
 disabled={!selProvince}
 className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-sm font-bold outline-none focus:border-emerald-500 disabled:opacity-40 cursor-pointer"
 value={selDistrict}
 onChange={(e) => { setSelDistrict(e.target.value); setSelSubdistrict(''); }}
 >
 <option value="">-- กรองอำเภอ --</option>
 {districts.map(d => <option key={d} value={d}>{d}</option>)}
 </select>
 </div>

 <div className="space-y-2">
 <span className="text-[9px] font-black text-slate-400 uppercase ml-1">ตำบล</span>
 <select 
 disabled={!selDistrict}
 className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-sm font-bold outline-none focus:border-emerald-500 disabled:opacity-40 cursor-pointer"
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

 <div className="pt-8 space-y-3">
 <button 
 onClick={resetFilters}
 className="w-full h-12 bg-slate-50 text-slate-400 rounded-2xl font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-2"
 >
 <RotateCcw size={14} /> ล้างต้วกรองทั้งหมด
 </button>
 <button 
 onClick={() => setShowFilters(false)}
 className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-[14px] uppercase tracking-widest flex items-center justify-center gap-2 "
 >
 ยืนยันตัวกรอง <ChevronRight size={18} />
 </button>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>

 {/* Premium Header Container */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-100 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none transform rotate-12">
 <span className="material-symbols-outlined text-[100px] text-emerald-500 font-black">groups</span>
 </div>
 
 <div className="flex items-center gap-4 relative z-10">
 <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black">
 <span className="material-symbols-outlined text-[26px]">contact_page</span>
 </div>
 <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight leading-none">ฐานข้อมูลลูกค้า</h2>
 <div className="flex items-center gap-2 mt-1.5">
 <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100">Total: {customers.length}</span>
 <button onClick={onLoadCustomers} className="text-slate-300 text-[10px] font-black uppercase tracking-widest">
 • Reload
 </button>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
 <div className="flex gap-2 mr-2">
 <button onClick={exportToExcel} className="w-11 h-11 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 " title="Export Excel">
 <span className="material-symbols-outlined text-[20px]">table_view</span>
 </button>
 <button onClick={exportToPDF} className="w-11 h-11 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 " title="Export PDF">
 <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
 </button>
 </div>
 
 <button 
 onClick={onAddCustomer} 
 className="flex-1 md:flex-none h-11 px-8 bg-primary text-white rounded-xl font-black flex items-center justify-center gap-2 text-[12px] uppercase tracking-widest whitespace-nowrap"
 >
 <span className="material-symbols-outlined text-[20px]">person_add</span> เพิ่มลูกค้า
 </button>
 </div>
 </div>

 {/* Search & Filter Bar Block */}
 <div className="flex items-center gap-3 w-full">
 <form 
 onSubmit={(e) => {
 e.preventDefault();
 const term = (e.currentTarget.elements.namedItem('search') as HTMLInputElement).value;
 setCustomerSearch(term);
 setVisibleCount(100);
 if (customers.length === 0) onLoadCustomers();
 }}
 className="flex-1 flex gap-2"
 >
 <div className="relative flex-1 group">
 <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 " />
 <input 
 name="search"
 type="text" 
 placeholder="ค้นหาตามชื่อร้าน, CV, หรือเบอร์โทรศัพท์..." 
 autoComplete="off"
 className="w-full h-14 bg-white border border-slate-200 rounded-full pl-16 pr-6 text-[14px] font-bold outline-none focus:border-indigo-500/20 placeholder:text-slate-300 "
 onChange={(e) => {
 if (e.target.value === '') {
 setCustomerSearch('');
 setVisibleCount(100);
 }
 }}
 />
 </div>
 <button 
 type="submit"
 disabled={isLoadingCustomers}
 className="h-14 px-8 bg-indigo-600 text-white rounded-full font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 shrink-0 md:px-10"
 >
 {isLoadingCustomers ? <RefreshCw className="" size={18} /> : <Search size={18} />}
 <span className="hidden sm:inline">ค้นหา</span>
 </button>
 </form>
 
 <button 
 onClick={() => setShowFilters(true)}
 className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 ${ (filterRadius || selProvince) ? 'bg-emerald-500 text-white ' : 'bg-white text-slate-400 border border-slate-100' }`}
 >
 <Filter size={24} />
 {(filterRadius || selProvince) && (
 <div className="absolute top-2 right-2 w-3 h-3 bg-white border-2 border-emerald-500 rounded-full" />
 )}
 </button>
 </div>

 {/* Results Info Bar */}
 {(customerSearch || filterRadius || selProvince) && (
 <div className="px-6 py-3 bg-slate-50 rounded-2xl flex items-center justify-between border border-dashed border-slate-200 text-left">
 <div className="flex items-center gap-3">
 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ผลการกรอง:</span>
 <div className="flex gap-2 flex-wrap">
 {customerSearch && <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600">คำค้น: "{customerSearch}"</span>}
 {filterRadius && <span className="px-3 py-1 bg-white border border-emerald-100 rounded-lg text-[10px] font-bold text-emerald-600">รัศมี: {filterRadius} กม.</span>}
 {selProvince && <span className="px-3 py-1 bg-white border border-blue-100 rounded-lg text-[10px] font-bold text-blue-600">{selProvince} {selDistrict && `/ ${selDistrict}`}</span>}
 </div>
 </div>
 <button onClick={resetFilters} className="text-[10px] font-black text-rose-500 uppercase tracking-widest whitespace-nowrap">ล้างทั้งหมด</button>
 </div>
 )}

 {/* Main Content Grid */}
 {filteredCustomers.length === 0 && !isLoadingCustomers ? (
 <div className="py-32 flex flex-col items-center justify-center text-center space-y-6 bg-white rounded-[3rem] border border-slate-100 ">
 <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center ">
 <span className="material-symbols-outlined text-[40px]">search_off</span>
 </div>
 <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">ไม่พบข้อมูลลูกค้า</h3>
            <p className="text-[11px] text-slate-500 font-medium max-w-[200px] mx-auto">กรุณาลองปรับเปลี่ยนตัวกรอง หรือค้นหาใหม่อีกครั้ง</p>
 </div>
 <button 
 onClick={resetFilters}
 className="h-14 px-10 bg-slate-900 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center gap-3"
 >
 <RotateCcw size={18} /> ล้างตัวกรองทั้งหมด
 </button>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
 <AnimatePresence mode="popLayout">
 {displayedCustomers.map((c, idx) => (
 <motion.div 
 key={c.cv || idx}
 layout
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95 }}
 transition={{ duration: 0.3, delay: idx * 0.02 }}
 className="bg-white border border-slate-100 rounded-[2.5rem] p-6 group relative overflow-hidden flex flex-col justify-between"
 >
 <div className="relative z-10 space-y-5">
 <div className="flex items-start justify-between">
 <span className="bg-emerald-50 px-3 py-1.5 rounded-xl text-emerald-600 text-[10px] font-black tracking-widest border border-emerald-100 uppercase">
 CV: {c.cv}
 </span>
 <div className="flex gap-1.5">
 <button onClick={() => onEditCustomer(c)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 ">
 <span className="material-symbols-outlined text-[18px]">edit</span>
 </button>
 <button onClick={() => onDeleteCustomer(c)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 ">
 <span className="material-symbols-outlined text-[18px]">delete</span>
 </button>
 </div>
 </div>
 
 <div className="flex gap-4">
 {c.image_url ? (
 <div 
 className="w-20 h-20 rounded-2xl bg-white overflow-hidden cursor-zoom-in group/img relative shrink-0 border border-slate-100 "
 onClick={() => setPreviewImage(c.image_url)}
 >
 <img src={c.image_url} className="w-full h-full object-cover group-hover/img:scale-110" alt="Shop" />
 <div className="absolute inset-0 bg-black/0 flex items-center justify-center ">
 <span className="material-symbols-outlined text-white opacity-0 scale-50 ">zoom_in</span>
 </div>
 </div>
 ) : (
 <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center shrink-0">
 <span className="material-symbols-outlined text-slate-300 text-[24px]">image</span>
 <span className="text-[7px] font-black text-slate-300 uppercase tracking-tighter mt-1">No Survey</span>
 </div>
 )}
 
 <div className="flex-1 space-y-2">
 <h3 className="text-[17px] font-black text-slate-900 leading-tight line-clamp-2 min-h-[42px]">
 {c.name}
 </h3>
 {c.phone && (
 <div className="text-[11px] text-emerald-600 font-black flex items-center gap-2 bg-emerald-50/50 w-fit px-2.5 py-1 rounded-lg">
 <span className="material-symbols-outlined text-[14px]">call</span>
 {c.phone}
 </div>
 )}
 </div>
 </div>
 
 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 ">
 <p className="text-[11px] text-slate-500 font-bold leading-relaxed line-clamp-2">
 <span className="material-symbols-outlined text-[16px] align-middle mr-2 text-slate-300">location_on</span>
 {[c.address, c.subdistrict, c.district, c.province].filter(Boolean).join(' ')}
 </p>
 <CustomerAssetBadge cv={c.cv} transactions={transactions} logisticsJobs={logisticsJobs} masterItems={items} />
 </div>
 </div>
 
 <div className="mt-6 flex flex-col gap-2 relative z-10">
 {(c.lat && c.lng) ? (
 <a title="Maps" href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer" className="w-full h-12 text-[10px] font-black text-blue-600 bg-blue-50/50 rounded-2xl flex items-center justify-center gap-3 border border-blue-100 uppercase tracking-widest">
 <span className="material-symbols-outlined text-[20px]">map</span> แผนที่ Google Maps
 </a>
 ) : (
 <div className="w-full h-12 text-[10px] font-black text-slate-300 bg-slate-50 rounded-2xl flex items-center justify-center gap-3 border border-slate-100 uppercase tracking-widest cursor-not-allowed">
 <span className="material-symbols-outlined text-[20px]">location_off</span> ยังไม่มีพิกัดตำแหน่ง
 </div>
 )}
 </div>
 </motion.div>
 ))}
 </AnimatePresence>
 
 {/* Load More Button */}
 {visibleCount < filteredCustomers.length && (
 <div className="col-span-full pt-8 flex flex-col items-center gap-4">
 <button 
 onClick={() => setVisibleCount(prev => prev + 100)}
 className="h-14 px-12 bg-white text-emerald-600 border-2 border-emerald-600 rounded-2xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center gap-3"
 >
 <span className="material-symbols-outlined ">keyboard_double_arrow_down</span> 
 โหลดเพิ่ม {filteredCustomers.length - visibleCount} รายการ
 </button>
 </div>
 )}
 </div>
 )}
 {/* 🖼️ Standard Image Lightbox */}
 <ImageLightbox 
 isOpen={!!previewImage}
 imageUrl={previewImage || ''}
 onClose={() => setPreviewImage(null)}
 />
 </div>
);
};

export default React.memo(SettingsCustomers);
