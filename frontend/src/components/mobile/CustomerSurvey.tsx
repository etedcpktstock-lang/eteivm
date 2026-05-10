import React, { useState, useMemo, useCallback } from 'react';
import { 
 Search, 
 MapPin, 
 Camera, 
 Save, 
 X, 
 CheckCircle, 
 Phone, 
 Navigation,
 ArrowLeft,
 RefreshCw,
 Package,
 Compass,
 ArrowRight,
 Edit,
 ZoomIn,
 Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveCustomer, processBatchTransaction, getNextTxnNo } from '../../api';
import ResultsMapModal from './ResultsMapModal';
import { ImageLightbox } from '../shared/CommonUI';
import { CustomerSurveyHistory } from './CustomerSurveyHistory';
import CustomerQuickEdit from '../shared/CustomerQuickEdit';
import { useThaiAddress } from '../../hooks/useThaiAddress';
import { usePossession } from '../../hooks/usePossession';
import { compressImage } from '../../utils/fileUtils';
import { TRANSACTION_STATUSES } from '../../constants/logisticsConstants';
import type { Customer, Transaction, MaterialItem } from '../../types';

interface Props {
 items: MaterialItem[];
 customers: Customer[];
 transactions: Transaction[];
 logisticsJobs?: any[];
 operatorName: string;
 onRefresh: () => void;
 onClose: () => void;
 thaiAddressData: any[]; 
}

/**
 * 🕵️ Helper: Find master photo from any potential key
 */
const getMasterPhoto = (c: any) => {
 if (!c) return null;
 const priorityKeys = ['image_url', 'Image_URL', 'image_Url', 'imageURL', 'photo_url'];
 for (const key of priorityKeys) {
 if (c[key] && typeof c[key] === 'string' && c[key].length > 10) return c[key];
 }
 const allKeys = Object.keys(c);
 for (const key of allKeys) {
 const lowerKey = key.toLowerCase();
 const val = c[key];
 if (typeof val !== 'string') continue;
 if ((lowerKey.includes('image') || lowerKey.includes('photo')) && (val.startsWith('http') || val.startsWith('data:image'))) {
 return val;
 }
 }
 return null;
};

export default function CustomerSurvey({ 
 items, 
 customers, 
 transactions, 
 logisticsJobs = [],
 operatorName, 
 onRefresh, 
 onClose, 
 thaiAddressData = [] 
}: Props) {
 const [searchTerm, setSearchTerm] = useState('');
 const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
 const [searchResults, setSearchResults] = useState<Customer[]>([]);
 const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
 const [customerDraft, setCustomerDraft] = useState<Customer | null>(null);
 const [isReadOnly, setIsReadOnly] = useState(true);
 const [previewImage, setPreviewImage] = useState<string | null>(null);
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);
 const [success, setSuccess] = useState(false);
 const [note, setNote] = useState('');
 const [newLocation, setNewLocation] = useState<{ lat: number, lng: number } | null>(null);
 const [photos, setPhotos] = useState<string[]>([]);
 const [error, setError] = useState<string | null>(null);
 const [isNearbyMode, setIsNearbyMode] = useState(false);
 const [showResultsMap, setShowResultsMap] = useState(false);
 const [showQuickEdit, setShowQuickEdit] = useState(false);

 // --- Externalized Hooks ---
 const { availableDistricts, availableSubdistricts } = useThaiAddress(
 thaiAddressData, 
 customerDraft?.province || '', 
 customerDraft?.district || ''
 );

 const possessionList = usePossession(transactions, selectedCustomer?.cv, logisticsJobs, items);

 const customerHistory = useMemo(() => {
 if (!selectedCustomer) return [];
 return transactions
 .filter(t => {
 const tCv = String(t.CV || t.cv || '').trim();
 const sCv = String(selectedCustomer.cv || '').trim();
 return tCv === sCv && sCv !== '';
 })
 .sort((a, b) => new Date(b['วัน-เวลา']).getTime() - new Date(a['วัน-เวลา']).getTime())
 .slice(0, 5);
 }, [selectedCustomer, transactions]);

 // --- Callbacks ---
 const handleSelectCustomer = useCallback((c: Customer) => {
 setSelectedCustomer(c);
 setCustomerDraft({...c});
 setIsReadOnly(true);
 setShowResultsMap(false);
 }, []);

 const handleAddNewCustomer = useCallback(() => {
 setShowQuickEdit(true);
 }, []);

 // --- Business Logic ---
 const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
 const R = 6371; 
 const dLat = (lat2 - lat1) * Math.PI / 180;
 const dLon = (lon2 - lon1) * Math.PI / 180;
 const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
 return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
 }, []);

 const handleSearch = useCallback((overrideNearby?: boolean, overrideLoc?: {lat: number, lng: number}) => {
 setLoading(true);
 const nearby = overrideNearby !== undefined ? overrideNearby : isNearbyMode;
 const loc = overrideLoc || userLocation;

 let list = [...customers];
 if (searchTerm) {
 const lower = searchTerm.toLowerCase();
 list = list.filter(c => String(c.cv || c.CV || '').toLowerCase().includes(lower) || String(c.name || '').toLowerCase().includes(lower));
 }

 if (nearby && loc) {
 list = list.map(c => {
 const cLat = parseFloat(String(c.lat || ''));
 const cLng = parseFloat(String(c.lng || ''));
 const dist = (!isNaN(cLat) && !isNaN(cLng)) ? calculateDistance(loc.lat, loc.lng, cLat, cLng) : 999999;
 return { ...c, distanceValue: dist };
 }).sort((a, b) => (a as any).distanceValue - (b as any).distanceValue);
 }

 setSearchResults(list.slice(0, 50)); 
 setLoading(false);
 }, [searchTerm, isNearbyMode, userLocation, customers, calculateDistance]);

 const handleNearbyToggle = () => {
 if (isNearbyMode) {
 setIsNearbyMode(false);
 return;
 }
 
 setLoading(true);
 setError(null);
 if (!navigator.geolocation) {
 setError("อุปกรณ์ไม่รองรับการจับพิกัด");
 setLoading(false); return;
 }

 navigator.geolocation.getCurrentPosition(
 (pos) => { 
 const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
 setUserLocation(loc);
 setIsNearbyMode(true);
 handleSearch(true, loc); 
 },
 () => { 
 setError("ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาเปิด GPS"); 
 setLoading(false); 
 },
 { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
 );
 };

 const handleGetLocation = () => {
 setLoading(true);
 setError(null);
 if (!navigator.geolocation) {
 setError("อุปกรณ์ไม่รองรับการจับพิกัด");
 setLoading(false); return;
 }
 navigator.geolocation.getCurrentPosition(
 (pos) => { setNewLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLoading(false); },
 () => { setError("ไม่สามารถเข้าถึงพิกัดได้ กรุณาเปิด GPS"); setLoading(false); },
 { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
 );
 };

 const handleSaveSurvey = useCallback(async () => {
 if (!selectedCustomer || !customerDraft) return;
 setSaving(true);
 setError(null);
 try {
 const txnNo = await getNextTxnNo();
 
 // 1. Process Survey Transaction
 await processBatchTransaction({
 action: 'survey', 
 items: [{ activity_name: 'งานสำรวจลูกค้า', quantity: 1 }],
 cv: selectedCustomer.cv,
 deliveryBy: operatorName,
 deliveryDate: new Date().toISOString().split('T')[0],
 txnNo,
 operator: operatorName,
 note: note ||`[SURVEY] บันทึกการสำรวจโดย ${operatorName}`,
 workZone: '',
 status: TRANSACTION_STATUSES.SURVEYING,
 photos,
 lat: newLocation?.lat.toString() || customerDraft.lat?.toString() || '',
 lng: newLocation?.lng.toString() || customerDraft.lng?.toString() || ''
 });

 // 2. Save/Update Customer Info
 await saveCustomer({
 ...customerDraft,
 lat: newLocation?.lat || customerDraft.lat || 0,
 lng: newLocation?.lng || customerDraft.lng || 0,
 image_url: photos.length > 0 ? photos[0] : customerDraft.image_url
 });

 setSuccess(true);
 onRefresh();
 setTimeout(() => {
 setSuccess(false);
 setSelectedCustomer(null);
 setCustomerDraft(null);
 setIsReadOnly(true);
 setPhotos([]);
 }, 3000);
 } catch (err: any) {
 setError(`บันทึกไม่สำเร็จ: ${err.message || 'Unknown error'}`);
 } finally {
 setSaving(false);
 }
 }, [selectedCustomer, customerDraft, operatorName, note, photos, newLocation, onRefresh]);

 if (success) {
 return (
 <div className="flex flex-col items-center justify-center py-6 text-center">
 <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6 border-4 border-white">
 <CheckCircle size={48} />
 </div>
 <h2 className="text-2xl font-black text-slate-800 tracking-tight">บันทึกสำเร็จ!</h2>
 </div>
 );
 }

 return (
 <div className="mobile-page-frame max-w-2xl space-y-4">
      <div className="sticky top-0 z-50 bg-slate-50/90 backdrop-blur-2xl border-b border-slate-200/60 pb-4 pt-6 px-4 mb-5 -mx-2 transition-all duration-300">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 bg-emerald-600 rounded-[16px] flex items-center justify-center text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
                <span className="material-symbols-outlined text-[24px] font-bold">person_search</span>
              </div>
            </div>
            <div className="flex flex-col justify-center text-left">
              <h2 className="text-[20px] font-black text-slate-900 tracking-tight leading-none mb-1">สำรวจลูกค้า</h2>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.15em] leading-none opacity-80">Customer Survey</p>
            </div>
          </div>
          <button 
            onClick={() => selectedCustomer ? setSelectedCustomer(null) : onClose()}
            className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-slate-400 shadow-sm border border-slate-200/80 hover:bg-white hover:text-rose-500 active:scale-90 transition-all duration-200 shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">{selectedCustomer ? 'arrow_back_ios_new' : 'close'}</span>
          </button>
        </div>
      </div>

 <ImageLightbox isOpen={!!previewImage} imageUrl={previewImage || ''} onClose={() => setPreviewImage(null)} />
 <ResultsMapModal 
 isOpen={showResultsMap} 
 onClose={() => setShowResultsMap(false)} 
 customers={searchResults} 
 userLocation={userLocation} 
 onSelectCustomer={handleSelectCustomer}
 thaiAddressData={thaiAddressData}
 />

  {!selectedCustomer ? (
  <div className="space-y-4 fade-in">
          <div className="flex flex-col space-y-3.5">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="ค้นหารหัส CV หรือชื่อร้าน..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{ height: '48px' }}
                className="flex-1 bg-white border border-slate-200 rounded-[16px] px-4 text-[14px] font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 transition-all duration-300 min-w-0"
              />
              <button 
                onClick={handleNearbyToggle} 
                disabled={loading}
                style={{ width: '48px', height: '48px' }}
                className={`!p-0 shrink-0 rounded-[16px] flex items-center justify-center transition-all duration-300 border ${isNearbyMode ? '!bg-emerald-500 !text-white !border-emerald-500' : 'bg-white text-slate-400 border-slate-200 hover:text-emerald-500'}`}
              >
                <span className={`material-symbols-outlined text-[22px] ${loading && isNearbyMode ? 'animate-spin' : ''}`}>explore</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => handleSearch()} disabled={loading} className="flex-1 !h-[50px] bg-slate-900 text-white rounded-[16px] font-black text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-slate-800 transition-colors shadow-sm min-w-0">
                {loading && !isNearbyMode ? <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span> : <span className="material-symbols-outlined text-[18px]">search</span>} ค้นหาลูกค้า
              </button>
              <button 
                onClick={handleAddNewCustomer} 
                className="flex-1 !h-[50px] bg-emerald-50 text-emerald-600 rounded-[16px] font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-1.5 border border-emerald-100 hover:bg-emerald-200 transition-colors shadow-sm min-w-0"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span> เพิ่มลูกค้าใหม่
              </button>
            </div>
            {isNearbyMode && searchResults.length > 0 && (
              <button 
                onClick={() => setShowResultsMap(true)} 
                className="w-full !h-[44px] bg-slate-100/80 text-slate-600 rounded-[14px] font-black text-[12px] flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors border border-slate-200/50"
              >
                <span className="material-symbols-outlined text-[18px]">map</span> ดูแผนที่ร้านรอบตัว
              </button>
            )}
          </div>
 <div className="space-y-2.5 pb-10">
 {searchResults.map(c => (
 <button key={c.cv} onClick={() => handleSelectCustomer(c)} className="w-full flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border border-slate-100 rounded-[20px] text-left shadow-[0_2px_10px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-all group">
 <div className="flex items-center gap-3.5 min-w-0">
 <div className="w-11 h-11 shrink-0 bg-slate-50 border border-slate-100 rounded-[14px] flex items-center justify-center text-slate-400">
 <Navigation size={20} />
 </div>
 <div className="min-w-0">
 <h3 className="text-[14px] font-black text-slate-800 truncate">{c.name}</h3>
 <div className="flex flex-wrap items-center gap-2 mt-1">
 <div className="bg-slate-900 px-2.5 py-0.5 rounded-[8px]">
 <p className="text-[12px] font-black text-white uppercase tracking-wider">CV: {c.cv}</p>
 </div>
 {(c as any).distanceValue !== undefined && (c as any).distanceValue < 999999 && (
 <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100/50 rounded-[6px] text-[10px] font-black uppercase">
 ห่าง { (c as any).distanceValue.toFixed(2) } กม.
 </div>
 )}
 </div>
 </div>
 </div>
 <ArrowRight size={20} className="text-slate-200" />
 </button>
 ))}
 </div>
 </div>
 ) : (
 <AnimatePresence mode="wait">
 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="bg-white/90 backdrop-blur-2xl rounded-[24px] border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden relative">
                <div className="p-5 sm:p-6 border-b border-slate-100/50 bg-white/40">
                  <div className="mobile-row flex items-center justify-between">
                    <div>
                      <h2 className="text-[20px] sm:text-[22px] font-black text-slate-800 tracking-tight">{isReadOnly ? 'ข้อมูลลูกค้า' : 'แก้ไขข้อมูลลูกค้า'}</h2>
                      <div className="inline-flex bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-[10px] mt-1.5 border border-emerald-100/50 shadow-[0_2px_10px_rgba(16,185,129,0.05)]">
                        <p className="text-[11px] font-black uppercase tracking-widest">CV: {selectedCustomer.cv}</p>
                      </div>
                    </div>
                    <button onClick={() => setIsReadOnly(!isReadOnly)} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${isReadOnly ? 'bg-white text-emerald-600 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-slate-100 hover:scale-105' : 'bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:bg-emerald-600'}`}>
                      {isReadOnly ? <span className="material-symbols-outlined text-[20px]">edit</span> : <span className="material-symbols-outlined text-[20px]">close</span>}
                    </button>
                  </div>
                </div>
 
 <div className="p-4 sm:p-6 space-y-4">
  {customerDraft && (
    <div className="grid grid-cols-1 gap-4 text-left">
      <div className="flex flex-col space-y-1.5">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">ชื่อร้าน/ลูกค้า</span>
        {isReadOnly ? 
          <div className="px-4 py-3.5 bg-slate-50/80 rounded-[16px] text-[14px] font-bold text-slate-800 flex items-center gap-3"><span className="material-symbols-outlined text-emerald-400 text-[20px]">store</span><span className="truncate">{customerDraft.name}</span></div> : 
          <div className="relative group"><span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors text-[20px]">store</span><input type="text" value={customerDraft.name} onChange={e => setCustomerDraft({...customerDraft, name: e.target.value})} className="w-full !pl-10 !pr-4 !h-[50px] !bg-slate-50/50 !border-slate-200/80 !rounded-[16px] !text-[14px] !font-bold text-slate-800 outline-none focus:!bg-white focus:!border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm" /></div>
        }
      </div>

      <div className="flex flex-col space-y-1.5">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">เบอร์โทรศัพท์</span>
        {isReadOnly ? 
          <div className="px-4 py-3.5 bg-slate-50/80 rounded-[16px] text-[14px] font-bold text-slate-800 flex items-center gap-3"><span className="material-symbols-outlined text-emerald-400 text-[20px]">call</span>{customerDraft.phone || '-'}</div> : 
          <div className="relative group"><span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors text-[20px]">call</span><input type="text" value={customerDraft.phone || ''} onChange={e => setCustomerDraft({...customerDraft, phone: e.target.value})} className="w-full !pl-10 !pr-4 !h-[50px] !bg-slate-50/50 !border-slate-200/80 !rounded-[16px] !text-[14px] !font-bold text-slate-800 outline-none focus:!bg-white focus:!border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm" /></div>
        }
      </div>

      <div className="flex flex-col space-y-1.5">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">ที่อยู่</span>
        {isReadOnly ? 
          <div className="px-4 py-3.5 bg-slate-50/80 rounded-[16px] text-[14px] font-bold text-slate-800 flex items-start gap-3 min-h-[70px]"><span className="material-symbols-outlined text-emerald-400 text-[20px] mt-0.5">location_on</span><span className="leading-relaxed">{customerDraft.address || '-'}</span></div> : 
          <div className="relative group"><span className="material-symbols-outlined absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors text-[20px]">location_on</span><textarea value={customerDraft.address || ''} onChange={e => setCustomerDraft({...customerDraft, address: e.target.value})} className="w-full !pl-10 !pr-4 !py-3.5 !bg-slate-50/50 !border-slate-200/80 !rounded-[16px] !text-[14px] !font-bold text-slate-800 outline-none focus:!bg-white focus:!border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 min-h-[90px] transition-all shadow-sm" /></div>
        }
      </div>

      {!isReadOnly ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">จังหวัด</span>
            <select value={customerDraft.province || ''} onChange={e => setCustomerDraft({...customerDraft, province: e.target.value, district: '', subdistrict: '', zipcode: ''})} className="w-full !px-3 !h-[50px] !bg-slate-50/50 !border-slate-200/80 !rounded-[16px] !text-[13px] !font-bold text-slate-800 outline-none focus:!bg-white focus:!border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm">
              <option value="">-- จังหวัด --</option>
              {(Array.isArray(thaiAddressData) ? thaiAddressData : []).map(p => <option key={p.name_th} value={p.name_th}>{p.name_th}</option>)}
            </select>
          </div>
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">อำเภอ</span>
            <select value={customerDraft.district || ''} disabled={!customerDraft.province} onChange={e => setCustomerDraft({...customerDraft, district: e.target.value, subdistrict: '', zipcode: ''})} className="w-full !px-3 !h-[50px] !bg-slate-50/50 !border-slate-200/80 !rounded-[16px] !text-[13px] !font-bold text-slate-800 outline-none focus:!bg-white focus:!border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-50 transition-all shadow-sm">
              <option value="">-- อำเภอ --</option>
              {(Array.isArray(availableDistricts) ? availableDistricts : []).map((d: any) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">ตำบล</span>
            <select value={customerDraft.subdistrict || ''} disabled={!customerDraft.district} onChange={e => {
              const t = (Array.isArray(availableSubdistricts) ? availableSubdistricts : []).find((tam: any) => tam.name_th === e.target.value);
              setCustomerDraft({...customerDraft, subdistrict: e.target.value, zipcode: t ? String(t.zip_code || t.zipcode || '') : ''});
            }} className="w-full !px-3 !h-[50px] !bg-slate-50/50 !border-slate-200/80 !rounded-[16px] !text-[13px] !font-bold text-slate-800 outline-none focus:!bg-white focus:!border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-50 transition-all shadow-sm">
              <option value="">-- ตำบล --</option>
              {(Array.isArray(availableSubdistricts) ? availableSubdistricts : []).map((t: any) => <option key={t.name_th} value={t.name_th}>{t.name_th}</option>)}
            </select>
          </div>
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">รหัสไปรษณีย์</span>
            <div className="w-full !px-3 !h-[50px] !bg-slate-100/50 !border-slate-200/50 !rounded-[16px] !text-[14px] !font-bold text-slate-500 flex items-center border">{customerDraft.zipcode || '-'}</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <div className="py-2.5 px-1 bg-slate-50/80 rounded-[14px] flex flex-col items-center justify-center min-w-0"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">จังหวัด</span><span className="text-[11px] font-bold text-slate-800 truncate w-full text-center px-1">{customerDraft.province || '-'}</span></div>
          <div className="py-2.5 px-1 bg-slate-50/80 rounded-[14px] flex flex-col items-center justify-center min-w-0"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">อำเภอ</span><span className="text-[11px] font-bold text-slate-800 truncate w-full text-center px-1">{customerDraft.district || '-'}</span></div>
          <div className="py-2.5 px-1 bg-slate-50/80 rounded-[14px] flex flex-col items-center justify-center min-w-0"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">ตำบล</span><span className="text-[11px] font-bold text-slate-800 truncate w-full text-center px-1">{customerDraft.subdistrict || '-'}</span></div>
          <div className="py-2.5 px-1 bg-slate-50/80 rounded-[14px] flex flex-col items-center justify-center min-w-0"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">รหัสฯ</span><span className="text-[11px] font-bold text-slate-800 truncate w-full text-center px-1">{customerDraft.zipcode || '-'}</span></div>
        </div>
      )}
    </div>
  )}

  <div className="flex gap-2.5 pt-1">
    <button 
      onClick={handleGetLocation} 
      disabled={isReadOnly || loading} 
      className={`flex-1 !h-[54px] !rounded-[16px] flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-all ${isReadOnly ? '!bg-slate-50/80 !text-slate-400 !border !border-slate-200/80 shadow-sm' : '!bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-[0_6px_16px_rgba(16,185,129,0.25)] !border !border-emerald-500/50 active:scale-[0.98]'}`}
    >
      <span className="material-symbols-outlined text-[20px]">my_location</span>
      <span className="text-[13px]">{isReadOnly ? 'เปิดแก้ไขก่อนจับพิกัด' : (newLocation ? 'จับพิกัดอีกครั้ง' : 'Check-In (จับพิกัด)')}</span>
    </button>
    
    {customerDraft?.lat && customerDraft?.lng && (
      <button 
        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${customerDraft.lat},${customerDraft.lng}`, '_blank')}
        className="w-[54px] !h-[54px] shrink-0 !bg-blue-600 hover:!bg-blue-700 shadow-[0_4px_12px_rgba(37,99,235,0.3)] !text-white !rounded-[16px] flex items-center justify-center transition-all !border-none"
        title="นำทางด้วย Google Maps"
      >
        <span className="material-symbols-outlined text-[24px]">directions_car</span>
      </button>
    )}
  </div>
</div>
</div>

<div className="bg-white/90 backdrop-blur-2xl rounded-[24px] border border-emerald-100/50 overflow-hidden p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] space-y-4">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-[0_2px_10px_rgba(16,185,129,0.05)]">
      <span className="material-symbols-outlined text-[20px]">inventory_2</span>
    </div>
    <h3 className="text-[18px] font-black text-slate-800 tracking-tight">พัสดุในครอบครอง</h3>
  </div>
  <div className="space-y-3">
  {possessionList.length === 0 ? (
    <div className="py-10 bg-slate-50/50 rounded-[20px] flex flex-col items-center justify-center text-slate-400 border border-slate-100 border-dashed">
      <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
        <span className="material-symbols-outlined text-[28px] text-slate-300">box</span>
      </div>
      <p className="font-bold text-[13px] tracking-tight">ไม่มีพัสดุในครอบครอง</p>
    </div>
  ) : possessionList.map((it, idx) => {
    const condStr = it.condition ?` สภาพ ${it.condition}` : '';
    return (
      <div key={idx} className="flex flex-col p-5 bg-slate-50/50 rounded-[20px] text-left">
        <div className="flex justify-between items-center">
          <p className="text-[14px] font-black leading-snug">
            <span className="text-slate-800">
              {it.name}{it.detail ?` ${it.detail}` : ''}{it.size ?` ขนาด ${it.size}` : ''}{condStr}
            </span>
          </p>
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center ml-4 shrink-0">
            <span className="text-[16px] font-black text-emerald-600">{it.qty}</span>
          </div>
        </div>
      </div>
    );
  })}
  </div>
</div>

<div className="rounded-[2rem] overflow-hidden border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.06)]">
  {/* Section Header */}
  <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center gap-3">
    <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center">
      <span className="material-symbols-outlined text-emerald-400 text-[20px]">photo_camera</span>
    </div>
    <div>
      <p className="text-[13px] font-black text-white tracking-tight leading-none">รูปถ่ายหลักฐานหน้าร้าน</p>
      <p className="text-[10px] text-slate-400 font-medium mt-0.5 tracking-wider">STORE EVIDENCE PHOTO</p>
    </div>
  </div>

  {/* Photo Area */}
  <div className="bg-white p-5">
    <div className="flex justify-center">
      <div className="relative group">
      {(() => {
        const masterPhoto = getMasterPhoto(customerDraft) || getMasterPhoto(selectedCustomer);
        const currentPhoto = photos[0] || masterPhoto;
        if (currentPhoto) {
          return (
            <div className="w-full max-w-[280px] aspect-square bg-slate-100 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-lg relative group/img cursor-zoom-in" onClick={() => setPreviewImage(currentPhoto)}>
              <img src={currentPhoto} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" alt="store evidence" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400?text=Image+Load+Error'; }} />
              <div className="absolute inset-0 bg-slate-900/0 group-hover/img:bg-slate-900/20 flex items-center justify-center transition-all duration-300">
                <span className="material-symbols-outlined text-white text-[48px] opacity-0 group-hover/img:opacity-100 scale-50 group-hover/img:scale-100 transition-all duration-300">zoom_in</span>
              </div>
              {!isReadOnly && photos[0] && (
                <button onClick={(e) => { e.stopPropagation(); setPhotos([]); }} className="absolute top-4 right-4 w-12 h-12 bg-rose-500 hover:bg-rose-600 text-white shadow-lg rounded-2xl flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[24px]">close</span>
                </button>
              )}
              {!isReadOnly && !photos[0] && (
                <label className="absolute inset-0 bg-slate-900/60 opacity-0 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity duration-300 hover:opacity-100" onClick={e => e.stopPropagation()}>
                  <span className="material-symbols-outlined text-[48px] mb-2">add_a_photo</span>
                  <span className="text-[13px] font-bold tracking-tight">คลิกเพื่อเปลี่ยนรูป</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      compressImage(file).then(base64 => setPhotos([base64])).catch(console.error);
                    }
                  }} />
                </label>
              )}
            </div>
          );
        }
        return (
          !isReadOnly ? (
            <label className="w-[260px] h-[220px] flex flex-col items-center justify-center cursor-pointer group/upload relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-50 to-emerald-50/40 border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:from-emerald-50 hover:to-emerald-100/40 transition-all duration-300">
              {/* Animated pulse ring */}
              <div className="absolute w-28 h-28 rounded-full bg-emerald-400/10 animate-ping" style={{ animationDuration: '2.5s' }} />
              <div className="relative w-20 h-20 bg-white rounded-[1.5rem] flex items-center justify-center shadow-md mb-4 group-hover/upload:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-emerald-500 text-[36px]">add_a_photo</span>
              </div>
              <span className="text-[15px] font-black text-slate-700 tracking-tight">เพิ่มรูปถ่ายหน้าร้าน</span>
              <span className="text-[11px] font-semibold text-emerald-500 mt-1.5 bg-emerald-50 px-3 py-0.5 rounded-full">แตะเพื่อเปิดกล้อง</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  compressImage(file).then(base64 => setPhotos([base64])).catch(console.error);
                }
              }} />
            </label>
          ) : (
            <div className="w-[260px] h-[220px] bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col items-center justify-center text-slate-300">
              <span className="material-symbols-outlined text-[64px] mb-4 opacity-30">no_photography</span>
              <span className="text-[14px] font-bold tracking-tight text-slate-400">ยังไม่มีรูปถ่าย</span>
            </div>
          )
    );
  })()}
      </div>   {/* closes relative group */}
    </div>     {/* closes flex justify-center */}
  </div>       {/* closes bg-white p-5 Photo Area */}

  {/* Notes Area */}
  <div className="bg-slate-50 border-t border-slate-100 p-5">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-white rounded-xl border border-slate-100 flex items-center justify-center mt-0.5 shrink-0 shadow-sm">
        <span className="material-symbols-outlined text-slate-400 text-[18px]">edit_note</span>
      </div>
      <textarea
        placeholder="เพิ่มหมายเหตุการสำรวจตรงนี้..."
        value={note}
        onChange={e => setNote(e.target.value)}
        className="flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none min-h-[90px] placeholder-slate-300 resize-none leading-relaxed"
      />
    </div>
  </div>
</div>

 <div className="pt-8 space-y-4">
 <div className="flex items-center gap-3 px-2">
 <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
 <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">ประวัติรายการ</h3>
 </div>
 <CustomerSurveyHistory history={customerHistory} />
 </div>

 <div className="flex gap-3 pt-8 pb-10">
 <button onClick={() => setSelectedCustomer(null)} className="btn no-animation flex-1 h-14 bg-white border border-slate-200 text-slate-500 rounded-xl font-semibold text-[13px]">ยกเลิก</button>
 {!isReadOnly && (
 <button onClick={handleSaveSurvey} disabled={saving} className="btn no-animation flex-[2] h-14 btn-primary text-white rounded-xl flex items-center justify-center gap-3 font-semibold text-[13px] disabled:bg-slate-300">
 {saving ? <span className="app-spinner-sm" aria-hidden="true"></span> : <><Check size={18} /> ยืนยันบันทึก</>}
 </button>
 )}
 </div>
 </motion.div>
 </AnimatePresence>
 )}
 <CustomerQuickEdit 
 isOpen={showQuickEdit} 
 onClose={() => setShowQuickEdit(false)} 
 customer={null} 
 onSave={(newC) => {
 onRefresh();
 handleSelectCustomer(newC);
 }}
 thaiAddressData={thaiAddressData}
 customers={customers}
 />
 </div>
 );
}
