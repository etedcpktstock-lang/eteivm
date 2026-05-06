import { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import type { MaterialItem, Customer } from '../../types';
import { Button, Icon } from '../shared/CommonUI';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import { getCustomers, saveJobRequest } from '../../api';
import { calculateCustomerInventory } from '../../utils/logisticsUtils';

const JobRequestItemSelector = lazy(() => import('./JobRequestItemSelector'));
const CustomerQuickEdit = lazy(() => import('../shared/CustomerQuickEdit'));
const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

interface JobRequestFormProps {
 items: MaterialItem[];
 customers: Customer[];
 operatorName: string;
 onSuccess: () => void;
 onClose: () => void;
 thaiAddressData?: any[];
 warehouses?: any[];
 transactions?: any[];
 logisticsJobs?: any[];
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
 if (!ctx) return resolve(base64Image);

 ctx.drawImage(img, 0, 0, newWidth, newHeight);

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
 resolve(base64Image);
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


export default function JobRequestForm({ items, warehouses = [], customers: initialCustomers, operatorName, onSuccess, onClose, thaiAddressData = [], transactions = [], logisticsJobs = [] }: JobRequestFormProps) {

 const PREFIX =`ete-job-request-${operatorName}`;
 
 const [cv, setCv] = useState(() => localStorage.getItem(`${PREFIX}-cv`) || '');
 const [note, setNote] = useState(() => localStorage.getItem(`${PREFIX}-note`) || '');
 const [returnReason, setReturnReason] = useState(() => localStorage.getItem(`${PREFIX}-returnReason`) || '');
 
 const now = new Date();
 const defaultDate = now.toLocaleDateString('en-CA');
 const defaultTime ="00:00";

 const [appointmentDate, setAppointmentDate] = useState(() => localStorage.getItem(`${PREFIX}-appointmentDate`) || defaultDate);
 const [appointmentTime, setAppointmentTime] = useState(() => localStorage.getItem(`${PREFIX}-appointmentTime`) || defaultTime);

 const [step, setStep] = useState<'form' | 'success'>(() => {
 const saved = localStorage.getItem(`${PREFIX}-step`);
 return (saved as any) || 'form';
 });
 const [jobId, setJobId] = useState(() => localStorage.getItem(`${PREFIX}-jobid`) || '');
 const [warehouseId, setWarehouseId] = useState<number>(() => {
 const saved = localStorage.getItem(`${PREFIX}-warehouseId`);
 return saved ? parseInt(saved) : (warehouses?.[0]?.id || 1);
 });

 const [photos, setPhotos] = useState<string[]>([]);
 const [processingPhoto, setProcessingPhoto] = useState(false);

 const [loading, setLoading] = useState(false);
 const [customers, setCustomers] = useState<Customer[]>(initialCustomers || []);
 const [isSearching, setIsSearching] = useState(false);
 const [searchResults, setSearchResults] = useState<Customer[]>([]);
 const [isScannerOpen, setIsScannerOpen] = useState(false);
 const [activeScanTarget, setActiveScanTarget] = useState<{ id: string; index: number } | null>(null);

 const updateStep = (newStep: 'form' | 'success') => {
 setStep(newStep);
 localStorage.setItem(`${PREFIX}-step`, newStep);
 };

 const [cart, setCart] = useState<any[]>(() => {
 const saved = localStorage.getItem(`${PREFIX}-cart`);
 if (!saved) return [];
 try { return JSON.parse(saved); } catch { return []; }
 });

 const [returnCart, setReturnCart] = useState<any[]>(() => {
 const saved = localStorage.getItem(`${PREFIX}-return-cart`);
 if (!saved) return [];
 try { return JSON.parse(saved); } catch { return []; }
 });

 const [tempSubItems, setTempSubItems] = useState<any[]>(() => {
 const saved = localStorage.getItem(`${PREFIX}-temp-sub`);
 try { return saved ? JSON.parse(saved) : []; } catch { return []; }
 });
 const [tempReturnSubItems, setTempReturnSubItems] = useState<any[]>(() => {
 const saved = localStorage.getItem(`${PREFIX}-temp-return-sub`);
 try { return saved ? JSON.parse(saved) : []; } catch { return []; }
 });

 // Save changes to localStorage (No infinite loop)
 useEffect(() => {
 localStorage.setItem(`${PREFIX}-cv`, cv);
 localStorage.setItem(`${PREFIX}-note`, note);
 localStorage.setItem(`${PREFIX}-returnReason`, returnReason);
 localStorage.setItem(`${PREFIX}-appointmentDate`, appointmentDate);
 localStorage.setItem(`${PREFIX}-appointmentTime`, appointmentTime);
 localStorage.setItem(`${PREFIX}-cart`, JSON.stringify(cart));
 localStorage.setItem(`${PREFIX}-return-cart`, JSON.stringify(returnCart));
 localStorage.setItem(`${PREFIX}-temp-sub`, JSON.stringify(tempSubItems));
 localStorage.setItem(`${PREFIX}-temp-return-sub`, JSON.stringify(tempReturnSubItems));
 localStorage.setItem(`${PREFIX}-warehouseId`, warehouseId.toString());
 localStorage.setItem(`${PREFIX}-step`, step);
 localStorage.setItem(`${PREFIX}-jobid`, jobId);
 }, [cv, cart, returnCart, note, step, PREFIX, jobId, tempSubItems, tempReturnSubItems, appointmentDate, appointmentTime, warehouseId]);


  const matchedCustomer = useMemo(() => {
    return (customers || []).find(c => String(c.cv || c.CV || '') === String(cv));
  }, [customers, cv]);

  const customerPossession = useMemo(() => {
    if (!matchedCustomer) return [];
    return calculateCustomerInventory(transactions, matchedCustomer.cv, logisticsJobs, items);
  }, [matchedCustomer, transactions, logisticsJobs, items]);

  const [usePossessionForReturn, setUsePossessionForReturn] = useState(true);

  // Convert possession map back to MaterialItem format for the selector
  const possessionItems = useMemo(() => {
    return customerPossession.map((p: any) => {
      // Find the master item using item_id for 100% accuracy
      let master = p.item_id ? items.find(i => String(i.id) === String(p.item_id) || String(i.rowIndex) === String(p.item_id) || String(i.item_id) === String(p.item_id)) : null;
      
      // Fallback matching if item_id is somehow missing
      if (!master) {
        master = items.find(i => {
            const formatted = `${i.ประเภท || ''} ${i.ยี่ห้อหรือรูปแบบ || i.brand || ''} ${i.รายการ || i.item_name || ''} ${i.รายละเอียด || i.details || ''}`.replace(/\s+/g, ' ').trim() || i.รายการ;
            return formatted === p.name && (p.size ? i.ขนาด === p.size : true);
        });
      }

      if (!master) return null; // Must exist in master list to be returnable
      
      return {
        ...master,
        available_stock: p.qty, // Mock available stock as the possessed quantity!
        warehouse_stocks: undefined, // Force selector to use available_stock instead of warehouse stock
      } as MaterialItem;
    }).filter(Boolean); // Remove nulls
  }, [customerPossession, items]);

  const [error, setError] = useState<string | null>(null);
 const [resetKey, setResetKey] = useState(Date.now()); 

 const handleSearch = async () => {
 const search = cv.trim().toLowerCase();
 if (!search) { setError("กรุณาระบุชื่อ หรือ เลข CV เพื่อค้นหา"); return; }
 setIsSearching(true); setError(null);
 try {
 let hits = (customers || []).filter(c => {
 const customerCv = String(c.cv || c.CV || '').toLowerCase();
 const customerName = String(c.name || '').toLowerCase();
 return customerCv.includes(search) || customerName.includes(search);
 }).slice(0, 50);
 if (hits.length === 0) {
 const freshData = await getCustomers(true);
 setCustomers(freshData);
 hits = freshData.filter((c: any) => {
 const customerCv = String(c.cv || c.CV || '').toLowerCase();
 const customerName = String(c.name || '').toLowerCase();
 return customerCv.includes(search) || customerName.includes(search);
 }).slice(0, 50);
 }
 if (hits.length === 0) { setError("ไม่พบข้อมูลลูกค้า"); setSearchResults([]); } else { setSearchResults(hits); }
 } catch (err: any) { setError("เกิดข้อผิดพลาดในการค้นหา:" + err.message); } finally { setIsSearching(false); }
 };

 const handleAddToCart = useCallback((item: MaterialItem, quantity: number, displayString: string, serialNumber?: string) => {
 setCart(prev => {
 const category = (item.ประเภท || '').trim();
 // Only"ตู้แช่" (Main fridge units) need individual tracking/exploding
 //"อุปกรณ์ตู้" (Accessories) should be grouped
 const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));
 
 if (!isTrackedUnit || serialNumber) {
 const existingIdx = prev.findIndex(c => 
 c.item?.รายการ === item.รายการ && 
 c.item?.ประเภท === item.ประเภท &&
 c.item?.ขนาด === item.ขนาด &&
 c.displayString === displayString &&
 !c.serialNumber &&
 !serialNumber
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
 id:`delivery_${Math.random().toString(36).substring(7)}_${Date.now()}`, 
 item, 
 quantity, 
 displayString, 
 serialNumber,
 assetTag: '',
 subItems: tempSubItems.length > 0 ? [...tempSubItems] : undefined 
 }];
 }

 const newEntries = Array.from({ length: quantity }).map((_, i) => ({ 
 id:`delivery_${Math.random().toString(36).substring(7)}_${i}_${Date.now()}`, 
 item, quantity: 1, displayString, serialNumber,
 assetTag: '',
 subItems: tempSubItems.length > 0 ? [...tempSubItems] : undefined 
 }));
 return [...prev, ...newEntries];
 });
 setTempSubItems([]);
 }, [tempSubItems]);

 const handleAddToReturnCart = useCallback((item: MaterialItem, quantity: number, displayString: string, serialNumber?: string) => {
 setReturnCart(prev => {
 const category = (item.ประเภท || '').trim();
 const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));

 if (!isTrackedUnit || serialNumber) {
 const existingIdx = prev.findIndex(c => 
 c.item?.รายการ === item.รายการ && 
 c.item?.ประเภท === item.ประเภท &&
 c.item?.ขนาด === item.ขนาด &&
 c.displayString === displayString &&
 !c.serialNumber &&
 !serialNumber
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
 id:`return_${Math.random().toString(36).substring(7)}_${Date.now()}`, 
 item, 
 quantity, 
 displayString, 
 serialNumber,
 assetTag: '',
 status: 'ปกติ',
 subItems: tempReturnSubItems.length > 0 ? [...tempReturnSubItems] : undefined
 }];
 }

 const newEntries = Array.from({ length: quantity }).map((_, i) => ({ 
 id:`return_${Math.random().toString(36).substring(7)}_${i}_${Date.now()}`, 
 item, quantity: 1, displayString, serialNumber,
 assetTag: '',
 status: 'ปกติ',
 subItems: tempReturnSubItems.length > 0 ? [...tempReturnSubItems] : undefined
 }));
 return [...prev, ...newEntries];
 });
 setTempReturnSubItems([]);
 }, [tempReturnSubItems]);

 const handleScan = (decodedText: string) => {
 if (activeScanTarget !== null) {
 setReturnCart(prev => prev.map(item => item.id === activeScanTarget.id ? { ...item, serialNumber: decodedText, assetTag: item.assetTag || decodedText } : item));
 }
 setIsScannerOpen(false); setActiveScanTarget(null);
 };

 const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));
 const removeFromReturnCart = (id: string) => setReturnCart(prev => prev.filter(c => c.id !== id));

 // Accessory Handlers (Restored for Selector Compatibility)
 const handleAddSubItem = useCallback((item: MaterialItem, quantity: number, type: 'accessory' | 'sticker', isReturn: boolean = false) => {
 const setter = isReturn ? setTempReturnSubItems : setTempSubItems;
 const category = item.ประเภท || (type === 'sticker' ? 'สติ๊กเกอร์' : 'อุปกรณ์');
 const displayString =`${category}: ${item.รายการ}`;
 setter(prev => {
 const existingIdx = prev.findIndex(si => si.item.rowIndex === item.rowIndex && si.type === type);
 if (existingIdx !== -1) {
 const updated = [...prev];
 updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + quantity };
 return updated;
 }
 return [...prev, { item, quantity, displayString, type }];
 });
 }, []);

 const updateTempSubItemQty = (idx: number, delta: number, isReturn: boolean = false) => {
 const setter = isReturn ? setTempReturnSubItems : setTempSubItems;
 setter(prev => {
 const updated = [...prev];
 if (updated[idx]) { updated[idx] = { ...updated[idx], quantity: Math.max(1, updated[idx].quantity + delta) }; }
 return updated;
 });
 };

 const resetAll = () => {
 setCart([]); setReturnCart([]); setTempSubItems([]); setTempReturnSubItems([]);
 updateStep('form'); setCv(''); setNote(''); setReturnReason('');
 setAppointmentDate(defaultDate); setAppointmentTime(defaultTime);
 setJobId(''); setSearchResults([]);
 const keysToClear = [`${PREFIX}-cv`,`${PREFIX}-cart`,`${PREFIX}-return-cart`,`${PREFIX}-note`,`${PREFIX}-returnReason`,`${PREFIX}-appointmentDate`,`${PREFIX}-appointmentTime`,`${PREFIX}-step`,`${PREFIX}-jobid`,`${PREFIX}-temp-sub`,`${PREFIX}-temp-return-sub`];
 keysToClear.forEach(k => localStorage.removeItem(k));
 setPhotos([]);
 setResetKey(Date.now()); 
 };

 const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (!files || files.length === 0) return;
 setProcessingPhoto(true); Error(null);

 try {
 const coords = await getCoordinates();
 const newImages: string[] = [];
 const incomingFiles = Array.from(files);

 for (const file of incomingFiles) {
 if (photos.length + newImages.length >= 6) break;
 const reader = new FileReader();
 const base64 = await new Promise<string>((resolve) => {
 reader.onload = (ev) => resolve(ev.target?.result as string);
 reader.readAsDataURL(file);
 });
 const compressed = await resizeAndCompressImage(base64, coords);
 newImages.push(compressed);
 }
 setPhotos(prev => [...prev, ...newImages].slice(0, 6));
 } catch (err: any) {
 setError("ไม่สามารถอัปโหลดรูปภาพได้:" + err.message);
 } finally {
 setProcessingPhoto(false);
 e.target.value = '';
 }
 };

 const handleSubmit = async () => {
 if (!cv) { setError('กรุณาระบุเป้าหมาย / ลูกค้า'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
 if (cart.length === 0 && returnCart.length === 0) { setError('กรุณาระบุรายการพัสดุ'); return; }

 const customer = matchedCustomer;
 if (!customer) {
 setError('ไม่พบข้อมูลลูกค้าในระบบ กรุณาเลือก CV ที่มีอยู่จริงก่อนกดสั่งงาน');
 window.scrollTo({ top: 0, behavior: 'smooth' });
 return;
 }
 const missingCustomerInfo = !String(customer.name || '').trim() || !String(customer.address || '').trim();
 if (missingCustomerInfo) {
 setError('ข้อมูลลูกค้าไม่ครบ (ต้องมีชื่อและที่อยู่) กรุณาแก้ข้อมูลลูกค้าก่อนกดสั่งงาน');
 window.scrollTo({ top: 0, behavior: 'smooth' });
 return;
 }

 if (returnCart.length > 0) {
 const missingReason = returnCart.some(c => !c.returnReason || c.returnReason.trim() === '');
 if (missingReason) { setError('กรุณาระบุสาเหตุที่เก็บกลับ'); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); return; }
 }

 // 🔒 เช็คสต็อกตั้งแต่ตอนกดสั่งงาน (เฉพาะรายการส่ง)
 const selectedWarehouseId = Number(warehouseId || 1);
 const requiredByItem = new Map<string, { label: string; required: number; available: number }>();
 const addRequired = (rawItem: any, qtyRaw: number) => {
 const qty = Number(qtyRaw || 0);
 if (qty <= 0 || !rawItem) return;
 const itemId = Number(rawItem.id || rawItem.rowIndex || rawItem.item_id || 0);
 const key = itemId > 0 ? `id:${itemId}` : `k:${String(rawItem.ประเภท || '')}|${String(rawItem.ยี่ห้อหรือรูปแบบ || '')}|${String(rawItem.รายการ || '')}|${String(rawItem.ขนาด || '')}|${String(rawItem.สภาพ || '')}`;
 const label = `${rawItem.ประเภท || ''} ${rawItem.ยี่ห้อหรือรูปแบบ || ''} ${rawItem.รายการ || ''} ${rawItem.ขนาด || ''}`.replace(/\s+/g, ' ').trim() || 'พัสดุ';
 let available = 0;
 if (warehouseId && (rawItem as any)?.warehouse_stocks) {
   const ws = (rawItem as any).warehouse_stocks.find((w: any) => w.warehouseId === warehouseId);
   available = ws ? Number(ws.stock || 0) : 0;
 } else {
   available = Number((rawItem as any)?.available_stock ?? 0);
 }
 const prev = requiredByItem.get(key);
 if (prev) prev.required += qty;
 else requiredByItem.set(key, { label, required: qty, available });
 };

 cart.forEach((c: any) => {
 addRequired(c.item || c, Number(c.quantity || 1));
 (c.subItems || []).forEach((s: any) => addRequired(s.item || s, Number(s.quantity || 1)));
 });

 const shortages = Array.from(requiredByItem.values()).filter(v => v.required > v.available);
 if (shortages.length > 0) {
 const first = shortages[0];
 setError(`สต็อกไม่พอสำหรับการสั่งงาน: ${first.label} (เหลือ ${first.available} แต่ต้องการ ${first.required})`);
 window.scrollTo({ top: 0, behavior: 'smooth' });
 return;
 }

 setLoading(true); setError(null);
 try {
 const res = await saveJobRequest({ cv, deliveryItems: cart.map(c => ({ ...c, type: 'DELIVERY' })), returnItems: returnCart.map(c => ({ ...c, type: 'RETURN' })), operator: operatorName, note, returnReason, appointmentDate: appointmentDate ?`${appointmentDate}T${appointmentTime}` : undefined, warehouseId, photos });
 if (res.status === 'error') throw new Error(res.message);
 setJobId(res.jobId || '-'); updateStep('success'); if (onSuccess) onSuccess();
 } catch (err: any) { setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'); window.scrollTo({ top: 0, behavior: 'smooth' }); } finally { setLoading(false); }
 };

 const captureScreenshot = async () => {
 const el = document.getElementById('success-receipt'); if (!el) return;
 try {
 document.body.style.cursor = 'wait'; const html2canvas = (await import('html2canvas')).default;
 el.scrollIntoView({ behavior: 'auto', block: 'start' });
 const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
 const image = canvas.toDataURL("image/png"); const link = document.createElement('a');
 link.href = image; link.download =`ETE-JOB-${jobId || Date.now()}.png`;
 document.body.appendChild(link); link.click();
 setTimeout(() => { document.body.removeChild(link); document.body.style.cursor = 'default'; }, 100);
 } catch (e) { console.error(e); alert("ไม่สามารถบันทึกภาพได้"); }
 };

 if (step === 'success') {
 try {
 const customer = (customers || []).find(c => String(c.cv || c.CV || '') === String(cv));
 return (
 <div className="max-w-2xl mx-auto py-6 px-4 mb-20 text-left">
 <div id="success-receipt" className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
 {/* 🏳️ Minimal Header */}
 <div className="px-8 py-6 border-b border-slate-100 mobile-row flex items-center justify-between">
 <div className="space-y-1">
 <h2 className="text-xl font-bold text-slate-900 tracking-tight">บันทึกแจ้งงานสำเร็จ</h2>
 <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Job Request Created</p>
 </div>
 <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
 <span className="material-symbols-outlined text-[24px]">assignment_turned_in</span>
 </div>
 </div>

 <div className="p-8 space-y-10">
 {/* 📂 ID & Appointment Section */}
 <div className="grid grid-cols-2 gap-8 pb-8 border-b border-slate-100">
 <div className="space-y-1.5">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">เลขที่ใบงาน (JOB ID)</p>
 <p className="text-[18px] font-bold text-slate-900 tracking-tight font-mono">{jobId || '-'}</p>
 </div>
 <div className="space-y-1.5 text-right">
 <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">กำหนดนัดหมายทีมงาน</p>
 <p className="text-[16px] font-bold text-amber-600 tracking-tight leading-none">
 {appointmentDate ? new Date(appointmentDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
 </p>
 <p className="text-[12px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">เวลาประมาณ: {appointmentTime || '00:00'} น.</p>
 </div>
 </div>

 {/* 👤 Participant Section */}
 <div className="grid grid-cols-3 gap-4 pb-8 border-b border-slate-100">
 <div className="space-y-1.5">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ผู้เปิดใบแจ้งงาน</p>
 <p className="text-[14px] font-bold text-slate-800">{operatorName}</p>
 </div>
 <div className="space-y-1.5 border-l border-slate-100 pl-6">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">คลังสินค้า</p>
 <p className="text-[14px] font-bold text-slate-800 truncate">{warehouses.find(w => w.id === warehouseId)?.name || 'คลังหลัก'}</p>
 </div>
 <div className="space-y-1.5 border-l border-slate-100 pl-6">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ลูกค้า / CV</p>
 <p className="text-[14px] font-bold text-slate-800 truncate">{customer?.name || cv}</p>
 <p className="text-[11px] font-bold text-indigo-600 uppercase">CV: {cv}</p>
 </div>
 </div>

 <div className="space-y-10">
 {/* 📦 List 1: Delivery Items */}
 {cart.length > 0 && (
 <div className="space-y-4">
 <div className="flex items-center gap-2">
 <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">รายการสั่งนำส่ง ({cart.length})</p>
 </div>
 <div className="space-y-2">
 {cart.map((c, i) => (
 <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
 <div className="flex justify-between items-start gap-4">
 <div className="space-y-1.5 flex-1 text-left">
 <p className="text-[15px] font-bold text-slate-800 uppercase leading-tight">
 [{(c.item?.["ประเภท"] || c.item?.type || 'พัสดุ')}] {(c.item?.["ยี่ห้อหรือรูปแบบ"] || c.item?.brand || '')} {(c.item?.["รายการ"] || c.item?.name || '')} {c.item?.["ขนาด"] && c.item["ขนาด"]}
 </p>
 <div className="flex flex-wrap gap-3 items-center">
 {c.serialNumber && (
 <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">S/N: {c.serialNumber}</span>
 )}
 {c.assetTag && (
 <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">Asset: {c.assetTag}</span>
 )}
 <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-tighter">
 สถานะ: รอกะทีมกวาดขวานฟ้า
 </span>
 </div>
 </div>
 <div className="text-right shrink-0">
 <span className="text-[18px] font-bold text-slate-900 leading-none">x{c.quantity}</span>
 </div>
 </div>
 
 {c.subItems && c.subItems.length > 0 && (
 <div className="pt-2 border-t border-slate-50 grid grid-cols-1 gap-1">
 {c.subItems.map((sub: any, si: number) => (
 <div key={si} className="flex justify-between items-center text-[10px] font-bold text-slate-400">
 <span className="uppercase tracking-tight">• {sub.displayString}</span>
 <span className="shrink-0 opacity-50">x{sub.quantity}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* 📥 List 2: Return Items */}
 {returnCart.length > 0 && (
 <div className="space-y-4">
 <div className="flex items-center gap-2">
 <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">รายการสั่งเก็บกลับ ({returnCart.length})</p>
 </div>
 <div className="space-y-2">
 {returnCart.map((c, i) => (
 <div key={i} className="bg-white p-4 rounded-xl border border-slate-100">
 <div className="flex justify-between items-start gap-4">
 <div className="space-y-1.5 flex-1 text-left">
 <p className="text-[15px] font-bold text-slate-800 uppercase leading-tight">
 [{(c.item?.["ประเภท"] || c.item?.type || 'พัสดุ')}] {(c.item?.["ยี่ห้อหรือรูปแบบ"] || c.item?.brand || '')} {(c.item?.["รายการ"] || c.item?.name || '')} {c.item?.["ขนาด"] && c.item["ขนาด"]}
 </p>
 <div className="flex flex-wrap gap-3 items-center mt-1">
 <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">S/N: {c.serialNumber || '-'}</span>
 <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">Asset: {c.assetTag || '-'}</span>
 <span className="text-[11px] font-bold text-rose-500 uppercase tracking-tighter">สาเหตุ: {c.returnReason || '-'}</span>
 </div>
 </div>
 <div className="text-right shrink-0">
 <span className="text-[18px] font-bold text-slate-900 leading-none">x{c.quantity}</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 {note && (
 <div className="pt-8 border-t border-slate-100">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">หมายเหตุเพิ่มเติม</p>
 <p className="text-[13px] font-bold text-slate-700 italic">"{note}"</p>
 </div>
 )}
 </div>
 </div>

 <div className="mt-8 flex flex-col gap-3 max-w-md mx-auto">
 <button onClick={captureScreenshot} className="btn no-animation h-16 bg-slate-900 text-white rounded-full font-bold text-[14px] uppercase tracking-widest flex items-center justify-center gap-3 border border-slate-800">
 <span className="material-symbols-outlined text-[20px]">crop_free</span>
 <span>CAP หน้าจอเก็บหลักฐาน</span>
 </button>
 <button onClick={() => { resetAll(); onClose(); }} className="h-16 bg-blue-600 text-white rounded-full font-bold text-[15px] uppercase tracking-[0.2em]">ตกลง</button>
 </div>
 </div>
 );
 } catch (err: any) {
 console.error("Success screen crash:", err);
 return (
 <div className="max-w-3xl mx-auto py-6 px-4 text-center">
 <div className="bg-white p-6 rounded-xl border border-rose-100">
 <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
 <span className="material-symbols-outlined text-[32px]">error</span>
 </div>
 <h3 className="text-xl font-black text-slate-900 mb-2">แสดงผลลัพธ์ไม่สำเร็จ</h3>
 <p className="text-slate-500 mb-6 text-[14px]">ข้อมูลถูกบันทึกแล้ว แต่หน้าจอมีปัญหาในการแสดงใบแจ้งงาน: {err.message}</p>
 <button onClick={() => { resetAll(); onClose(); }} className="w-full h-14 bg-slate-900 text-white rounded-full font-black uppercase tracking-widest">กลับหน้าหลัก</button>
 </div>
 </div>
 );
 }
 }

 return (
 <div className="flex flex-col h-full bg-slate-50 relative">
 {(loading || processingPhoto) && (
 <div className="fixed inset-0 bg-slate-900/20 z-[9999] flex flex-col items-center justify-center pointer-events-auto">
 <div className="bg-white/95 p-6 rounded-[3rem] flex flex-col items-center gap-4 border border-white/50">
 <div className="w-20 h-20 border-[6px] border-indigo-100 rounded-full relative">
 <div className="w-20 h-20 border-[6px] border-indigo-600 border-t-transparent rounded-full absolute top-0 left-0"></div>
 </div>
 <p className="text-indigo-950 font-black text-2xl uppercase tracking-tight">{loading ? 'กำลังบันทึก...' : 'กำลังประมวลผลรูปภาพ...'}</p>
 </div>
 </div>
 )}
 <div className="bg-white px-6 py-8 border-b border-slate-100 mobile-row flex items-center justify-between sticky top-0 z-50">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0">
 <span className="material-symbols-outlined text-[28px]">assignment_add</span>
 </div>
 <div>
 <h2 className="text-2xl font-black text-slate-950 tracking-tight leading-none uppercase mb-1">แจ้งงาน / คืนของ <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full align-middle ml-2">VER 1.2.5 (TICKET-ENHANCED)</span></h2>
 <p className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em] leading-none">Job Request & Logistics Queue</p>
 </div>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto px-2 py-5 space-y-4 pb-20">
 {error && <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-[13px] font-bold text-center">{error}</div>}
 <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
 <h3 className="text-[14px] font-black text-slate-900 uppercase">ค้นหาลูกค้า</h3>
 <div className="flex items-center gap-2">
 <div className="relative flex-1 group">
 <input type="text" className="w-full h-14 bg-white border border-slate-200 rounded-full px-8 text-[15px] font-bold outline-none" placeholder="ระบุชื่อ หรือ เลข CV..." value={cv} onChange={e => setCv(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
 <Search size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" />
 </div>
 <button onClick={handleSearch} disabled={isSearching} className="btn no-animation h-14 px-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black">ค้นหา</button>
 </div>
 {searchResults.length > 0 && (
 <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
 {searchResults.map((c, i) => (
 <button key={i} onClick={() => { setCv(String(c.cv || '')); setSearchResults([]); }} className="w-full text-left p-4 flex justify-between items-center group">
 <div><div className="font-black text-slate-800 text-[14px]">{c.name}</div><div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">CV: {c.cv} • {c.province}</div></div>
 </button>
 ))}
 <button onClick={() => setSearchResults([])} className="w-full py-2 bg-slate-50 text-[10px] font-black text-slate-400 uppercase">ปิดเสิร์ช</button>
 </div>
 )}
 {matchedCustomer && (
 <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 space-y-4">
 <div className="flex justify-between items-start">
 <div className="flex-1 min-w-0 pr-3">
 <p className="text-[15px] font-black text-slate-900 leading-tight mb-1 uppercase tracking-tight">{matchedCustomer.name}</p>
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-slate-400">
 <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">id_card</span> CV: <span className="text-indigo-600 font-black">{matchedCustomer.cv}</span></span>
 {matchedCustomer.phone && (
 <a href={`tel:${matchedCustomer.phone}`} className="flex items-center gap-1 text-indigo-500">
 <span className="material-symbols-outlined text-[14px]">call</span> {matchedCustomer.phone}
 </a>
 )}
 </div>
 </div>
 <button 
 onClick={() => {
 const query = matchedCustomer.lat && matchedCustomer.lng 
 ?`${matchedCustomer.lat},${matchedCustomer.lng}` 
 : matchedCustomer.address || matchedCustomer.cv;
 window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
 }}
 className="w-10 h-10 bg-white border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-500"
 >
 <span className="material-symbols-outlined text-[20px]">map_search</span>
 </button>
 </div>
 
 {matchedCustomer.address && (
 <div className="p-3 bg-white/60 rounded-2xl border border-indigo-50/50 text-[11px] text-slate-500 leading-snug flex gap-2">
 <span className="material-symbols-outlined text-[16px] text-indigo-300 shrink-0">location_on</span>
 <p className="font-bold italic">
 {[matchedCustomer.address, matchedCustomer.subdistrict, matchedCustomer.district, matchedCustomer.province, matchedCustomer.zipcode].filter(Boolean).join(' ')}
 </p>
 </div>
 )}
 </div>
 )}
 </div>

 <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
 <h3 className="text-[14px] font-black text-slate-900 uppercase">คลังพัสดุต้นทาง</h3>
 <select className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-[15px] font-extrabold" value={warehouseId} onChange={e => setWarehouseId(parseInt(e.target.value))}>
 {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
 </select>
 </div>

 <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
 <div className="flex items-center gap-3 mb-1"><Icon name="local_shipping" size="sm" /><h3 className="text-[13px] font-black text-slate-900 uppercase">รายการที่นำส่ง ({cart.length})</h3></div>
 <Suspense fallback={<div className="h-20 bg-slate-50 rounded-2xl" />}>
 <JobRequestItemSelector 
 items={items} 
 cart={cart}
 tempSubItems={tempSubItems}
 action="issue" 
 onAddToCart={handleAddToCart} 
 onAddSubItem={(it, qt, ty) => handleAddSubItem(it, qt, ty, false)} 
 onRemoveSubItem={(idx) => setTempSubItems(prev => prev.filter((_, i) => i !== idx))}
 onUpdateSubItemQty={(idx, delta) => updateTempSubItemQty(idx, delta, false)}
 setError={setError} 
 error={error}
 warehouseId={warehouseId}
 />
 </Suspense>
 <div className="space-y-3 mt-4">
 {cart.map((c, idx) => (
 <div key={c.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
 <div className="flex justify-between items-center">
 <div className="flex items-center gap-3">
 {c.quantity > 1 && (
 <div className="bg-slate-900 text-white px-2 py-0.5 rounded-lg font-black text-[11px] shrink-0">
 x{c.quantity}
 </div>
 )}
 <div>
 <p className="text-[13px] font-black text-slate-900 uppercase">{(c.item?.ประเภท || 'พัสดุ')} {(c.item?.รายการ || '')}</p>
 <p className="text-[10px] font-bold text-slate-400 uppercase">ยี่ห้อ: {c.item?.ยี่ห้อหรือรูปแบบ} | ขนาด: {c.item?.ขนาด || '-'}</p>
 </div>
 </div>
 <button onClick={() => removeFromCart(c.id)} className="text-slate-300 shink-0"><Icon name="delete" size="sm" /></button>
 </div>
 
 {c.subItems && c.subItems.length > 0 && (
 <div className="bg-white/50 rounded-xl p-2 space-y-1.5 border border-white">
 {c.subItems.map((sub: any, si: number) => (
 <div key={si} className="flex justify-between items-center px-1">
 <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Icon name="add" size="xs" />{sub.displayString}</p>
 <span className="text-9px font-black text-indigo-400">x{sub.quantity}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>

  <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-3">
        <Icon name="inventory" size="sm" />
        <h3 className="text-[13px] font-black text-slate-900 uppercase">รายการที่เก็บกลับ ({returnCart.length})</h3>
      </div>
      
      {matchedCustomer && customerPossession.length > 0 && (
        <button 
          onClick={() => setUsePossessionForReturn(prev => !prev)}
          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${usePossessionForReturn ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {usePossessionForReturn ? 'check_circle' : 'search'}
          </span>
          {usePossessionForReturn ? 'เลือกจากพัสดุที่ครอบครอง' : 'ค้นหาจากพัสดุทั้งหมด'}
        </button>
      )}
    </div>

    {usePossessionForReturn && customerPossession.length === 0 && matchedCustomer && (
      <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-500 text-[20px]">info</span>
        <div>
          <p className="text-[12px] font-bold text-amber-800">ไม่พบข้อมูลการครอบครองพัสดุของลูกค้ารายนี้</p>
          <p className="text-[11px] font-bold text-amber-600/70 mt-0.5">ระบบจะแสดงรายการพัสดุทั้งหมดให้เลือกแทน</p>
        </div>
      </div>
    )}

  <Suspense fallback={<div className="h-20 bg-slate-50 rounded-2xl" />}>
  <JobRequestItemSelector 
  items={usePossessionForReturn && customerPossession.length > 0 ? possessionItems : items} 
  cart={returnCart}
 tempSubItems={tempReturnSubItems}
 action="return" 
 onAddToCart={handleAddToReturnCart} 
 onAddSubItem={(it, qt, ty) => handleAddSubItem(it, qt, ty, true)} 
 onRemoveSubItem={(idx) => setTempReturnSubItems(prev => prev.filter((_, i) => i !== idx))}
 onUpdateSubItemQty={(idx, delta) => updateTempSubItemQty(idx, delta, true)}
 setError={setError}
 error={error}
 warehouseId={warehouseId}
 limitStock={usePossessionForReturn}
 />
 </Suspense>
 <div className="space-y-4 mt-4">
 {returnCart.map((c, idx) => {
 const category = (c.item?.ประเภท || '').trim();
 const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));

 return (
 <div key={c.id} className="bg-rose-50/30 p-5 rounded-xl border border-rose-100/50 space-y-4 relative">
 <button onClick={() => removeFromReturnCart(c.id)} className="absolute top-4 right-4 text-rose-300"><Icon name="delete" size="sm" /></button>
 <div className="flex justify-between items-start">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-1 flex-wrap">
 <span className="text-[9px] font-black text-rose-500 bg-white px-2 py-0.5 rounded-full border border-rose-200">UNIT {idx + 1}</span>
 <div className="flex items-center gap-2">
 {/* 📦 Prominent Quantity Display (Moved Forward) */}
 {c.quantity > 1 && (
 <div className="bg-slate-900 text-white px-2.5 py-0.5 rounded-lg font-black text-[12px] shrink-0">
 x{c.quantity}
 </div>
 )}
 <p className="text-[15px] font-black text-slate-900 uppercase">{(c.item?.ประเภท)} {(c.item?.รายการ)}</p>
 </div>
 </div>
 <p className="text-[11px] font-bold text-slate-400 uppercase">ยี่ห้อ: {c.item?.ยี่ห้อหรือรูปแบบ || '-'} | ขนาด: {c.item?.ขนาด || '-'}</p>
 </div>
 </div>

 <div className="space-y-3">
 {/* 🔍 Only show SN for Tracked Units */}
 {isTrackedUnit && (
 <div className="space-y-2">
 <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
 <div className="space-y-1">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Serial Number (S/N)</label>
 <input type="text" placeholder="ระบุ S/N (ถ้ามี)..." className="w-full h-11 bg-white border border-slate-200 rounded-2xl px-5 text-[12px] font-bold outline-none focus:border-rose-400" value={c.serialNumber || ''} onChange={e => setReturnCart(prev => prev.map(it => it.id === c.id ? { ...it, serialNumber: e.target.value } : it))} />
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Asset Tag</label>
 <input type="text" placeholder="ระบุ Asset Tag (ถ้ามี)..." className="w-full h-11 bg-white border border-slate-200 rounded-2xl px-5 text-[12px] font-bold outline-none focus:border-rose-400" value={c.assetTag || ''} onChange={e => setReturnCart(prev => prev.map(it => it.id === c.id ? { ...it, assetTag: e.target.value } : it))} />
 </div>
 <button onClick={() => { setActiveScanTarget({ id: c.id, index: 0 }); setIsScannerOpen(true); }} className="h-11 w-full md:w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><span className="material-symbols-outlined text-[16px]">barcode_scanner</span></button>
 </div>
 <p className="text-[10px] font-medium text-slate-400 px-1">ถ้ามีรหัสเดียว กรอกช่องใดช่องหนึ่งได้ ระบบยังใช้ fallback เดิม</p>
 </div>
 )}

 <select className="w-full h-11 bg-white border border-slate-200 rounded-2xl px-4 text-[12px] font-bold text-rose-700 outline-none" value={c.returnReason || ''} onChange={e => setReturnCart(prev => prev.map(it => it.id === c.id ? { ...it, returnReason: e.target.value } : it))}>
 <option value="">-- ระบุสาเหตุที่เก็บกลับ --</option>
 <option value="ปิดการขาย (Sales Closed)">ปิดการขาย (Sales Closed)</option>
 <option value="ไม่มีออเดอร์ (No Orders)">ไม่มีออเดอร์ (No Orders)</option>
 <option value="ของเสีย/ชำรุด (Broken/Damaged)">ของเสีย/ชำรุด (Broken/Damaged)</option>
 <option value="อื่นๆ">อื่นๆ</option>
 </select>

 <div className="grid grid-cols-2 gap-2 mt-2">
 {['ปกติ', 'รอซ่อม', 'สูญหาย', 'ชำรุดหนัก/ซาก'].map(opt => (
 <button 
 key={opt}
 onClick={() => setReturnCart(prev => prev.map(it => it.id === c.id ? { ...it, status: opt } : it))}
 className={`py-2 rounded-xl text-[10px] font-black border ${c.status === opt ? 'bg-slate-900 text-white border-transparent ' : 'bg-white text-slate-400 border-slate-100'}`}
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

 <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-4">
 <div className="space-y-1.5 pb-2 border-b border-slate-50">
 <label className="text-[10px] font-black text-slate-400 uppercase px-2">ระบุสาเหตุที่เก็บกลับ (แบบภาพรวม)</label>
 <select 
 className="w-full h-14 bg-indigo-50/50 border border-indigo-100 rounded-2xl px-4 text-[14px] font-black text-indigo-700 outline-none focus:border-indigo-300" 
 value={returnReason} 
 onChange={e => {
 const val = e.target.value;
 setReturnReason(val);
 if (val) {
 setReturnCart(prev => prev.map(item => ({ ...item, returnReason: val })));
 }
 }}
 >
 <option value="">-- ระบุสาเหตุที่เก็บกลับ (เปลี่ยนทุกชิ้น) --</option>
 <option value="ปิดการขาย (Sales Closed)">ปิดการขาย (Sales Closed)</option>
 <option value="ไม่มีออเดอร์ (No Orders)">ไม่มีออเดอร์ (No Orders)</option>
 <option value="ของเสีย/ชำรุด (Broken/Damaged)">ของเสีย/ชำรุด (Broken/Damaged)</option>
 <option value="อื่นๆ">อื่นๆ</option>
 </select>
 </div>

 <div className="space-y-1.5">
 <label className="text-[10px] font-black text-slate-400 uppercase px-2">นัดหมายวันเข้าทำงาน</label>
 <div className="flex gap-2">
 <input type="date" className="flex-1 h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-[13px] font-bold" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} />
 <input type="text" maxLength={5} placeholder="14:30 (24 ชม.)" className="w-32 h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-[13px] font-bold text-center outline-none focus:bg-white focus:border-indigo-300" value={appointmentTime} onChange={e => {
 let val = e.target.value.replace(/[^0-9:]/g, '');
 if (val.length === 2 && !val.includes(':')) val += ':';
 setAppointmentTime(val);
 }} />
 </div>
 </div>
 <div className="space-y-1.5 pt-2">
 <label className="text-[10px] font-black text-slate-400 uppercase px-2">หมายเหตุ</label>
 <textarea className="w-full bg-slate-50 border border-slate-100 rounded-xl p-5 text-[14px] font-bold text-slate-700 min-h-[120px] resize-none" placeholder="..." value={note} onChange={e => setNote(e.target.value)} />
 </div>

 <div className="space-y-4 pt-2">
 <div className="mobile-row flex items-center justify-between px-2">
 <label className="text-[10px] font-black text-slate-400 uppercase">แนบรูปภาพเพิ่มเติม ({photos.length}/6)</label>
 {photos.length < 6 && (
 <label className="cursor-pointer text-indigo-600 text-[11px] font-black uppercase flex items-center gap-1">
 <Icon name="add_a_photo" size="xs" />
 เพิ่มรูปภาพ
 <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
 </label>
 )}
 </div>
 <div className="grid grid-cols-3 gap-3">
 {photos.map((p, i) => (
 <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 group bg-slate-50">
 <img src={p} className="w-full h-full object-cover" alt="" />
 <button onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1.5 right-1.5 w-7 h-7 bg-white/90 text-rose-500 rounded-full flex items-center justify-center border border-white">
 <Icon name="close" size="xs" />
 </button>
 </div>
 ))}
 {photos.length < 6 && (
 <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-2 text-slate-300 cursor-pointer bg-slate-50/50">
 <Icon name="add_a_photo" size="sm" />
 <span className="text-[9px] font-black uppercase">เพิ่มรูป</span>
 <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
 </label>
 )}
 </div>
 </div>

 <button onClick={handleSubmit} disabled={loading || processingPhoto} className="btn no-animation w-full h-16 bg-indigo-600 text-white rounded-full font-black text-lg disabled:opacity-50">บันทึกแจ้งงาน</button>
 </div>
 </div>
 <Suspense fallback={null}>{isScannerOpen && <BarcodeScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} isOpen={isScannerOpen} />}</Suspense>
 </div>
 );
}
