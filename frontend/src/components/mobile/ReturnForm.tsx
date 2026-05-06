import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
console.log('%c LOGISTICS_VERSION: 2.5.1 (UI-HARDENING) ', 'background: #222; color: #bada55');
import { getCustomers, saveMasterItem, processBatchTransaction, getNextTxnNo, getZones, getJobRequests } from '../../api';
import type { MaterialItem, Zone } from '../../types';
import { Button, Icon } from '../shared/CommonUI';

const ItemSelector = lazy(() => import('./ItemSelector'));
const LogisticsSummary = lazy(() => import('./LogisticsSummary'));
const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

interface ReturnFormProps {
 items: MaterialItem[];
 onSuccess: () => void;
 onClose?: () => void;
 operatorName: string;
 thaiAddressData: any[];
 transactions?: any[];
 warehouses?: any[];
 initialJobId?: string;
 setActiveTab?: (tab: any) => void;
 setLogisticsSubTab?: (tab: 'waiting' | 'active' | 'history') => void;
}

/**
 * Resizes and compresses an image to max 1024px width and stamps GPS/Time
 */
async function resizeAndCompressImage(base64Image: string, coords: string | null, maxWidth = 1024, quality = 0.8): Promise<string> {
 return new Promise((resolve, reject) => {
 const img = new Image();
 img.crossOrigin ="anonymous";
 img.onerror = (err) => {
 console.error("Image loading error:", err);
 reject(new Error("ไม่สามารถโหลดข้อมูลรูปภาพได้"));
 };
 img.onload = () => {
 try {
 const originalWidth = img.naturalWidth;
 const originalHeight = img.naturalHeight;
 let newWidth = originalWidth;
 let newHeight = originalHeight;

 if (originalWidth > maxWidth) {
 newWidth = maxWidth;
 newHeight = Math.floor(originalHeight * (maxWidth / originalWidth));
 }

 const canvas = document.createElement('canvas');
 canvas.width = newWidth;
 canvas.height = newHeight;
 const ctx = canvas.getContext('2d');
 if (!ctx) {
 return resolve(base64Image); // Fallback to original
 }

 ctx.drawImage(img, 0, 0, newWidth, newHeight);

 // Add Watermark
 const now = new Date();
 const dateStr = now.toLocaleDateString('th-TH') + ' ' + now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.';
 let watermarkText =`📅 ${dateStr}`;
 if (coords) watermarkText +=` | 📍 ${coords}`;

 ctx.font = 'bold 20px sans-serif';
 ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
 const textWidth = ctx.measureText(watermarkText).width;
 ctx.fillRect(0, newHeight - 35, textWidth + 30, 35);
 ctx.fillStyle = '#ffffff';
 ctx.fillText(watermarkText, 15, newHeight - 10);

 resolve(canvas.toDataURL('image/jpeg', quality));
 } catch (err) {
 console.error("Canvas processing error:", err);
 resolve(base64Image); // Fallback
 }
 };
 img.src = base64Image;
 });
}

const getCoordinates = (): Promise<string | null> => {
 return new Promise((resolve) => {
 if (!navigator.geolocation) return resolve(null);
 navigator.geolocation.getCurrentPosition(
 (pos) => resolve(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
 () => resolve(null),
 { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
 );
 });
};

const mapReturnReason = (text: string): string => {
 const normalized = String(text || '').trim();
 if (!normalized) return '';

 const options = [
 { key: 'ปิดการขาย (Sales Closed)', keywords: ['ปิดการขาย', 'Sales Closed', 'เลิกกิจการ', 'ปิดร้าน'] },
 { key: 'ไม่มีออเดอร์ (No Orders)', keywords: ['ไม่มีออเดอร์', 'No Orders', 'ไม่อยู่', 'ไม่ออเดอร์'] },
 { key: 'ของเสีย/ชำรุด (Broken/Damaged)', keywords: ['ของเสีย', 'ชำรุด', 'Broken', 'Damaged', 'เสีย', 'พัง'] },
 { key: 'เพิ่มพัสดุ (Add Item)', keywords: ['เพิ่มพัสดุ', 'Add Item', 'เพิ่ม'] },
 { key: 'เปลี่ยนพัสดุ (Exchange)', keywords: ['เปลี่ยนพัสดุ', 'Exchange', 'เปลี่ยน', 'Upgrade', 'Downgrade'] },
 { key: 'อื่นๆ', keywords: ['อื่นๆ', 'Other', 'อื่น'] },
 ];

 for (const opt of options) {
 if (opt.keywords.some(k => normalized.includes(k))) {
 return opt.key;
 }
 }

 return normalized;
};

export default function ReturnForm({
 items,
 onSuccess,
 onClose,
 operatorName,
 transactions = [],
 warehouses,
 initialJobId,
 setActiveTab,
 setLogisticsSubTab
}: ReturnFormProps) {
 const [step, setStep] = useState<'form' | 'success'>('form');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [cart, setCart] = useState<any[]>([]);
 const [cv, setCv] = useState('');
 const [deliveryBy, setDeliveryBy] = useState(operatorName);
 const now = new Date();
 const defaultDate = now.toLocaleDateString('en-CA');
 const defaultTime = '00:00';

 const [deliveryDate, setDeliveryDate] = useState<string>(defaultDate);
 const [deliveryTime, setDeliveryTime] = useState(defaultTime);
 const [workZone, setWorkZone] = useState('');
 const [note, setNote] = useState('');
 const [photos, setPhotos] = useState<string[]>([]);
 const [processingPhoto, setProcessingPhoto] = useState(false);
 const [savedTxnNo, setSavedTxnNo] = useState<string | null>(null);
 const [customers, setCustomers] = useState<any[]>([]);
 const [zones, setZones] = useState<Zone[]>([]);
 const [pendingJobs, setPendingJobs] = useState<any[]>([]);
 const [fetchingJobs, setFetchingJobs] = useState(false);
 const [hasFetchedJobs, setHasFetchedJobs] = useState(false);
 const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId || null);
 const [selectedJobOriginator, setSelectedJobOriginator] = useState('');
 const [isScannerOpen, setIsScannerOpen] = useState(false);
 const [activeScannerItemId, setActiveScannerItemId] = useState<string | null>(null);
 const [resetKey, setResetKey] = useState(0);
 const [isAddingExtra, setIsAddingExtra] = useState(false);
 const [returnReason, setReturnReason] = useState('');
 const [notifier, setNotifier] = useState(operatorName);
 const [notificationDate, setNotificationDate] = useState<string>(defaultDate);
 const [cabinetCondition, setCabinetCondition] = useState('ปกติ(รอตรวจ)');
 const [warehouseId, setWarehouseId] = useState<number>(1);

 useEffect(() => {
 getCustomers().then(setCustomers);
 getZones().then(setZones);
 fetchJobs();
 }, []);

 useEffect(() => {
 if (initialJobId && hasFetchedJobs && pendingJobs.length > 0) {
 try {
 const job = pendingJobs.find(j => String(j.jobId) === String(initialJobId));
 if (job) {
 const itemsToProcess = job.items || [];
 const finalItems = itemsToProcess
 .filter((ji: any) => {
 const aType = String(ji.action_type || ji.action ||"").toUpperCase();
 return aType === 'แจ้งคืน' || aType === 'RETURN' || aType === 'RECEIVE' || aType.includes('คืน');
 })
 .flatMap((ji: any) => {
 const tQty = Number(ji.quantity || ji.จำนวน || 1);
 const r = mapReturnReason(ji.returnReason || ji.return_reason || ji.สาเหตุ || ji.reason || job.returnReason || job.return_reason || job.สาเหตุ || job.reason || '');
 const category = String(ji.ประเภท ||"").trim();
 const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));

 if (!isTrackedUnit) {
 return [{
 id:`init_job_bulk_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`,
 action: 'receive',
 item: { ...ji, rowIndex: ji.item?.rowIndex || ji.rowIndex || ji.id, สภาพ: 'มือสอง' },
 quantity: tQty,
 status: ji.cabinet_status || ji.status || 'ปกติ',
 returnReason: r,
 serialNumber: (ji.serialNumber || ji.sn || '').trim(),
 assetTag: (ji.assetTag || ji.asset_tag || '').trim(),
 displayString: [ji.ประเภท, ji.ยี่ห้อหรือรูปแบบ, ji.รายการ].filter(Boolean).join(' '),
 isFromJob: true
 }];
 }
 
 return Array.from({ length: tQty }).map((_, idx) => ({
 id:`init_job_${Math.random().toString(36).slice(2, 9)}_${idx}_${Date.now()}`,
 action: 'receive',
 item: { ...ji, rowIndex: ji.item?.rowIndex || ji.rowIndex || ji.id, สภาพ: 'มือสอง' },
 quantity: 1, 
 status: ji.cabinet_status || ji.status || 'ปกติ',
 returnReason: r,
 serialNumber: (ji.serialNumber || ji.sn || '').trim(),
 assetTag: (ji.assetTag || ji.asset_tag || '').trim(),
 displayString: [ji.ประเภท, ji.ยี่ห้อหรือรูปแบบ, ji.รายการ].filter(Boolean).join(' '),
 isFromJob: true
 }));
 });

 if (finalItems.length > 0) {
 setCart(finalItems);
 setCv(job.cv || '');
 setNote(job.note || '');
 setReturnReason(mapReturnReason(job.returnReason || job.return_reason || job.สาเหตุ || job.reason || ''));
 if (job.operator) {
 setNotifier(job.operator);
 setSelectedJobOriginator(job.operator);
 }
 const wId = job.warehouse_id || job.warehouseId;
 if (wId) setWarehouseId(Number(wId));
 setSelectedJobId(job.jobId);
 
 setTimeout(() => window.scrollTo({ top: 400, behavior: 'smooth' }), 500);
 }
 }
 } catch (err) {
 console.error("Auto-import error:", err);
 }
 }
 }, [initialJobId, hasFetchedJobs, pendingJobs]);

 const fetchJobs = async () => {
 setFetchingJobs(true);
 try {
 const jobs = await getJobRequests();
 setPendingJobs(jobs);
 setHasFetchedJobs(true);
 } catch (err) {
 console.error('Error fetching jobs:', err);
 } finally {
 setFetchingJobs(false);
 }
 };

 const filteredJobs = useMemo(() => {
 return pendingJobs.filter(j => {
 const status = String(j.status || '').toUpperCase();
 return status === 'PENDING' || status === 'รออนุมัติ' || status === 'WAITING';
 });
 }, [pendingJobs]);

 const handleAddToCart = useCallback((item: any, quantity: number) => {
 setCart(prev => {
 const category = String(item.ประเภท ||"").trim();
 const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));

 if (!isTrackedUnit) {
 const existingIdx = prev.findIndex(c => 
 c.item?.รายการ === item.รายการ && 
 c.item?.ประเภท === item.ประเภท &&
 !c.isFromJob
 );

 if (existingIdx !== -1) {
 const updated = [...prev];
 updated[existingIdx] = { 
 ...updated[existingIdx], 
 quantity: updated[existingIdx].quantity + quantity 
 };
 return updated;
 }

 return [...prev, {
 id:`manual_bulk_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`,
 item,
 quantity,
 action: 'receive',
 status: 'รอตรวจ',
 returnReason: item.returnReason || '',
 serialNumber: '',
 assetTag: '',
 displayString: [item.ประเภท, item.ยี่ห้อหรือรูปแบบ, item.รายการ].filter(Boolean).join(' '),
 isFromJob: false
 }];
 }

 const newEntries = Array.from({ length: quantity }).map((_, i) => ({
 id:`manual_${Math.random().toString(36).slice(2, 11)}_${Date.now()}_${i}`,
 item,
 quantity: 1,
 action: 'receive',
 status: 'รอตรวจ',
 returnReason: item.returnReason || '',
 serialNumber: '',
 assetTag: '',
 displayString: [item.ประเภท, item.ยี่ห้อหรือรูปแบบ, item.รายการ].filter(Boolean).join(' '),
 isFromJob: false
 }));
 
 return [...prev, ...newEntries];
 });
 setIsAddingExtra(false); // Close selector after adding
 }, []);

 const removeFromCart = (id: string) => {
 setCart(prev => prev.filter(c => c.id !== id));
 };

 const resetAll = () => {
 setCart([]);
 setCv('');
 setNote('');
 setPhotos([]);
 setSavedTxnNo(null);
 setStep('form');
 setResetKey(prev => prev + 1);
 setSelectedJobId(null);
 setSelectedJobOriginator('');
 if (onSuccess) onSuccess();
 if (onClose) onClose();
 };

 const updateStep = (newStep: 'form' | 'success') => {
 setStep(newStep);
 if (newStep === 'success') {
 window.scrollTo({ top: 0, behavior: 'smooth' });
 }
 };

 const captureScreenshot = async () => {
 const el = document.getElementById('return-success-receipt');
 if (!el) return;
 try {
 document.body.style.cursor = 'wait';
 const html2canvas = (await import('html2canvas')).default;
 el.scrollIntoView({ behavior: 'auto', block: 'start' });
 const canvas = await html2canvas(el, {
 scale: 2, useCORS: true, logging: false, backgroundColor: '#f8fafc',
 onclone: (clonedDoc) => {
 const clonedEl = clonedDoc.getElementById('return-success-receipt');
 if (clonedEl) {
 clonedEl.style.width = '600px';
 clonedEl.style.height = 'auto';
 clonedEl.style.overflow = 'visible';
 }
 }
 });
 const image = canvas.toDataURL('image/png');
 const link = document.createElement('a');
 link.href = image;
 link.download =`receipt-${savedTxnNo || 'return'}-${Date.now()}.png`;
 document.body.appendChild(link);
 link.click();
 setTimeout(() => { document.body.removeChild(link); document.body.style.cursor = 'default'; }, 100);
 } catch (err) {
 console.error('Screenshot error:', err);
 document.body.style.cursor = 'default';
 alert("ไม่สามารถบันทึกภาพได้");
 }
 };

 if (step === 'success') {
 const matchedCustomer = customers.find(c => String(c.cv || c.CV || '').trim() === String(cv).trim());
 const matchedJob = pendingJobs.find(j => String(j.jobId) === String(selectedJobId));

 const jobIssueItems = (matchedJob?.items || []).filter((ji: any) => {
 const aType = String(ji.action_type || ji.action ||"").toUpperCase();
 return aType === 'ISSUE' || aType === 'DELIVERY' || aType.includes('ส่ง');
 });

 return (
 <div className="max-w-2xl mx-auto py-6 px-4 mb-20 text-left">
 <div id="return-success-receipt" className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
 {/* 🏳️ Minimal Header */}
 <div className="px-8 py-6 border-b border-slate-100 mobile-row flex items-center justify-between">
 <div className="space-y-1">
 <h2 className="text-xl font-bold text-slate-900 tracking-tight">บันทึกรายการสำเร็จ</h2>
 <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest">Transaction Confirmed</p>
 </div>
 <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
 <span className="material-symbols-outlined text-[24px]">check_circle</span>
 </div>
 </div>

 <div className="p-8 space-y-10">
 {/* 📂 ID & Job Section */}
 <div className="grid grid-cols-2 gap-8 pb-8 border-b border-slate-100">
 <div className="space-y-1.5">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">หมายเลขอ้างอิง</p>
 <p className="text-[18px] font-bold text-slate-900 tracking-tight font-mono">{savedTxnNo || 'TXN-PENDING'}</p>
 </div>
 {selectedJobId && (
 <div className="space-y-1.5">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">เลขที่ใบแจ้งงาน (JOB)</p>
 <p className="text-[18px] font-bold text-indigo-600 tracking-tight">{selectedJobId}</p>
 </div>
 )}
 </div>

 {/* 👤 Participant Section */}
 <div className="grid grid-cols-3 gap-4 pb-8 border-b border-slate-100">
 <div className="space-y-1.5">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ผู้กวาดรายการ</p>
 <p className="text-[14px] font-bold text-slate-800">{operatorName}</p>
 </div>
 <div className="space-y-1.5 border-l border-slate-100 pl-6">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">สถานที่ / เขต</p>
 <p className="text-[14px] font-bold text-slate-800 line-clamp-2">{workZone || 'ไม่ระบุเขต'}</p>
 </div>
 <div className="space-y-1.5 border-l border-slate-100 pl-6">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ลูกค้า / CV</p>
 <p className="text-[14px] font-bold text-slate-800 truncate">{matchedCustomer?.name || 'ไม่ระบุ'}</p>
 <p className="text-[11px] font-bold text-slate-400 uppercase">CV: {cv || 'N/A'}</p>
 </div>
 </div>

 <div className="space-y-12">
 {/* 📦 List 1: Issued Items */}
 {jobIssueItems.length > 0 && (
 <div className="space-y-4">
 <div className="flex items-center gap-2">
 <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">พัสดุที่เบิกส่งออก ({jobIssueItems.length})</p>
 </div>
 <div className="space-y-2">
 {jobIssueItems.map((c: any, idx: number) => (
 <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100">
 <div className="flex justify-between items-start gap-4">
 <div className="space-y-1.5 flex-1 text-left">
 <p className="text-[15px] font-bold text-slate-800 uppercase leading-tight">
 [{c.ประเภท || c.type ||"พัสดุ"}] {c.ยี่ห้อหรือรูปแบบ || c.brand} {c.รายการ || c.name} {c.ขนาด}
 </p>
 <div className="flex flex-wrap gap-3 items-center">
 {c.serialNumber && (
 <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">S/N: {c.serialNumber}</span>
 )}
 {c.assetTag && (
 <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">Asset: {c.assetTag}</span>
 )}
 <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-tighter">
 สภาพ: {c.สภาพ || c.condition || 'ปกติ (Stock)'}
 </span>
 </div>
 </div>
 <div className="text-right shrink-0">
 <span className="text-[18px] font-bold text-slate-900 leading-none">x{c.quantity || 1}</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* 📥 List 2: Returned Items */}
 <div className="space-y-4">
 <div className="flex items-center gap-2">
 <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">พัสดุที่กดยอมรับคืน ({cart.length})</p>
 </div>
 <div className="space-y-2">
 {cart.map((c, idx) => (
 <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100">
 <div className="flex justify-between items-start gap-4">
 <div className="space-y-1.5 flex-1 text-left">
 <p className="text-[15px] font-bold text-slate-800 uppercase leading-tight">
 [{c.item?.ประเภท || c.item?.type ||"พัสดุ"}] {c.item?.ยี่ห้อหรือรูปแบบ || c.item?.brand} {c.item?.รายการ || c.item?.name} {c.item?.ขนาด}
 </p>
 <div className="flex flex-wrap gap-3 items-center mt-1">
 <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">S/N: {c.serialNumber || '-'}</span>
 <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">Asset: {c.assetTag || '-'}</span>
 <span className="text-[11px] font-bold text-rose-500 uppercase tracking-tighter">สาเหตุ: {c.returnReason || '-'}</span>
 </div>
 </div>
 <div className="text-right shrink-0">
 <span className="text-[18px] font-bold text-slate-900 leading-none">x{c.quantity || 1}</span>
 <div className="mt-2 text-right">
 {(() => {
 const s = c.status || 'รอตรวจ';
 let color = 'bg-slate-100 text-slate-500 border-slate-200';
 if (s === 'ปกติ') color = 'bg-emerald-50 text-emerald-600 border-emerald-100';
 if (s === 'รอซ่อม') color = 'bg-purple-50 text-purple-600 border-purple-100';
 if (s === 'สูญหาย') color = 'bg-rose-50 text-rose-600 border-rose-100';
 if (s === 'ชำรุดหนัก/ซาก') color = 'bg-slate-900 text-white border-transparent';
 
 return (
 <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${color}`}>
 {s}
 </span>
 )
 })()}
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {note && (
 <div className="pt-8 border-t border-slate-100">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">หมายเหตุ</p>
 <p className="text-[13px] font-bold text-slate-700 italic">"{note}"</p>
 </div>
 )}
 </div>
 </div>
 <div className="mt-8 flex flex-col gap-3 max-w-md mx-auto">
 <button onClick={captureScreenshot} className="btn no-animation h-16 bg-slate-900 text-white rounded-full font-bold text-[14px] uppercase tracking-widest flex items-center justify-center gap-3 border border-slate-800">
 <span className="material-symbols-outlined">crop_free</span>
 <span>CAP หน้าจอเก็บหลักฐาน</span>
 </button>
 <button onClick={resetAll} className="btn no-animation h-16 bg-blue-600 text-white rounded-full font-bold text-[15px] uppercase tracking-[0.2em]">ตกลง</button>
 </div>
 </div>
 );
 }

 return (
 <div className="mobile-page-frame relative">
 <div className="mobile-surface-card overflow-hidden">
 <div className="mobile-form-hero border-b border-base-300">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-purple-600 border border-purple-100/50 shrink-0">
 <span className="material-symbols-outlined text-[28px]">assignment_return</span>
 </div>
 <div className="flex flex-col">
 <h1 className="mobile-form-hero-title">ทำรายการรับคืน <span className="ml-2 inline-flex rounded-full bg-secondary px-2 py-0.5 align-middle text-[9px] font-semibold text-secondary-content">VER 2.5.1</span></h1>
 <p className="mobile-form-hero-subtitle">Logistics Return Management & Visibility</p>
 </div>
 </div>

 {/* 📇 Customer Intelligence Card */}
 {cv && (
 <div className="flex-1 max-w-xl">
 <div className="bg-white/80 px-5 py-4 rounded-xl border border-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div className="flex-1 min-w-0 pr-4 text-left">
 <div className="flex items-center gap-2 mb-1.5">
 <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest leading-none">ข้อมูลลูกค้าที่รับคืน</p>
 <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
 <p className="text-[10px] font-black text-slate-400 uppercase leading-none">CV: <span className="text-purple-600 font-extrabold">{cv}</span></p>
 {(() => {
 const c = customers.find(cus => String(cus.cv || cus.CV || '').trim() === String(cv).trim());
 return (
 <div className="flex items-center gap-1.5">
 {c?.phone && (
 <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 text-white rounded-md text-[9px] font-bold">
 <span className="material-symbols-outlined text-[11px]">call</span>
 {c.phone}
 </a>
 )}
 <button
 onClick={() => {
 if (c) window.open(`https://www.google.com/maps/search/?api=1&query=${c.latitude || c.lat},${c.longitude || c.lng}`, '_blank');
 }}
 className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center outline-none border border-slate-100"
 >
 <span className="material-symbols-outlined text-[16px]">map</span>
 </button>
 </div>
 );
 })()}
 </div>
 </div>
 <h3 className="text-[16px] font-black text-slate-950 leading-tight uppercase truncate">
 {customers.find(c => String(c.cv || c.CV || '').trim() === String(cv).trim())?.name || 'ไม่พบข้อมูลชื่อลูกค้า'}
 </h3>
 {(() => {
 const c = customers.find(cus => String(cus.cv || cus.CV || '').trim() === String(cv).trim());
 return c?.address && (
 <div className="flex items-center gap-1.5 mt-1">
 <span className="material-symbols-outlined text-[12px] text-slate-300 shrink-0">location_on</span>
 <p className="text-[10px] font-semibold text-slate-400 truncate italic">
 {[c.address, c.subdistrict || c.sub_district, c.district, c.province].filter(Boolean).join(' ')}
 </p>
 </div>
 );
 })()}
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 <Suspense fallback={<div className="p-6 text-center text-base-content/50 font-semibold"><span className="app-spinner-sm mr-2" aria-hidden="true"></span>กำลังโหลดข้อมูล...</div>}>
 <div className="p-4 sm:p-8 space-y-10">
 <div className="px-2 py-6 sm:p-6 bg-slate-50/50 border-b border-slate-100 space-y-4 rounded-3xl">
 <button
 onClick={fetchJobs}
 disabled={fetchingJobs}
 className="btn no-animation w-full mobile-row flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl group"
 >
 <div className="flex items-center gap-3 text-left">
 <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
 <span className="material-symbols-outlined text-[24px]">sync</span>
 </div>
 <div className="flex flex-col">
 <p className="text-[13px] font-black text-slate-800 uppercase leading-none mb-0.5">ดึงข้อมูลจากแผนแจ้งงาน</p>
 <p className={`text-[10px] font-black uppercase tracking-[0.1em] text-purple-400`}>
 {fetchingJobs ?"กำลังดึงข้อมูล..." :`${filteredJobs.length} รายการที่รอรับคืน`}
 </p>
 </div>
 </div>
 </button>

 <div className="flex gap-2">
 <div className="flex-1 relative">
 <select
 className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-4 pl-12 text-[12.5px] font-bold text-slate-700 outline-none focus:border-purple-500 appearance-none disabled:opacity-50"
 value={selectedJobId ||""}
 onFocus={() => { if (!hasFetchedJobs) fetchJobs(); }}
 onChange={(e) => {
 const val = e.target.value;
 setSelectedJobId(val);
 const job = pendingJobs.find(j => String(j.jobId) === String(val));
 if (job) setSelectedJobOriginator(job.operator || '');
 }}
 disabled={cart.some(c => c.isFromJob) || fetchingJobs}
 >
 <option value="">-- เลือกเลขนัดหมาย (JobID) --</option>
 {filteredJobs.map(job => <option key={job.jobId} value={job.jobId}>{job.jobId} | {job.cv}</option>)}
 </select>
 <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">assignment</span>
 </div>
 {cart.some(c => c.isFromJob) ? (
 <button onClick={() => { setSelectedJobId(null); setCart([]); setCv(""); setNote(""); }} className="bg-rose-50 text-rose-500 h-14 px-4 rounded-2xl border border-rose-100"><span className="material-symbols-outlined">link_off</span></button>
 ) : (
 <button
 onClick={() => {
 const job = pendingJobs.find(j => String(j.jobId) === String(selectedJobId));
 if (!job) return;
 const finalItems = (job.items || [])
 .filter((ji: any) => {
 const aType = String(ji.action_type || ji.action ||"").toUpperCase();
 return ['แจ้งคืน', 'RETURN', 'RECEIVE'].some(k => aType.includes(k));
 })
 .flatMap((ji: any) => {
 const tQty = Number(ji.quantity || ji.จำนวน || 1);
 const r = mapReturnReason(ji.returnReason || ji.สาเหตุ || job.สาเหตุ || '');
 const category = String(ji.ประเภท ||"").trim();
 const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));

 if (!isTrackedUnit) {
 return [{
 id:`job_bulk_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`,
 action: 'receive',
 item: { ...ji, rowIndex: ji.id || ji.rowIndex, สภาพ: 'มือสอง' },
 quantity: tQty,
 status: ji.cabinet_status || ji.status || 'ปกติ',
 returnReason: r,
 serialNumber: (ji.serialNumber || ji.sn || '').trim(),
 displayString: [ji.ประเภท, ji.ยี่ห้อหรือรูปแบบ, ji.รายการ].filter(Boolean).join(' '),
 isFromJob: true
 }];
 }

 return Array.from({ length: tQty }).map((_, i) => ({
 id:`job_${Math.random().toString(36).slice(2, 9)}_${i}_${Date.now()}`,
 action: 'receive',
 item: { ...ji, rowIndex: ji.id || ji.rowIndex, สภาพ: 'มือสอง' },
 quantity: 1,
 status: ji.cabinet_status || ji.status || 'ปกติ',
 returnReason: r,
 serialNumber: (ji.serialNumber || ji.sn || '').trim(),
 displayString: [ji.ประเภท, ji.ยี่ห้อหรือรูปแบบ, ji.รายการ].filter(Boolean).join(' '),
 isFromJob: true
 }));
 });
 if (finalItems.length === 0) { setError("ไม่พบรายการรับคืน"); return; }
 setCart(finalItems);
 setCv(job.cv || '');
 setNote(job.note || '');
 setReturnReason(mapReturnReason(job.สาเหตุ || ''));
 if (job.operator) setSelectedJobOriginator(job.operator);
 const wId = job.warehouse_id || job.warehouseId;
 if (wId) setWarehouseId(Number(wId));
 }}
 disabled={!selectedJobId || fetchingJobs || cart.some(c => c.isFromJob)}
 className="bg-slate-900 text-white font-black h-14 px-6 rounded-2xl disabled:opacity-50"
 >
 ตกลง
 </button>
 )}
 </div>
 </div>

 {/* ➕ Add Extra Items Toggle */}
 {selectedJobId && (
 <div className="px-2">
 <button 
 onClick={() => setIsAddingExtra(!isAddingExtra)}
 className={`w-full h-16 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 ${isAddingExtra ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-500'}`}
 >
 <span className="material-symbols-outlined text-[24px]">
 {isAddingExtra ? 'close' : 'add_circle'}
 </span>
 <span className="text-[14px] font-black uppercase tracking-widest">
 {isAddingExtra ? 'ปิดหน้าต่างเพิ่มพัสดุ' : '+ เพิ่มพัสดุนอกใบงาน (เก็บกลับเพิ่ม)'}
 </span>
 </button>
 </div>
 )}

 {(!selectedJobId || isAddingExtra) && (
 <div className="">
 <ItemSelector 
 key={resetKey} 
 items={items} 
 action="receive" 
 cart={cart} 
 tempSubItems={[]} 
 onAddToCart={(it, qty) => {
 // Force the reason to 'เพิ่มพัสดุ' for manually added items if there's a JobID
 handleAddToCart({...it, returnReason: selectedJobId ? 'เพิ่มพัสดุ (Add Item)' : ''}, qty);
 }} 
 onAddSubItem={() => { }} 
 onRemoveSubItem={() => { }} 
 onUpdateSubItemQty={() => { }} 
 setError={setError} 
 error={error} 
 fixedCondition="มือสอง" 
 />
 </div>
 )}

 {cart.length > 0 && (
 <div className="bg-slate-50 border-t border-slate-100 rounded-3xl overflow-hidden mt-8">
 <div className="p-4 sm:p-8 space-y-8">
 <div className="mobile-row flex items-center justify-between">
 <h4 className="text-[14px] font-black uppercase text-slate-900 tracking-tight">รายการคัดกรองพัสดุ ({cart.length} ชิ้น)</h4>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {cart.map((c, idx) => {
 const category = String(c.item?.ประเภท ||"").trim();
 const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));

 return (
 <div key={c.id} className="bg-white rounded-xl p-6 border border-slate-100 relative overflow-hidden group">
 <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
 <div className="flex justify-between items-start mb-4">
 <div className="space-y-1">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded uppercase tracking-wider">UNIT {idx + 1}</span>
 {c.isFromJob && <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase">JOB</span>}
 {/* 📦 Prominent Quantity Display */}
 {c.quantity > 1 && (
 <div className="bg-slate-900 text-white px-2.5 py-0.5 rounded-lg font-black text-[12px]">
 x{c.quantity}
 </div>
 )}
 </div>
 <p className="text-[16px] font-black text-slate-900 uppercase leading-none">{c.item?.ประเภท ||"พัสดุ"} {c.item?.ยี่ห้อหรือรูปแบบ}</p>
 <p className="text-[11px] font-bold text-slate-400 uppercase">{c.item?.รายการ} {c.item?.ขนาด &&`(${c.item.ขนาด})`}</p>
 </div>
 <button onClick={() => removeFromCart(c.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center"><Icon name="delete" size="sm" /></button>
 </div>

 <div className="space-y-4">
 {/* 🔍 Conditionally show SN Input */}
 {isTrackedUnit && (
 <div className="space-y-2">
 <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
 <div className="space-y-1.5">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Serial Number (S/N)</label>
 <input
 type="text"
 placeholder="ระบุ S/N..."
 className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-[13px] font-bold text-slate-700 outline-none focus:border-rose-400 focus:bg-white"
 value={c.serialNumber || ''}
 onChange={e => setCart(prev => prev.map(item => item.id === c.id ? { ...item, serialNumber: e.target.value } : item))}
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Asset Tag</label>
 <input
 type="text"
 placeholder="ระบุ Asset Tag..."
 className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-[13px] font-bold text-slate-700 outline-none focus:border-rose-400 focus:bg-white"
 value={c.assetTag || ''}
 onChange={e => setCart(prev => prev.map(item => item.id === c.id ? { ...item, assetTag: e.target.value } : item))}
 />
 </div>
 <button onClick={() => { setActiveScannerItemId(c.id); setIsScannerOpen(true); }} className="h-12 w-full md:w-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center"><span className="material-symbols-outlined">barcode_scanner</span></button>
 </div>
 <p className="text-[10px] font-medium text-slate-400 px-1">ถ้ามีรหัสเดียว กรอกช่องใดช่องหนึ่งได้ ระบบยัง fallback ให้เหมือนเดิม</p>
 </div>
 )}

 <div className="space-y-1.5">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">สาเหตุการรับกลับ (REASON) *</label>
 <select
 className="w-full h-11 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-[12px] font-bold text-slate-700 outline-none focus:bg-white focus:border-rose-300"
 value={c.returnReason || ''}
 disabled={c.isFromJob}
 onChange={e => setCart(prev => prev.map(item => item.id === c.id ? { ...item, returnReason: e.target.value } : item))}
 >
 <option value="">-- เลือกสาเหตุ --</option>
 <option value="ปิดการขาย (Sales Closed)">ปิดการขาย (Sales Closed)</option>
 <option value="ไม่มีออเดอร์ (No Orders)">ไม่มีออเดอร์ (No Orders)</option>
 <option value="ของเสีย/ชำรุด (Broken/Damaged)">ของเสีย/ชำรุด (Broken/Damaged)</option>
 <option value="เพิ่มพัสดุ (Add Item)">เพิ่มพัสดุ (Add Item)</option>
 <option value="เปลี่ยนพัสดุ (Exchange)">เปลี่ยนพัสดุ (Exchange)</option>
 <option value="อื่นๆ">อื่นๆ</option>
 </select>
 </div>

 <div className="grid grid-cols-2 gap-2">
 {['ปกติ', 'รอซ่อม', 'สูญหาย', 'ชำรุดหนัก/ซาก'].map(opt => (
 <button
 key={opt}
 onClick={() => setCart(prev => prev.map(item => item.id === c.id ? { ...item, status: opt } : item))}
 className={`py-2 rounded-xl text-[10px] font-black border ${c.status === opt ? 'bg-slate-900 text-white border-transparent' : 'bg-white text-slate-400 border-slate-100'}`}
 >
 {opt}
 </button>
 ))}
 </div>
 </div>
 </div>
 );
 })}
 </div>

 </div>

 <div className="p-4 sm:p-8 space-y-8 bg-white border-t border-slate-50">
 <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-4">
 <h3 className="font-bold text-slate-700">ถ่ายรูปประกอบ ({photos.length}/6)</h3>
 <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
 {photos.slice(0, 6).map((p, i) => <div key={i} className="relative aspect-square rounded-xl overflow-hidden"><img src={p} className="w-full h-full object-cover" /><button onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1"><Icon name="close" size="xs" /></button></div>)}
 {photos.length < 6 && (
 <label className="aspect-square bg-white border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer">
 <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
 const file = e.target.files?.[0]; if (!file) return;
 setProcessingPhoto(true); try {
 const coords = await getCoordinates();
 const reader = new FileReader();
 const base64 = await new Promise<string>((res) => { reader.onloadend = () => res(reader.result as string); reader.readAsDataURL(file); });
 const compressed = await resizeAndCompressImage(base64, coords);
 setPhotos(prev => [...prev, compressed]);
 } catch (err) { console.error(err); } finally { setProcessingPhoto(false); }
 }} />
 <Icon name="photo_camera" className="text-slate-300" />
 </label>
 )}
 </div>
 </div>

 <LogisticsSummary
 cart={cart.map(c => ({ ...c, cabinetCondition: c.status }))}
 action="return" cv={cv} setCv={setCv} deliveryBy={deliveryBy} setDeliveryBy={setDeliveryBy}
 deliveryDate={deliveryDate} setDeliveryDate={setDeliveryDate} deliveryTime={deliveryTime} setDeliveryTime={setDeliveryTime}
 workZone={workZone} setWorkZone={setWorkZone} note={note} setNote={setNote}
 onSuccess={(txnNo) => setSavedTxnNo(txnNo)} setStep={updateStep}
 operatorName={operatorName} loading={loading || processingPhoto} photos={photos} setLoading={setLoading} setError={setError} error={error}
 customers={customers} zones={zones} transactions={transactions} notifier={notifier} setNotifier={setNotifier}
 notificationDate={notificationDate} setNotificationDate={setNotificationDate}
 returnReason={returnReason} setReturnReason={setReturnReason}
 cabinetCondition={cabinetCondition} setCabinetCondition={setCabinetCondition}
 jobId={selectedJobId} matchedJob={pendingJobs.find(j => String(j.jobId) === String(selectedJobId))}
 warehouses={warehouses} warehouseId={warehouseId} setWarehouseId={setWarehouseId}
 onEditCustomer={() => {}}
 />
 </div>
 </div>
 )}
 </div>
 </Suspense>
 </div>

 <Suspense fallback={null}>
 {isScannerOpen && (
 <BarcodeScanner
 onScan={(code) => {
 setCart(prev => prev.map(item => item.id === activeScannerItemId ? { ...item, serialNumber: code, assetTag: item.assetTag || code } : item));
 setIsScannerOpen(false);
 }}
 onClose={() => setIsScannerOpen(false)}
 isOpen={isScannerOpen}
 />
 )}
 </Suspense>
 </div>
 );
}
