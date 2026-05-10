import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { Camera, Trash2, Loader2, Package, Tag, User, MapPin, Calendar, Clock, ChevronRight, CheckCircle2, ShoppingCart, Search, Info } from 'lucide-react';
import { getCustomers, getZones, getJobRequests } from '../../api';
import type { MaterialItem, Transaction, Zone } from '../../types';
import {
 createIssueDraftStorageKeys,
 clearAllIssueDraftStorageForOperator,
 clearIssueDraftKeys,
 getIssueDraftFieldKey,
 getIssueDraftSuccessCleanupKeys,
 isIssueDraftExpired,
 readStoredIssueDraftStep,
 writeStoredIssueDraftStep,
} from '../../utils/issueDraftPersistence';

// Lazy load modular components
const ItemSelector = lazy(() => import('./ItemSelector'));
const LogisticsSummary = lazy(() => import('./LogisticsSummary'));
const CustomerQuickEdit = lazy(() => import('../shared/CustomerQuickEdit'));
import BarcodeScanner from './BarcodeScanner';

interface IssueFormProps {
 items: MaterialItem[];
 transactions: Transaction[];
 onSuccess: () => void;
 operatorName: string;
 thaiAddressData: any[];
 warehouses?: any[];
 initialJobId?: string;
 setActiveTab?: (tab: any) => void;
 setLogisticsSubTab?: (tab: 'waiting' | 'active' | 'history') => void;
 setPreSelectedLogisticsJobId?: (jobId: string | null) => void;
}

async function resizeAndCompressImage(base64Image: string, maxWidth = 1024, maxHeight = 1024, quality = 0.7, coords?: string | null): Promise<string> {
 return new Promise((resolve) => {
 const img = new Image();
 img.onload = () => {
 try {
 const canvas = document.createElement('canvas');
 let width = img.width;
 let height = img.height;
 if (width > height) {
 if (width > maxWidth) {
 height = Math.round((height * maxWidth) / width);
 width = maxWidth;
 }
 } else {
 if (height > maxHeight) {
 width = Math.round((width * maxHeight) / height);
 height = maxHeight;
 }
 }
 canvas.width = width;
 canvas.height = height;
 const ctx = canvas.getContext('2d');
 if (!ctx) return resolve(base64Image);
 ctx.drawImage(img, 0, 0, width, height);

 const now = new Date();
 const dateStr = now.toLocaleDateString('th-TH') + ' ' + now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.';
 let watermark =`📅 ${dateStr}`;
 if (coords) watermark +=` | 📍 ${coords}`;
 ctx.font = 'bold 20px sans-serif';
 ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
 const textWidth = ctx.measureText(watermark).width;
 ctx.fillRect(0, height - 35, textWidth + 30, 35);
 ctx.fillStyle = '#ffffff';
 ctx.fillText(watermark, 15, height - 10);
 resolve(canvas.toDataURL('image/jpeg', quality));
 } catch (err) {
 console.error("Compress error:", err);
 resolve(base64Image);
 }
 };
 img.src = base64Image;
 });
}

function getCoordinates(): Promise<string | null> {
 return new Promise((resolve) => {
 if (!navigator.geolocation) return resolve(null);
 navigator.geolocation.getCurrentPosition(
 p => resolve(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`),
 () => resolve(null),
 { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
 );
 });
}

function getWarehouseReadyStock(item: any, whId?: number | string | null): number {
 const stocks = Array.isArray(item?.warehouse_stocks) ? item.warehouse_stocks : [];
 const targetWhId = Number(whId || 0);
 if (targetWhId > 0) {
  const found = stocks.find((ws: any) => Number(ws.warehouseId) === targetWhId || Number(ws.warehouse_id) === targetWhId);
  return Number(found?.stock ?? found?.stock_qty ?? 0);
 }
 if (stocks.length > 0) {
  return stocks.reduce((sum: number, ws: any) => sum + Number(ws.stock ?? ws.stock_qty ?? 0), 0);
 }
 return Number(item?.จำนวน ?? 0);
}

export default function IssueForm({ items, transactions, onSuccess, operatorName, thaiAddressData, warehouses = [], initialJobId, setActiveTab, setLogisticsSubTab, setPreSelectedLogisticsJobId }: IssueFormProps) {
 const action = 'issue';
 const { cartKey: CART_KEY, logisticsKey: LOGISTICS_KEY, timestampKey: TS_KEY } = createIssueDraftStorageKeys(operatorName);

 const isExpired = () => {
 return isIssueDraftExpired(TS_KEY);
 };

 const [step, setStep] = useState<'form' | 'summary' | 'success'>(() => {
 const saved = readStoredIssueDraftStep(LOGISTICS_KEY);
 // Don't restore 'summary' or 'success' without a valid cart
 const savedCart = localStorage.getItem(CART_KEY);
 const hasCart = savedCart && savedCart !== '[]';
 if ((saved === 'summary' || saved === 'success') && !hasCart) return 'form';
 return saved || 'form';
 });

 const updateStep = (newStep: 'form' | 'summary' | 'success') => {
 setStep(newStep);
 writeStoredIssueDraftStep(LOGISTICS_KEY, newStep);
 };
 const [cart, setCart] = useState<any[]>(() => {
 const saved = localStorage.getItem(CART_KEY);
 if (isExpired()) {
 localStorage.removeItem(CART_KEY);
 return [];
 }
 return saved ? JSON.parse(saved) : [];
 });

 const [customers, setCustomers] = useState<any[]>([]);
 const [zones, setZones] = useState<Zone[]>([]);
 const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [savedTxnNo, setSavedTxnNo] = useState<string>(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'saved-txn')) || '');
 const [resetKey, setResetKey] = useState(Date.now()); // New state for resetting child components
 const [tempSubItems, setTempSubItems] = useState<any[]>([]);
 const [isScannerOpen, setIsScannerOpen] = useState(false);
 const [activeScannerItemId, setActiveScannerItemId] = useState<string | null>(null);

 const now = new Date();
 const defaultDate = now.toLocaleDateString('en-CA');
 const defaultTime = '00:00';

 const [cv, setCv] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'cv')) || '');
 const [deliveryBy, setDeliveryBy] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryBy')) || '');
 const [deliveryDate, setDeliveryDate] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryDate')) || defaultDate);
 const [deliveryTime, setDeliveryTime] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryTime')) || defaultTime);
 const [workZone, setWorkZone] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'workzone')) || '');
 const [note, setNote] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'note')) || '');
 const [notifier, setNotifier] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'notifier')) || '');
 const [notificationDate, setNotificationDate] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'notificationDate')) || defaultDate);
 const [returnReason, setReturnReason] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'returnReason')) || '');
 const [cabinetCondition, setCabinetCondition] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'cabinetCondition')) || '');
 const [warehouseId, setWarehouseId] = useState<number>(() => {
 const saved = localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'warehouseId'));
 return saved ? parseInt(saved) : (warehouses[0]?.id || 1);
 });

 const [pendingJobs, setPendingJobs] = useState<any[]>([]);
 const [fetchingJobs, setFetchingJobs] = useState(false);
 const [hasFetchedJobs, setHasFetchedJobs] = useState(false);
 const [selectedJobId, setSelectedJobId] = useState<string | null>(() => initialJobId || localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobId')) || null);
 const [selectedJobOriginator, setSelectedJobOriginator] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobOriginator')) || '');
 const [photos, setPhotos] = useState<string[]>([]);
 const [processingPhoto, setProcessingPhoto] = useState(false);

 useEffect(() => {
 if (initialJobId && initialJobId !== selectedJobId) {
 setSelectedJobId(initialJobId);
 }
 }, [initialJobId]);

 const filteredJobs = useMemo(() => {
 if (!cv) return pendingJobs;
 return pendingJobs.filter(j => String(j.cv || j.CV) === String(cv));
 }, [pendingJobs, cv]);

 useEffect(() => {
 localStorage.setItem(CART_KEY, JSON.stringify(cart));
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'cv'), cv);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryBy'), deliveryBy);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryDate'), deliveryDate);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryTime'), deliveryTime);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'workzone'), workZone);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'note'), note);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'notifier'), notifier);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'notificationDate'), notificationDate);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'returnReason'), returnReason);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'cabinetCondition'), cabinetCondition);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'warehouseId'), warehouseId.toString());
 if (selectedJobId) localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobId'), selectedJobId);
 else localStorage.removeItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobId'));
 
 if (selectedJobOriginator) localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobOriginator'), selectedJobOriginator);
 else localStorage.removeItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobOriginator'));
 
 localStorage.setItem(TS_KEY, Date.now().toString());
 }, [cart, cv, deliveryBy, deliveryDate, deliveryTime, workZone, note, notifier, notificationDate, returnReason, cabinetCondition, warehouseId, selectedJobId, selectedJobOriginator, CART_KEY, LOGISTICS_KEY, TS_KEY]);

 useEffect(() => {
 if (step === 'success') {
 // Clear most persistence, but keep Job ID until the user resets manually
 clearIssueDraftKeys(getIssueDraftSuccessCleanupKeys(
  { cartKey: CART_KEY, logisticsKey: LOGISTICS_KEY, timestampKey: TS_KEY },
  { includeStep: false, includeSavedTxn: false, includeSelectedJob: false, includeSelectedJobOriginator: false },
 ));
 return;
 }
 }, [step, LOGISTICS_KEY, CART_KEY, TS_KEY]);

 useEffect(() => {
 getCustomers().then(setCustomers).catch(console.error);
 getZones().then(setZones).catch(console.error);
 }, []);

 const fetchJobs = useCallback(() => {
 setFetchingJobs(true);
 getJobRequests()
 .then(jobs => {
 const deliveryJobs = jobs.filter(j => {
 const type = String(j.type ||"").toUpperCase();
 const rawStatus = String(j.status ||"");
 const status = rawStatus.toUpperCase();
 // ✅ รวมทั้ง PENDING และ IN TRANSIT โดย check ทั้ง English/Thai
 const isTransit = status.includes('TRANSIT') || rawStatus.includes('เดินทาง');
 const isAccepted = status === 'ACCEPTED' || rawStatus.includes('รับงาน');
 const isAlreadyDone = rawStatus.includes('เบิกออก') || rawStatus.includes('เสร็จ');
 return (type === 'DELIVERY' || type === 'MIXED') &&
 (status === 'PENDING' || isAccepted || isTransit) &&
 !isAlreadyDone &&
 rawStatus !== 'รอรับคืน' &&
 rawStatus !== 'รับคืนแล้ว';
 });
 setPendingJobs(deliveryJobs);
 setHasFetchedJobs(true);
 })
 .catch(err => {
 console.error("Fetch jobs failed:", err);
 setError("โหลดข้อมูลแจ้งงานไม่สำเร็จ");
 })
 .finally(() => setFetchingJobs(false));
 }, []);

 useEffect(() => {
 if (initialJobId && !hasFetchedJobs && !fetchingJobs) {
 fetchJobs();
 }
 }, [initialJobId, hasFetchedJobs, fetchingJobs, fetchJobs]);


 useEffect(() => {
 if (initialJobId && hasFetchedJobs && pendingJobs.length > 0) {
 try {
 const job = pendingJobs.find(j => String(j.jobId) === String(initialJobId));
 if (job) {
 const rawDeliveryItems = (job.items || []).filter((ji: any) => {
 const aType = String(ji.action_type || ji.action ||"").toUpperCase();
 return aType === 'แจ้งส่ง' || aType === 'DELIVERY' || aType === 'ISSUE' || aType.includes('ส่ง');
 });

 // 🔄 Split items: Freezers = 1 card per unit, Non-freezers = aggregated by identity
 const freezers = rawDeliveryItems.filter((ji: any) => ji.ประเภท === 'ตู้แช่');
 const rawAccessories = rawDeliveryItems.filter((ji: any) => ji.ประเภท !== 'ตู้แช่');
 
 // Aggregate non-freezer accessories by item identity
 const accessoryMap = new Map<string, any>();
 rawAccessories.forEach((acc: any) => {
 const key = [
 acc.ประเภท || acc.item?.ประเภท || '',
 acc.ยี่ห้อหรือรูปแบบ || acc.item?.['ยี่ห้อหรือรูปแบบ'] || '',
 acc.รายการ || acc.item?.รายการ || '',
 acc.ขนาด || acc.item?.ขนาด || '',
 acc.สภาพ || acc.item?.สภาพ || ''
 ].join('|');
 
 const existing = accessoryMap.get(key);
 if (existing) {
 existing.quantity = (Number(existing.quantity) || 1) + (Number(acc.quantity || acc.จำนวน || 1));
 existing.จำนวน = existing.quantity;
 } else {
 accessoryMap.set(key, { ...acc, quantity: Number(acc.quantity || acc.จำนวน || 1) });
 }
 });
 const aggregatedAccessories = Array.from(accessoryMap.values());

 // Combine: each freezer as a standalone card + each aggregated accessory as its own card
 const deliveryItemsOnly = [...freezers, ...aggregatedAccessories];

const imported = deliveryItemsOnly.map((jobItem: any) => {
const jobItemBrand = String(jobItem.item?.["ยี่ห้อหรือรูปแบบ"] || jobItem["ยี่ห้อหรือรูปแบบ"] || jobItem.item?.brand || jobItem.brand || "").trim();
const jobItemSize = String(jobItem.item?.["ขนาด"] || jobItem["ขนาด"] || jobItem.item?.size || jobItem.size || "").trim();
const jobItemName = String(jobItem.item?.["รายการ"] || jobItem["รายการ"] || jobItem.item?.item_name || jobItem.item_name || "").trim();
const jobItemType = String(jobItem.item?.["ประเภท"] || jobItem["ประเภท"] || jobItem.item?.category || jobItem.category || "").trim();
const explicitItemId = Number(jobItem.item?.rowIndex || jobItem.item?.id || jobItem.rowIndex || jobItem.item_id || jobItem.id || 0);

// สำคัญ: งานจาก logistics/jobs มักส่ง rowIndex มาแล้ว แต่ไม่มี warehouse_stocks
// ต้องแมตช์ด้วย item id ก่อน เพื่อดึงข้อมูลสต็อกจาก master items ให้ตรงคลัง
const masterById = explicitItemId > 0
? (items || []).find((m: any) => Number(m.rowIndex || m.id || 0) === explicitItemId)
: null;

const masterMatch = masterById || (items || []).find((m: any) =>
String(m["รายการ"] ||"").trim() === jobItemName &&
String(m["ประเภท"] ||"").trim() === jobItemType &&
String(m["ยี่ห้อหรือรูปแบบ"] ||"").trim() === jobItemBrand &&
String(m["ขนาด"] ||"").trim() === jobItemSize
);

const finalDisplay = masterMatch
? [masterMatch["ยี่ห้อหรือรูปแบบ"], masterMatch["สภาพ"], masterMatch["ขนาด"], masterMatch["รายการ"]].filter(v => v && v !== '-').join(' ')
: ([jobItemBrand, jobItemSize, jobItemName].filter(v => v && v !== '-').join(' ') ||"พัสดุเบิกออก");
 
const finalItem = masterMatch || { 
...jobItem.item,
...jobItem,
rowIndex: explicitItemId || jobItem.rowIndex || jobItem.item_id,
"รายการ": jobItemName || jobItem.รายการ || jobItem.name ||"พัสดุ",
"ประเภท": jobItemType || jobItem.ประเภท ||"อุปกรณ์",
"ยี่ห้อหรือรูปแบบ": jobItemBrand || jobItem["ยี่ห้อหรือรูปแบบ"] || "",
"ขนาด": jobItemSize || jobItem["ขนาด"] || ""
};

 return {
 id: Math.random().toString(36).slice(7),
 action: 'issue',
 item: finalItem,
 quantity: Number(jobItem.quantity || jobItem.จำนวน || 1),
 subItems: [], // No subItems - every item is its own card
 displayString: finalDisplay,
 isFromJob: true
 };
 });

 setCart(imported);
 setCv(job.cv || job.CV ||"");
 setNote(job.note ||"");
 setSelectedJobId(job.jobId);
 if (job.operator) setSelectedJobOriginator(job.operator);
 const jobWhId = Number(job.warehouse_id || job.warehouseId || job.items?.find((it: any) => it?.warehouse_id || it?.warehouseId)?.warehouse_id || job.items?.find((it: any) => it?.warehouse_id || it?.warehouseId)?.warehouseId || 0);
if (jobWhId > 0) setWarehouseId(jobWhId);
 setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 400);
 }
 } catch (err: any) {
 console.error("Auto-fill error:", err);
 setError("ระบบพบปัญหาในการดึงข้อมูลแผนงาน:" + err.message);
 }
 }
 }, [initialJobId, hasFetchedJobs, pendingJobs, items]);

 const handleAddToCart = useCallback((item: MaterialItem, quantity: number, displayString: string, serialNumber?: string) => {
 setCart(prev => {
 // If S/N is provided, don't merge, treat as unique item
 if (!serialNumber) {
 const existingIdx = prev.findIndex(c => c.action === action && c.item.rowIndex === item.rowIndex && c.displayString === displayString && !c.serialNumber);
 if (existingIdx !== -1) {
 const updatedCart = [...prev];
 const existing = { ...updatedCart[existingIdx] };
 existing.quantity += quantity;
 // ... rest of subitems logic if needed
 updatedCart[existingIdx] = existing;
 return updatedCart;
 }
 }
 const newCartItem = {
 id: Math.random().toString(36).substring(7),
 item,
 quantity,
 displayString,
 action,
 serialNumber,
 subItems: tempSubItems.length > 0 ? [...tempSubItems] : undefined
 };
 return [...prev, newCartItem];
 });
 setTempSubItems([]);
 }, [tempSubItems]);

 const handleAddSubItem = useCallback((item: MaterialItem, quantity: number, type: 'accessory' | 'sticker') => {
 let display = [item.ยี่ห้อหรือรูปแบบ, item.สภาพ, item.ขนาด, item.รายการ, item.รายละเอียด].filter(v => v && v !== '-').join(' ');
 display = display.replace(/อุปกรณ์ตู้|สติกเกอร์ตู้|สติ๊กเกอร์ตู้|อะไหล่ตู้/g, '').trim();

 setTempSubItems(prev => {
 const existingIdx = prev.findIndex(si => si.item.rowIndex === item.rowIndex && si.type === type);
 if (existingIdx !== -1) {
 const updated = [...prev];
 updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + quantity };
 return updated;
 }
 return [...prev, { item, quantity, displayString: display, type }];
 });
 }, []);

 const handleRemoveSubItem = useCallback((idx: number) => {
 setTempSubItems(prev => prev.filter((_, i) => i !== idx));
 }, []);

 const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

 const resetAll = () => {
 setCart([]);
 setTempSubItems([]);
 updateStep('form');
 setCv('');
 setDeliveryBy('');
 setDeliveryDate(new Date().toLocaleDateString('en-CA'));
 setDeliveryTime('00:00');
 setWorkZone('');
 setNote('');
 setNotifier('');
 setNotificationDate('');
 setReturnReason('');
 setCabinetCondition('');
 setWarehouseId(warehouses[0]?.id || 1);
 setPhotos([]);

 // Robust cleanup of all persistence keys
 clearAllIssueDraftStorageForOperator({ cartKey: CART_KEY, logisticsKey: LOGISTICS_KEY, timestampKey: TS_KEY });

 // If this was a Logistics Job, return to the dashboard
 if (selectedJobId && setActiveTab) {
 if (setLogisticsSubTab) setLogisticsSubTab('active');
 setActiveTab('logistics');
 }

 setSelectedJobId(null);
 setResetKey(Date.now());
 };

 const captureScreenshot = async () => {
 const element = document.getElementById('success-receipt');
 if (!element) return;

 try {
 // Show loading indicator in cursor
 document.body.style.cursor = 'wait';
 
 const html2canvas = (await import('html2canvas')).default;
 element.scrollIntoView({ behavior: 'auto', block: 'start' });

 const canvas = await html2canvas(element, {
 scale: 2,
 backgroundColor: '#ffffff',
 useCORS: true,
 logging: false,
 height: element.scrollHeight,
 windowHeight: element.scrollHeight + 1000,
 onclone: (clonedDoc) => {
 const clonedElement = clonedDoc.getElementById('success-receipt');
 if (clonedElement) {
 clonedElement.style.width = '600px'; 
 clonedElement.style.height = 'auto';
 clonedElement.style.overflow = 'visible';
 clonedElement.style.animation = 'none';
 
 // Force show all elements that might be animated or hidden
 clonedElement.querySelectorAll('*').forEach((el: any) => {
 el.style.animation = 'none';
 el.style.opacity = '1';
 if (el.classList.contains('truncate')) {
 el.classList.remove('truncate');
 el.style.overflow = 'visible';
 el.style.whiteSpace = 'normal';
 el.style.textOverflow = 'clip';
 }
 });
 }
 }
 });

 const image = canvas.toDataURL("image/png");
 const link = document.createElement('a');
 link.style.display = 'none';
 link.href = image;
 link.download =`ETE-ISSUE-${savedTxnNo || new Date().getTime()}.png`;
 
 document.body.appendChild(link);
 link.click();
 setTimeout(() => {
 document.body.removeChild(link);
 document.body.style.cursor = 'default';
 }, 100);
 
 } catch (err) {
 console.error("Screenshot failed:", err);
 document.body.style.cursor = 'default';
 alert("ไม่สามารถบันทึกภาพได้ในขณะนี้ กรุณาลองแคปหน้าจอด้วยมือถือแทนครับ");
 }
 };

 if (step === 'success') {
 const matchedCustomer = customers.find(c => {
 const customerCv = String(c.cv || c.CV || c["เลข CV"] || c["เลขCV"] || '');
 return customerCv === String(cv);
 });

 // 🔄 Mixed-Job Continuity Logic: Check if there are returns left to do
 const matchedJob = pendingJobs.find(j => String(j.jobId) === String(selectedJobId));
 const hasPendingReturns = matchedJob?.items?.some((it: any) => {
 const at = String(it.action_type || it.action ||"").toUpperCase();
 const isReturn = at.includes('คืน') || at.includes('RETURN') || at.includes('RECEIVE');
 const isDone = at.includes('แล้ว') || at.includes('ตรวจสอบ') || at.includes('รอตรวจ');
 return isReturn && !isDone;
 });

 try {
 return (
 <div className="max-w-2xl mx-auto py-6 px-4 mb-20 text-left">
 <div id="success-receipt" className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
 {/* 🏳️ Minimal Header */}
 <div className="px-8 py-6 border-b border-slate-100 mobile-row flex items-center justify-between">
 <div className="space-y-1">
 <h2 className="text-xl font-bold text-slate-900 tracking-tight">บันทึกเบิกสินค้าสำเร็จ</h2>
 <p className="text-[11px] font-bold text-amber-500 uppercase tracking-widest leading-none">Issue Transaction Confirmed</p>
 </div>
 <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
 <span className="material-symbols-outlined text-[24px]">verified</span>
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
 <div className="space-y-1.5 border-l border-slate-100 pl-8">
 <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">เลขที่ใบแจ้งงาน (JOB)</p>
 <p className="text-[18px] font-bold text-indigo-600 tracking-tight font-mono">#{selectedJobId}</p>
 </div>
 )}
 </div>

 {/* 👤 Participant Section */}
 <div className="grid grid-cols-3 gap-4 pb-8 border-b border-slate-100">
 <div className="space-y-1.5">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ผู้ดำเนินการเบิก</p>
 <p className="text-[14px] font-bold text-slate-800">{operatorName}</p>
 </div>
 <div className="space-y-1.5 border-l border-slate-100 pl-6">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">สถานที่ / เขต</p>
 <p className="text-[14px] font-bold text-slate-800 line-clamp-2">{workZone || 'ไม่ระบุเขต'}</p>
 </div>
 <div className="space-y-1.5 border-l border-slate-100 pl-6">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ลูกค้า / CV</p>
 <p className="text-[14px] font-bold text-slate-800 truncate">{matchedCustomer?.name || 'ไม่ระบุ'}</p>
 <p className="text-[11px] font-bold text-amber-600 uppercase">CV: {cv || 'N/A'}</p>
 </div>
 </div>

 <div className="space-y-8">
 {/* 📦 List: Issued Items */}
 <div className="space-y-4">
 <div className="flex items-center gap-2">
 <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">พัสดุอุปกรณ์ที่เบิกออก ({cart.length})</p>
 </div>
 <div className="space-y-3">
 {cart.map((c, idx) => (
 <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100 space-y-3">
 <div className="flex justify-between items-start gap-4">
 <div className="space-y-1.5 flex-1 text-left">
 <p className="text-[15px] font-bold text-slate-800 uppercase leading-tight">
 [{ (c.item?.["ประเภท"] || c.item?.type) ||"พัสดุ" }] { (c.item?.["ยี่ห้อหรือรูปแบบ"] || c.item?.brand) } { (c.item?.["รายการ"] || c.item?.name) } {c.item?.["ขนาด"] && c.item["ขนาด"]}
 </p>
 
 <div className="flex flex-wrap gap-3 items-center">
 {c.serialNumber && (
 <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">S/N: {c.serialNumber}</span>
 )}
 {c.assetTag && (
 <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">Asset: {c.assetTag}</span>
 )}
 <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-tighter">
 สภาพ: {c.item?.สภาพ || c.item?.condition || 'ปกติ (Stock)'}
 </span>
 </div>
 </div>
 <div className="text-right shrink-0">
 <span className="text-[18px] font-bold text-slate-900 leading-none">x{c.quantity || 1}</span>
 </div>
 </div>
 
 {c.subItems && c.subItems.length > 0 && (
 <div className="pt-2 border-t border-slate-50 grid grid-cols-1 gap-1">
 {c.subItems.map((si: any, sIdx: number) => {
 const brand = si.item?.["ยี่ห้อหรือรูปแบบ"] || si["ยี่ห้อหรือรูปแบบ"] ||"";
 const size = si.item?.["ขนาด"] || si["ขนาด"] ||"";
 const name = si.item?.["รายการ"] || si.รายการ || si.name ||"";
 const type = si.item?.["ประเภท"] || si.ประเภท || si.type ||"อุปกรณ์";
 
 const fullDetail = [brand, size, name].filter(v => v && v !== '-').join(' ');
 
 return (
 <div key={sIdx} className="flex justify-between items-center text-[10px] font-bold text-slate-400">
 <span className="uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
 • <span className="text-slate-300 font-medium">[{type}]</span> {fullDetail}
 </span>
 <span className="shrink-0 opacity-50 ml-2">x{si.quantity}</span>
 </div>
 );
 })}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 </div>

 {(note || deliveryBy) && (
 <div className="pt-8 border-t border-slate-100 flex flex-col gap-4">
 {deliveryBy && (
 <div className="flex justify-between items-center">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ผู้นำส่ง / ผู้รับผิดชอบ</p>
 <p className="text-[12px] font-bold text-slate-700">{deliveryBy}</p>
 </div>
 )}
 {note && (
 <div className="space-y-1.5">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">หมายเหตุ</p>
 <p className="text-[13px] font-bold text-slate-700 italic leading-relaxed">"{note}"</p>
 </div>
 )}
 </div>
 )}
 </div>
 </div>

 <div className="mt-8 flex flex-col gap-3 max-w-md mx-auto">
 {hasPendingReturns && (
 <button
             onClick={() => {
                if (setActiveTab && setPreSelectedLogisticsJobId) {
                  setPreSelectedLogisticsJobId(selectedJobId);
                  // Clear all issue draft keys immediately, then navigate to return
                  clearAllIssueDraftStorageForOperator({ cartKey: CART_KEY, logisticsKey: LOGISTICS_KEY, timestampKey: TS_KEY });
                  setActiveTab('return');
                }
              }}
 className="h-16 bg-emerald-600 text-white rounded-full font-bold text-[15px] uppercase tracking-widest flex items-center justify-center gap-3 border-2 border-emerald-500"
 >
 <span className="material-symbols-outlined text-[24px]">assignment_return</span>
 <span>ทำรายการรับคืนต่อทันที</span>
 </button>
 )}
 <button onClick={captureScreenshot} className="btn no-animation h-16 bg-slate-900 text-white rounded-full font-bold text-[14px] uppercase tracking-widest flex items-center justify-center gap-3 border border-slate-800">
 <span className="material-symbols-outlined">crop_free</span>
 <span>CAP หน้าจอเก็บหลักฐาน</span>
 </button>
 <button onClick={resetAll} className="btn no-animation h-16 bg-blue-600 text-white rounded-full font-bold text-[15px] uppercase tracking-[0.2em]">ตกลง</button>
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
 <p className="text-slate-500 mb-6 text-[14px]">ข้อมูลถูกบันทึกลงฐานข้อมูลแล้ว (Telegram แจ้งแล้ว) แต่หน้าจอมีปัญหาในการแสดงใบเสร็จ: {err.message}</p>
 <button onClick={resetAll} className="btn no-animation w-full h-14 bg-slate-900 text-white rounded-full font-black uppercase tracking-widest">กลับหน้าหลัก</button>
 </div>
 </div>
 );
 }
 }

 return (
 <div className="mobile-page-frame relative">
 {loading && (
 <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex flex-col items-center justify-center cursor-wait pointer-events-auto p-6">
 <div className="mobile-surface-card flex flex-col items-center gap-4 px-6 py-6">
 <span className="app-spinner-lg" aria-hidden="true"></span>
 <p className="text-base-content font-semibold text-[16px]">กำลังบันทึกข้อมูล...</p>
 </div>
 </div>
 )}
 <div className="mobile-surface-card overflow-hidden">
 <div className="mobile-form-hero border-b border-base-300">
 <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full translate-x-1/3"></div>
 <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/5 rounded-full translate-y-1/3 -translate-x-1/4"></div>

 <div className="relative flex flex-col gap-4">
 <div className="mobile-row flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-amber-600 border border-amber-50 shrink-0">
 <span className="material-symbols-outlined font-light text-[28px]">output</span>
 </div>
 <div>
 <h1 className="mobile-form-hero-title">
 เบิกพัสดุอุปกรณ์ 
 <span className="ml-2 inline-flex rounded-full bg-warning px-2 py-0.5 align-middle text-[9px] font-semibold text-warning-content">VER 1.2.5</span>
 </h1>
 <p className="mobile-form-hero-subtitle">Logistics Inventory & Outbound</p>
 </div>
 </div>
 <button onClick={resetAll} className="btn no-animation w-11 h-11 bg-white text-slate-400 rounded-full flex items-center justify-center border border-slate-100 z-10">
 <span className="material-symbols-outlined text-[20px]">restart_alt</span>
 </button>
 </div>
 <div className="flex flex-wrap gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest px-1">
 <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200/50">ผู้ดูแล: {operatorName}</span>
 </div>
 </div>
 </div>

 <div className="px-2 py-6 sm:p-6 bg-slate-50/50 border-b border-slate-100 space-y-4">
 <button
 onClick={fetchJobs}
 disabled={fetchingJobs}
 className="btn no-animation w-full mobile-row flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl group disabled:opacity-80"
 >
 <div className="flex items-center gap-3 text-left">
 <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
 <span className={`material-symbols-outlined text-[24px] ${fetchingJobs ? '' : ''}`}>
 {fetchingJobs ? 'sync' : 'assignment_late'}
 </span>
 </div>
 <div className="flex flex-col">
 <p className="text-[13px] font-black text-slate-800 uppercase tracking-tight leading-none mb-0.5">ดึงข้อมูลจากแผนแจ้งงาน</p>
 <p className={`text-[10px] font-black uppercase tracking-[0.1em] ${fetchingJobs ? 'text-amber-500' : (hasFetchedJobs ? 'text-emerald-600' : 'text-amber-400')}`}>
 {fetchingJobs ?"กำลังดึงข้อมูล..." : (hasFetchedJobs ?`${filteredJobs.length} รายการที่รอเบิก` :"แตะเพื่อโหลดข้อมูลภายนอก")}
 </p>
 </div>
 </div>
 <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 shrink-0 mx-1">
 <span className="material-symbols-outlined text-[18px]">chevron_right</span>
 </div>
 </button>

 <div className="flex gap-2">
 <div className="flex-1 relative group">
 <select
 className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-4 pl-12 text-[12.5px] font-bold text-slate-700 outline-none focus:border-amber-500 appearance-none disabled:opacity-50 disabled:bg-slate-50"
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
 {!hasFetchedJobs && !fetchingJobs ? (
 <option value="">-- คลิกที่นี่เพื่อโหลดแผนงาน --</option>
 ) : (
 <>
 <option value="">{filteredJobs.length === 0 && !fetchingJobs ?"-- ไม่มีแผนงานค้างอยู่ --" :"-- เลือกเลขนัดหมาย (JobID) --"}</option>
 {filteredJobs.map(job => (
 <option key={job.jobId} value={job.jobId}>
 {job.jobId} | {customers.find(c => String(c.cv || c.CV) === String(job.cv || job.CV))?.name || job.cv || job.CV}
 </option>
 ))}
 </>
 )}
 </select>
 <span className="material-symbols-outlined absolute left-4 top-1/2 text-slate-400 text-[20px] pointer-events-none group-focus-within:text-amber-500">assignment</span>
 <span className="material-symbols-outlined absolute right-4 top-1/2 text-slate-300 text-[20px] pointer-events-none font-light">expand_more</span>

 {/* Barcode Scanner for Job ID */}
 {!cart.some(c => c.isFromJob) && (
 <button
 onClick={() => {
 setActiveScannerItemId('job-search');
 setIsScannerOpen(true);
 }}
 className="absolute right-[52px] top-1/2 w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100"
 title="สแกนใบบุ๊กกิ้ง"
 >
 <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
 </button>
 )}
 </div>
 {cart.some(c => c.isFromJob) ? (
 <button
 onClick={() => {
 setSelectedJobId(null);
 setSelectedJobOriginator('');
 setCart([]);
 setCv("");
 setNote("");
 setError("ยกเลิกการเชื่อมโยงงานแล้ว");
 }}
 className="bg-rose-50 text-rose-500 h-14 px-4 rounded-2xl flex items-center justify-center border border-rose-100/50"
 title="ยกเลิกงานนี้"
 >
 <span className="material-symbols-outlined text-[24px]">link_off</span>
 </button>
 ) : (
 <button
 onClick={() => {
 try {
 const job = pendingJobs.find(j => String(j.jobId) === String(selectedJobId));
 if (!job) {
 setError("ไม่พบข้อมูลใบงาน");
 return;
 }

 if (!Array.isArray(job.items)) {
 setError("ข้อมูลใบงานไม่สมบูรณ์ (Missing items)");
 return;
 }

 let shortageFound = false;
 // 🔥 Filter items that contribute to DELIVERY/ISSUE
 const rawDeliveryItems = job.items.filter((ji: any) => {
 const aType = String(ji.action_type || ji.action ||"").toUpperCase();
 return aType === 'แจ้งส่ง' || aType === 'DELIVERY' || aType === 'ISSUE' || aType.includes('ส่ง');
 });

 if (rawDeliveryItems.length === 0) {
 setError("ไม่พบรายการ 'ส่ง' ในใบงานนี้");
 return;
 }

 // 📦 Reconstruct subItems structure for UI grouping
 const cabinets = rawDeliveryItems.filter((ji: any) => ji.ประเภท === 'ตู้แช่');
 const tempAccessories = rawDeliveryItems.filter((ji: any) => ji.ประเภท !== 'ตู้แช่');

 const deliveryItemsOnly = cabinets.length > 0
 ? cabinets.map((cab: any, idx: number) => idx === 0 ? { ...cab, subItems: tempAccessories } : cab)
 : tempAccessories;

 const effectiveImportWarehouseId = Number(job.warehouse_id || warehouseId || 0);
 const imported = deliveryItemsOnly.map((jobItem: any) => {
 const requiredCond = String(jobItem.item?.["สภาพ"] || jobItem["สภาพ"] ||"").trim();
 const jobItemBrand = String(jobItem.item?.["ยี่ห้อหรือรูปแบบ"] || jobItem["ยี่ห้อหรือรูปแบบ"] ||"").trim();
 const jobItemSize = String(jobItem.item?.["ขนาด"] || jobItem["ขนาด"] ||"").trim();
 const jobItemName = String(jobItem.item?.["รายการ"] || jobItem["รายการ"] ||"").trim();
 const jobItemType = String(jobItem.item?.["ประเภท"] || jobItem["ประเภท"] ||"").trim();

 const masterMatch = (items || []).find(m =>
 String(m["รายการ"] ||"").trim() === jobItemName &&
 String(m["ประเภท"] ||"").trim() === jobItemType &&
 String(m["ยี่ห้อหรือรูปแบบ"] ||"").trim() === jobItemBrand &&
 String(m["ขนาด"] ||"").trim() === jobItemSize &&
 (!requiredCond || String(m["สภาพ"] ||"").trim() === requiredCond)
 );

 // 🔥 Check stock availability at import time from selected job warehouse only
 const currentStock = masterMatch ? getWarehouseReadyStock(masterMatch, effectiveImportWarehouseId) : 0;
 if (currentStock < (Number(jobItem.quantity || jobItem.จำนวน || 1))) {
 shortageFound = true;
 }

 // ➕ Map and validate Sub-items (Accessories/Stickers)
 const mappedSubItems = (jobItem.subItems || []).map((si: any) => {
 const siBrand = String(si.item?.["ยี่ห้อหรือรูปแบบ"] || si["ยี่ห้อหรือรูปแบบ"] ||"").trim();
 const siSize = String(si.item?.["ขนาด"] || si["ขนาด"] ||"").trim();
 const siType = String(si.item?.["ประเภท"] || si["ประเภท"] ||"").trim();
 const siName = String(si.item?.["รายการ"] || si["รายการ"] ||"").trim();
 const siCond = String(si.item?.["สภาพ"] || si["สภาพ"] ||"ใหม่").trim();

 const siMasterMatch = (items || []).find(m =>
 String(m["รายการ"] ||"").trim() === siName &&
 String(m["ประเภท"] ||"").trim() === siType &&
 String(m["ยี่ห้อหรือรูปแบบ"] ||"").trim() === siBrand &&
 String(m["ขนาด"] ||"").trim() === siSize &&
 (!siCond || String(m["สภาพ"] ||"").trim() === siCond)
 );

 return {
 ...si,
 item: siMasterMatch || si.item || si,
 quantity: Number(si.quantity || si.จำนวน || 1),
 displayString: siMasterMatch
 ? [siMasterMatch["ยี่ห้อหรือรูปแบบ"], siMasterMatch["สภาพ"], siMasterMatch["ขนาด"], siMasterMatch["รายการ"], siMasterMatch["รายละเอียด"]].filter(v => v && v !== '-').join(' ')
 : [
 si.ประเภท || si.item?.ประเภท,
 si.ยี่ห้อหรือรูปแบบ || si.item?.ยี่ห้อหรือรูปแบบ,
 si.รายการ || si.item?.รายการ,
 si.ขนาด || si.item?.ขนาด,
 si.รายละเอียด || si.item?.รายละเอียด
 ].filter(v => v && v !== '-').join(' ') ||"อุปกรณ์เสริม"
 };
 });

 return {
 id: Math.random().toString(36).slice(7),
 action: 'issue',
 item: masterMatch || { ...jobItem.item, ...jobItem },
 quantity: Number(jobItem.quantity || jobItem.จำนวน || 1),
 subItems: mappedSubItems,
 displayString: masterMatch
 ? [masterMatch["ยี่ห้อหรือรูปแบบ"], masterMatch["สภาพ"], masterMatch["ขนาด"], masterMatch["รายการ"], masterMatch["รายละเอียด"]].filter(v => v && v !== '-').join(' ')
 : [jobItem["ยี่ห้อหรือรูปแบบ"], jobItem["สภาพ"], jobItem["ขนาด"], jobItem["รายการ"], jobItem["รายละเอียด"]].filter(v => v && v !== '-').join(' ') || jobItem.displayString ||"พัสดุเบิกออก",
 isFromJob: true
 };
 });

 setCart(imported);
 setNote(job.note ||"");
 setCv(job.cv || job.CV || job["เลข CV"] ||"");
 if (job.operator) setNotifier(job.operator);
 const jobWhId = Number(job.warehouse_id || job.warehouseId || job.items?.find((it: any) => it?.warehouse_id || it?.warehouseId)?.warehouse_id || job.items?.find((it: any) => it?.warehouse_id || it?.warehouseId)?.warehouseId || 0);
if (jobWhId > 0) setWarehouseId(jobWhId);

 if (job.timestamp) {
 const d = new Date(job.timestamp);
 if (!isNaN(d.getTime())) setNotificationDate(d.toISOString().split('T')[0]);
 }

 setSelectedJobId(job.jobId);
 setError(shortageFound ?"⚠️ มีพัสดุบางรายการในใบงานที่มีสต็อกไม่พอกรุณาตรวจสอบ" : null);
 setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 300);
 } catch (err: any) {
 console.error("Critical error in IssueForm import:", err);
 setError("เกิดข้อผิดพลาดในการโหลดข้อมูล:" + err.message);
 }
 }}
 disabled={!selectedJobId}
 className="bg-amber-600 text-white h-14 px-6 rounded-2xl text-[14px] font-black flex items-center gap-2 disabled:opacity-50 disabled:grayscale"
 >
 <span className="material-symbols-outlined text-[20px]">bolt</span>
 ตกลง
 </button>
 )}
 </div>
 </div>

 {cv && (
 <div className="p-3 border-b border-slate-100 bg-white">
 <div className="bg-slate-50/80 rounded-xl border border-slate-200/60 p-4 relative overflow-hidden group">
 {/* Background Icon Decoration */}
 <div className="absolute -top-3 -right-3 p-3 opacity-3">
 <span className="material-symbols-outlined text-[70px] text-amber-900">description</span>
 </div>

 <div className="flex justify-between items-start mb-4 relative">
 <div className="space-y-1 flex-1 pr-2">
 <div className="flex items-center gap-2 mb-0.5">
 <div className="flex items-center gap-1 bg-amber-600 text-white px-2 py-0.5 rounded-full">
 <span className="material-symbols-outlined text-[12px] font-black">assignment</span>
 <span className="text-[9px] font-black uppercase tracking-widest">แผนแจ้งงาน</span>
 </div>
 {selectedJobId && (
 <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-lg border border-amber-100 uppercase italic">
 #{selectedJobId}
 </span>
 )}
 </div>

 {(() => {
 const activeCustomer = customers.find(c => String(c.cv || c.CV || c["เลข CV"] || '') === String(cv));
 return (
 <>
 <h3 className="text-[16px] font-black text-slate-800 tracking-tight leading-tight">
 {activeCustomer?.name ||"กำลังโหลด..." }
 </h3>
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
 <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
 <span className="material-symbols-outlined text-[14px]">id_card</span>
 CV: <span className="text-slate-600 underline font-black">{cv}</span>
 </span>
 {activeCustomer?.phone && (
 <a href={`tel:${activeCustomer.phone}`} className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
 <span className="material-symbols-outlined text-[14px]">call</span>
 {activeCustomer.phone}
 </a>
 )}
 <button 
 disabled={!activeCustomer}
 onClick={() => {
 const query = activeCustomer?.lat && activeCustomer?.lng 
 ?`${activeCustomer.lat},${activeCustomer.lng}` 
 : activeCustomer?.address || cv;
 window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
 }}
 className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"
 >
 <span className="material-symbols-outlined text-[14px]">map_search</span>
 ดูแผนที่
 </button>
 </div>
 
 {activeCustomer?.address && (
 <div className="mt-3 flex gap-2 p-2.5 bg-white/50 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-snug">
 <span className="material-symbols-outlined text-[16px] text-slate-300 shrink-0">location_on</span>
 <p className="font-bold italic">
 {[activeCustomer.address, activeCustomer.subdistrict, activeCustomer.district, activeCustomer.province, activeCustomer.zipcode].filter(Boolean).join(' ')}
 </p>
 </div>
 )}
 </>
 );
 })()}
 <div className="flex items-center gap-2 mt-2">
 {(() => {
 const job = pendingJobs.find(j => j.jobId === selectedJobId);
 if (job?.note) return (
 <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-xl border border-amber-100 ml-2">
 <span className="material-symbols-outlined text-[12px]">priority_high</span>
 <span className="text-[9px] font-black">มีข้อความสั่งการ</span>
 </div>
 );
 })()}
 </div>
 </div>

 <button
 onClick={() => { setCv(""); setSelectedJobId(null); setCart([]); }}
 className="w-10 h-10 bg-white border border-slate-100 rounded-full flex items-center justify-center text-slate-300"
 >
 <span className="material-symbols-outlined text-[20px]">close</span>
 </button>
 </div>

 <div className="grid grid-cols-1 gap-3 relative">
 {/* ข้อมูล Job สั่งการ - แสดงผลแบบเต็มความกว้าง */}
 <div className="space-y-3 bg-amber-50/50 px-2 py-4 sm:p-3 rounded-xl border border-amber-100/50">
 <p className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] mb-0.5">รายละเอียดงาน</p>
 {(() => {
 const job = pendingJobs.find(j => j.jobId === selectedJobId);
 return (
 <>
 <div className="grid grid-cols-2 gap-3 border-b border-amber-100/50 pb-3 mb-3">
 <div className="flex items-center gap-3 text-slate-600">
 <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-amber-500 shrink-0 border border-amber-50">
 <span className="material-symbols-outlined text-[16px]">person_check</span>
 </div>
 <div className="flex flex-col min-w-0">
 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-0.5">คนสั่งงาน / ประเภท</span>
 <span className="text-[12px] font-black text-amber-600 uppercase truncate">{job?.operator ||"SYSTEM"} / {job?.type ||"DELIVERY"}</span>
 </div>
 </div>
 <div className="flex items-center gap-3 text-slate-600 border-l border-amber-100/50 pl-3">
 <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-amber-500 shrink-0 border border-amber-50">
 <span className="material-symbols-outlined text-[16px]">event_available</span>
 </div>
 <div className="flex flex-col min-w-0">
 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-0.5">เวลานัดหมาย</span>
 <span className="text-[12px] font-black text-amber-600 uppercase truncate">
 {(() => {
 const dateVal = job?.appointmentDate || job?.appointment_date || job?.timestamp || job?.date;
 if (!dateVal) return"ไม่ระบุเวลา";
 const d = new Date(dateVal);
 if (isNaN(d.getTime())) return"ไม่ระบุเวลา";
 return d.toLocaleString('th-TH', {
 day: '2-digit',
 month: 'short',
 year: '2-digit',
 hour: '2-digit',
 minute: '2-digit'
 });
 })()}
 </span>
 </div>
 </div>
 </div>
 <div className="flex items-start gap-3 pt-0.5">
 <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-amber-400 shrink-0 border border-amber-50">
 <span className="material-symbols-outlined text-[16px]">sticky_note_2</span>
 </div>
 <div className="flex flex-col flex-1">
 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-1">หมายเหตุสั่งการจากส่วนกลาง</span>
 <p className="text-[12px] font-black text-slate-700 leading-tight bg-white p-2.5 rounded-xl border border-amber-100/30 min-h-[40px]">
 {job?.note ||"- ไม่มีหมายเหตุพิเศษ -"}
 </p>
 </div>
 </div>
 </>
 );
 })()}
 </div>
 </div>
 </div>
 </div>
 )}

 <Suspense fallback={<div className="p-6 text-center text-base-content/50 font-semibold"><span className="app-spinner-sm mr-2" aria-hidden="true"></span>กำลังโหลด...</div>}>
 <div className="">
 {!selectedJobId && (
 <ItemSelector
 key={`issue-picker-${resetKey}`}
 items={items} action={action} cart={cart} tempSubItems={tempSubItems}
 onAddToCart={handleAddToCart} onAddSubItem={handleAddSubItem} onRemoveSubItem={handleRemoveSubItem}
 onUpdateSubItemQty={() => { }}
 setError={setError} error={error}
 persistenceKey={LOGISTICS_KEY +"-picker"}
 />
 )}

 {cart.length > 0 && (
 <div className="bg-slate-50 border-t border-slate-100 rounded-3xl overflow-hidden mt-8">
 <div className="p-4 sm:p-8 space-y-8">
 <div className="mobile-row flex items-center justify-between mb-2">
 <h4 className="text-[14px] font-black uppercase text-slate-900 tracking-tight">รายการคัดกรองพัสดุเบิกออก ({cart.length} ชิ้น)</h4>
 <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="h-10 px-4 bg-emerald-50 text-emerald-600 rounded-xl text-[12px] font-black uppercase tracking-widest">เพิ่มรายการ</button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {cart.map((c, idx) => (
 <div key={c.id} className="bg-white rounded-xl p-6 border border-slate-100 relative overflow-hidden group">
 <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
 {/* Row: Item Info + Quantity Picker */}
 <div className="flex justify-between items-start mb-4">
 <div className="space-y-1">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider border border-amber-100">UNIT {idx + 1}</span>
 {c.isFromJob && <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase border border-indigo-100">JOB</span>}
 {c.quantity > 1 && (
 <div className="bg-slate-900 text-white px-2.5 py-0.5 rounded-lg font-black text-[12px]">
 x{c.quantity}
 </div>
 )}
 </div>
 <p className="text-[16px] font-black text-slate-900 uppercase leading-none mt-1">
 {(c.item && (c.item["ประเภท"] || c.item.type))} {(c.item && (c.item["ยี่ห้อหรือรูปแบบ"] || c.item.brand)) || c.displayString ||"ไม่มีชื่อรายการ"}
 </p>
 <div className="flex flex-col gap-1">
 <span className="text-[11px] font-bold text-slate-500 leading-tight line-clamp-2">{(c.item && (c.item["รายการ"] || c.item.name))} {(c.item && (c.item["ขนาด"] || c.item.size)) &&`(${(c.item["ขนาด"] || c.item.size)})`}</span>
 <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">{(c.item && (c.item["สภาพ"] || c.item.condition)) || 'ปกติ (Stock)'}</span>
 </div>
 </div>
 {(() => {
 const sn = String(c.item?.["รายการ"] || c.item?.name ||"").trim();
 const st = String(c.item?.["ประเภท"] || c.item?.type ||"").trim();
 const sb = String(c.item?.["ยี่ห้อหรือรูปแบบ"] || c.item?.brand ||"").trim();
 const ss = String(c.item?.["ขนาด"] || c.item?.size ||"").trim();
 const sc = String(c.item?.["สภาพ"] || c.item?.condition ||"").trim();
 let master = items.find(m => Number(m.rowIndex || m.id || 0) === Number(c.item?.rowIndex || c.item?.id || c.item?.item_id || 0));
 if (!master) master = items.find(m =>
 String(m["รายการ"]).trim() === sn && String(m["ประเภท"]).trim() === st &&
 String(m["ยี่ห้อหรือรูปแบบ"]).trim() === sb && String(m["ขนาด"]).trim() === ss &&
 (!sc || String(m["สภาพ"]).trim() === sc));
 const stock = getWarehouseReadyStock(master || c.item, warehouseId);
 if (stock < c.quantity) return (
 <div className="mt-3 flex flex-col gap-2 p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
 <div className="flex items-center gap-2 text-rose-600">
 <span className="material-symbols-outlined text-[20px]">warning</span>
 <span className="text-[13px] font-black uppercase tracking-wide">สต็อกไม่พอ (ขาด: {c.quantity - stock})</span>
 </div>
 <div className="mobile-row flex items-center justify-between text-[11px] font-bold">
 <span className="text-slate-500 uppercase tracking-widest">ในคลังคงเหลือ:</span>
 <span className="text-rose-600 bg-white px-2 py-0.5 rounded-lg border border-rose-100">{stock} {c.item?.["หน่วย"] ||"ชิ้น"}</span>
 </div>
 </div>
 );
 return null;
 })()}

 {/* Right: Quantity Picker */}
 <div className="flex flex-col items-end gap-3 shrink-0">
 <div className="flex items-center bg-white border border-slate-200 rounded-2xl overflow-hidden h-12">
 <button
 onClick={() => {
 const newCart = cart.map(item => {
 if (item.id === c.id) return { ...item, quantity: Math.max(1, item.quantity - 1) };
 return item;
 });
 setCart(newCart);
 }}
 className="w-12 h-12 flex items-center justify-center text-slate-500 border-r border-slate-100"
 >
 <span className="material-symbols-outlined text-[20px]">remove</span>
 </button>
 <div className="w-10 text-center text-[15px] font-black text-slate-900">{c.quantity}</div>
 <button
 onClick={() => {
 const newCart = cart.map(item => {
 if (item.id === c.id) return { ...item, quantity: item.quantity + 1 };
 return item;
 });
 setCart(newCart);
 }}
 disabled={c.isFromJob}
 className="w-12 h-12 flex items-center justify-center text-slate-500 disabled:opacity-10 border-l border-slate-100"
 >
 <span className="material-symbols-outlined text-[20px]">add</span>
 </button>
 </div>
 <button
 onClick={() => setCart(prev => prev.filter(item => item.id !== c.id))}
 className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500"
 >
 <span className="material-symbols-outlined">delete</span>
 </button>
 </div>
 </div>

 {/* Full-width Serial Number (inside key div) */}
 <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end px-0">
 <div className="space-y-1">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Serial Number (S/N)</label>
 <input
 type="text"
 placeholder="ระบุ S/N (ถ้ามี)"
 value={c.serialNumber || ''}
 onChange={(e) => {
 setCart(prev => prev.map(item => item.id === c.id ? { ...item, serialNumber: e.target.value } : item));
 }}
 className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-bold focus:bg-white focus:border-amber-300 outline-none"
 />
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Asset Tag</label>
 <input
 type="text"
 placeholder="ระบุ Asset Tag (ถ้ามี)"
 value={c.assetTag || ''}
 onChange={(e) => {
 setCart(prev => prev.map(item => item.id === c.id ? { ...item, assetTag: e.target.value } : item));
 }}
 className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-bold focus:bg-white focus:border-amber-300 outline-none"
 />
 </div>
 <button
 onClick={() => {
 setActiveScannerItemId(c.id);
 setIsScannerOpen(true);
 }}
 className="h-[50px] w-full md:w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100"
 title="สแกนบาร์โค้ด"
 >
 <span className="material-symbols-outlined text-[16px]">barcode_scanner</span>
 </button>
 </div>
 <p className="mt-2 px-1 text-[10px] font-medium text-slate-400">ถ้ามีรหัสเดียว กรอกช่องใดช่องหนึ่งได้ ระบบยังใช้ fallback เดิม</p>

 {/* Full-width Sub-items (inside key div) */}
 {c.subItems && c.subItems.length > 0 && (
 <div className="mt-3 space-y-3 px-0">
 {c.subItems.map((s: any, si: number) => {
 const search = s.item || s;
 const subMaster = items.find(m =>
 (search.rowIndex && m.rowIndex === search.rowIndex) ||
 (
 String(m["รายการ"]).trim() === String(search.รายการ || search.name ||"").trim() &&
 String(m["ประเภท"]).trim() === String(search.ประเภท || search.type ||"").trim()
 )
 );
 return (
 <div key={si} className="mobile-row flex items-center justify-between gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
 <div className="flex flex-col min-w-0 pr-1">
 <span className="text-[13px] font-bold text-slate-800 uppercase truncate leading-tight">
 {(() => {
 const d = subMaster || s.item || s;
 return`${d.ประเภท || ''} ${d.ยี่ห้อหรือรูปแบบ || ''} ${d.รายการ || ''} ${d.ขนาด ?`ขนาด ${d.ขนาด}` : ''} ${d.สภาพ ?`สภาพ ${d.สภาพ}` : ''} ${d.รายละเอียด || ''}`.replace(/\s+/g, ' ').trim() || s.displayString ||"อุปกรณ์เสริม";
 })()}
 </span>
 </div>
 <div className="flex items-center gap-1.5 shrink-0">
 <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden h-9">
 <button
 onClick={() => {
 setCart(prev => prev.map(item => {
 if (item.id === c.id) {
 const updatedSubItems = (item.subItems || [])
 .map((sub, idx) => idx === si ? { ...sub, quantity: sub.quantity - 1 } : sub)
 .filter(sub => sub.quantity > 0);
 return { ...item, subItems: updatedSubItems };
 }
 return item;
 }));
 }}
 className="w-9 h-9 flex items-center justify-center text-slate-500 border-r border-slate-100"
 ><span className="material-symbols-outlined text-[16px]">remove</span></button>
 <span className="w-6 text-center text-[13px] font-black text-slate-800">{s.quantity}</span>
 <button
 onClick={() => {
 setCart(prev => prev.map(item => {
 if (item.id === c.id) {
 const updatedSubItems = (item.subItems || [])
 .map((sub, idx) => idx === si ? { ...sub, quantity: sub.quantity + 1 } : sub);
 return { ...item, subItems: updatedSubItems };
 }
 return item;
 }));
 }}
 className="w-9 h-9 flex items-center justify-center text-slate-500 border-l border-slate-100"
 ><span className="material-symbols-outlined text-[16px]">add</span></button>
 </div>
 <button
 onClick={() => {
 setCart(prev => prev.map(item => {
 if (item.id === c.id) {
 return { ...item, subItems: (item.subItems || []).filter((_, idx) => idx !== si) };
 }
 return item;
 }));
 }}
 className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-400 ml-1"
 >
 <span className="material-symbols-outlined text-[16px]">close</span>
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>

 <LogisticsSummary
 cart={cart} action={action} cv={cv} setCv={setCv}
 deliveryBy={deliveryBy} setDeliveryBy={setDeliveryBy}
 deliveryDate={deliveryDate} setDeliveryDate={setDeliveryDate} deliveryTime={deliveryTime} setDeliveryTime={setDeliveryTime}
 workZone={workZone} setWorkZone={setWorkZone} note={note} setNote={setNote}
 onSuccess={(txnNo) => {
 if (txnNo) {
 setSavedTxnNo(txnNo);
 localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'saved-txn'), txnNo);
 }
 onSuccess();
 }} 
 setStep={updateStep}
 operatorName={operatorName} loading={loading}
 setLoading={setLoading} setError={setError} error={error} onEditCustomer={() => setIsCustomerModalOpen(true)}
 customers={customers} zones={zones} transactions={transactions}
 notifier={notifier} setNotifier={setNotifier}
 notificationDate={notificationDate} setNotificationDate={setNotificationDate}
 returnReason={returnReason} setReturnReason={setReturnReason}
 cabinetCondition={cabinetCondition} setCabinetCondition={setCabinetCondition}
 jobId={selectedJobId}
 warehouses={warehouses}
 warehouseId={warehouseId}
 setWarehouseId={setWarehouseId}
 />

 </div>
 )}
 </div>
 </Suspense>
 </div>

 <Suspense fallback={null}>
 <CustomerQuickEdit
 isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)}
 customer={customers.find(c => {
 const customerCv = String((c as any).cv || (c as any).CV || (c as any)["เลข CV"] || (c as any)["เลขCV"] || '');
 return customerCv === String(cv);
 }) || { cv: cv, name: '', phone: '', address: '', subdistrict: '', district: '', province: '', zipcode: '', lat: '', lng: '' }}
 onSave={async () => { const data = await getCustomers(); setCustomers(data); }} thaiAddressData={thaiAddressData}
 customers={customers}
 />
 </Suspense>
 {/* Barcode Scanner Modal */}
 <BarcodeScanner
 isOpen={isScannerOpen}
 onClose={() => setIsScannerOpen(false)}
 onScan={(code) => {
 if (activeScannerItemId === 'job-search') {
 // Filter jobs by scanned code (JobId or CV)
 const matchedJob = pendingJobs.find(j => String(j.jobId) === code || String(j.cv || j.CV) === code);
 if (matchedJob) {
 setSelectedJobId(matchedJob.jobId);
 setError(null);
 } else {
 setError("ไม่พบข้อมูลใบงานหรือ CV ที่สแกน:" + code);
 }
 } else {
 setCart(prev => prev.map(item =>
 item.id === activeScannerItemId ? { ...item, serialNumber: code, assetTag: item.assetTag || code } : item
 ));
 }
 setIsScannerOpen(false);
 }}
 />
 </div>
 );
}
