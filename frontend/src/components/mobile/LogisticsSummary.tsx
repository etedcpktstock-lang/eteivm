import React, { useState, useMemo, useEffect } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { processBatchTransaction, getNextTxnNo, getNextCustomerCv, getCustomers } from '../../api';
import { getCoordinates } from '../../utils/locationUtils';

interface LogisticsSummaryProps {
 cart: any[];
 action: 'receive' | 'issue' | 'return';
 cv: string;
 setCv: (v: string) => void;
 deliveryBy: string;
 setDeliveryBy: (v: string) => void;
 deliveryDate: string;
 setDeliveryDate: (v: string) => void;
 deliveryTime: string;
 setDeliveryTime: (v: string) => void;
 workZone: string;
 setWorkZone: (v: string) => void;
 note: string;
 setNote: (v: string) => void;
 onSuccess: (txnNo?: string) => void;
 setStep: (v: any) => void;
 operatorName: string;
 loading: boolean;
 setLoading: (v: boolean) => void;
 setError: (v: string | null) => void;
 error: string | null;
 onEditCustomer: () => void;
 customers: any[];
 zones: any[];
 transactions: any[];
 customSubmit?: () => Promise<void>;
 customSubmitText?: string;
 // New Fields for Return based on Mind Map
 notifier?: string;
 setNotifier?: (v: string) => void;
 notificationDate?: string;
 setNotificationDate?: (v: string) => void;
 returnReason?: string;
 setReturnReason?: (v: string) => void;
 cabinetCondition?: string;
 setCabinetCondition?: (v: string) => void;

 jobId?: string | null;
 matchedJob?: any;
 warehouses: any[];
 warehouseId?: number;
 setWarehouseId?: (id: number) => void;
 photos?: string[]; // 👈 Add photos prop
}


const LogisticsSummary: React.FC<LogisticsSummaryProps> = ({
 cart, action, cv, setCv, deliveryBy, setDeliveryBy, deliveryDate, setDeliveryDate,
 deliveryTime, setDeliveryTime, workZone, setWorkZone, note, setNote,
 onSuccess, setStep, operatorName, loading, setLoading, setError, error, onEditCustomer,
 customers, zones, transactions = [], customSubmit, customSubmitText,
 notifier = '', setNotifier, notificationDate = '', setNotificationDate,
 returnReason = '', setReturnReason, cabinetCondition = '', setCabinetCondition,
 jobId = null, matchedJob = null, warehouses = [],
 warehouseId: propWarehouseId, setWarehouseId: propSetWarehouseId,
 photos = [] // 👈 Destructure photos
}) => {
 const [localWarehouseId, setLocalWarehouseId] = useState<number>(() => {
 const saved = localStorage.getItem('ete-last-warehouse');
 return saved ? parseInt(saved) : 1;
 });

 const effectiveWarehouseId = propWarehouseId !== undefined ? propWarehouseId : localWarehouseId;

 const handleWarehouseChange = (id: number) => {
 if (propSetWarehouseId) {
 propSetWarehouseId(id);
 } else {
 setLocalWarehouseId(id);
 localStorage.setItem('ete-last-warehouse', id.toString());
 }
 };

 const isReturn = action === 'return';
 const isReceive = action === 'receive';
 const isIssue = action === 'issue';
 const showReturnFields = isReturn || (action === 'receive' && !!cv);

 const theme = {
 bg: isReturn ? 'bg-purple-50' : (isReceive ? 'bg-emerald-50' : 'bg-amber-50'),
 text: isReturn ? 'text-purple-600' : (isReceive ? 'text-emerald-600' : 'text-amber-600'),
 border: isReturn ? 'border-purple-100' : (isReceive ? 'border-emerald-100' : 'border-amber-100'),
  spinner: isReturn ? 'border-purple-600' : (isReceive ? 'border-emerald-600' : 'border-amber-600'),
 accent: isReturn ? 'bg-purple-700' : (isReceive ? 'bg-emerald-600' : 'bg-amber-600')
 };

 const [isRiderDropdownOpen, setIsRiderDropdownOpen] = useState(false);
 const [isSearching, setIsSearching] = useState(false);
 const [searchResults, setSearchResults] = useState<any[]>([]);

 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 const riderDropdown = document.querySelector('.searchable-rider-dropdown');
 if (riderDropdown && !riderDropdown.contains(event.target as Node)) {
 setIsRiderDropdownOpen(false);
 }
 };
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 const matchedCustomer = useMemo(() => customers.find(c => {
 const customerCv = String(c.cv || c.CV || c["เลข CV"] || c["เลขCV"] || '');
 return customerCv === String(cv);
 }), [customers, cv]);

 // Removed automatic zone detection as per request to force manual selection
 /*
 useEffect(() => {
 if (matchedCustomer?.province && !workZone && zones.length > 0) {
 const pName = String(matchedCustomer.province).trim();
 const matchedZone = zones.find(z => String(z.name).includes(pName));
 if (matchedZone) {
 setWorkZone(matchedZone.name);
 }
 }
 }, [matchedCustomer, zones, workZone, setWorkZone]);
 */

 const handleSearch = async () => {
 const search = cv.trim().toLowerCase();
 if (!search) {
 setError("กรุณาระบุชื่อ หรือ เลข CV เพื่อค้นหา");
 return;
 }
 setIsSearching(true);
 setError(null);
 try {
 let hits = customers.filter(c => {
 const customerCv = String(c.cv || c.CV || '').toLowerCase();
 const customerName = String(c.name || '').toLowerCase();
 return customerCv.includes(search) || customerName.includes(search);
 }).slice(0, 50);

 if (hits.length === 0) {
 const freshData = await getCustomers(true);
 hits = freshData.filter((c: any) => {
 const customerCv = String(c.cv || c.CV || '').toLowerCase();
 const customerName = String(c.name || '').toLowerCase();
 return customerCv.includes(search) || customerName.includes(search);
 }).slice(0, 50);
 }

 if (hits.length === 0) {
 setError("ไม่พบข้อมูลลูกค้าในระบบฐานข้อมูล");
 setSearchResults([]);
 } else {
 setSearchResults(hits);
 }
 } catch (err: any) {
 setError("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล:" + err.message);
 } finally {
 setIsSearching(false);
 }
 };

 const handleSelectCustomer = (selected: any) => {
 setCv(String(selected.cv || selected.CV || ''));
 setSearchResults([]);
 };

 const uniqueDeliveries = useMemo(() => Array.from(new Set(transactions.map(t => typeof t.จัดส่งโดย === 'string' ? t.จัดส่งโดย : String(t.จัดส่งโดย || '')).filter(Boolean))).slice(0, 5), [transactions]);

 const handleFinalSubmit = async () => {
 if (customSubmit) {
 await customSubmit();
 return;
 }

 // Validation
 const safeCv = typeof cv === 'string' ? cv : String(cv || '');
 if (action === 'issue' && !safeCv.trim()) { setError('กรุณาระบุเลข CV'); return; }

 if (action === 'return') {
 const missingReason = cart.some(c => !c.returnReason && c.item?.ประเภท === 'ตู้แช่');
 if (missingReason) {
 setError('กรุณาระบุสาเหตุที่เก็บกลับให้ครบทุกรายการ');
 return;
 }
 }

 // ลูกค้าต้องมีข้อมูลเสมอในงานที่ผูกลูกค้า
 if (action === 'issue' || action === 'return') {
 if (!matchedCustomer) {
 setError('ไม่พบข้อมูลลูกค้าในระบบ กรุณาตรวจสอบ CV ก่อนบันทึก');
 return;
 }
 const missingCustomerInfo = !String(matchedCustomer.name || '').trim() || !String(matchedCustomer.address || '').trim();
 if (missingCustomerInfo) {
 setError('ข้อมูลลูกค้าไม่ครบ (ต้องมีชื่อและที่อยู่) กรุณาแก้ข้อมูลลูกค้าก่อนบันทึก');
 return;
 }
 }

 // 🔒 เช็คสต็อกซ้ำก่อนเบิกสินค้า
 if (action === 'issue') {
 const requiredByItem = new Map<string, { label: string; required: number; available: number }>();
 const addRequired = (rawItem: any, qtyRaw: number) => {
 const qty = Number(qtyRaw || 0);
 if (qty <= 0 || !rawItem) return;
 const itemId = Number(rawItem.id || rawItem.rowIndex || rawItem.item_id || 0);
 const key = itemId > 0 ? `id:${itemId}` : `k:${String(rawItem.ประเภท || '')}|${String(rawItem.ยี่ห้อหรือรูปแบบ || '')}|${String(rawItem.รายการ || '')}|${String(rawItem.ขนาด || '')}|${String(rawItem.สภาพ || '')}`;
 const label = `${rawItem.ประเภท || ''} ${rawItem.ยี่ห้อหรือรูปแบบ || ''} ${rawItem.รายการ || ''} ${rawItem.ขนาด || ''}`.replace(/\s+/g, ' ').trim() || 'พัสดุ';
 // Fallback: use backend-computed total stock
 let available = Number(rawItem?.available_stock ?? 0);
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
 setError(`สต็อกไม่พอสำหรับการเบิก: ${first.label} (เหลือ ${first.available} แต่ต้องการ ${first.required})`);
 return;
 }
 }

 // 🔥 FIXED: Only require workZone for Issue & Return
 if (action !== 'receive') {
 if (!workZone || workZone === '-- เลือกเขตการทำงาน --') {
 setError('กรุณาเลือกเขตการทำงาน');
 return;
 }
 }

 setLoading(true); setError('');
 try {
 // 📍 Capture GPS for Geofencing
 const coords = await getCoordinates();

 const txnNo = await getNextTxnNo();
 const combinedDate = deliveryBy ? (deliveryDate ?`${deliveryDate}T${deliveryTime || '00:00'}` : '') : '';

 const batchItems = cart.filter(c => c && c.item).flatMap(c => {
 const qty = Number(c.quantity || 1);
 const results: any[] = [];
 
 // If it's a return and quantity > 1, and no specific splitting was done by the parent,
 // we handle the expansion here as a safety measure for the DB.
 // 🚀 CRITICAL FIX: Always split into individual units (Quantity = 1) for all actions
 // This ensures the backend and receipt show each item separately.
 const shouldSplit = qty > 1;
 const subQtys = shouldSplit ? Array.from({ length: qty }).fill(1) : [qty];


 subQtys.forEach((subQty, idx) => {
 const rawSerial = String(c.serialNumber || c.serial_number || '').trim();
 const rawTag = String(c.assetTag || c.asset_tag || '').trim();
 const trackingType = String(c.item?.tracking_type || c.tracking_type || 'BATCH').toUpperCase();
 const resolvedAssetTag = rawTag || (trackingType === 'SERIALIZED' ? rawSerial : '');

 results.push({
 item: {
 ...c.item,"รายการ": c.item.รายการ || c.displayString || 'พัสดุเบิกออก'
 },
 quantity: subQty,
 isSub: false,
 subType: '',
 status: action === 'return' ? (c.status || 'รอตรวจ') : (c.status || undefined),
 cabinetCondition: action === 'return' ? (c.status || c.cabinetCondition || 'รอตรวจ') : (c.cabinetCondition || 'ปกติ'),
 serialNumber: rawSerial,
 assetTag: resolvedAssetTag,
 returnReason: c.returnReason || returnReason, // Use per-item or fallback
 note: (c.status && c.status !== 'ปกติ') ?`[RIDER CLAIM: ${c.status}]` : undefined
 });
 });
 
 // Add subItems
 if (c.subItems && Array.isArray(c.subItems)) {
 results.push(...c.subItems.map((s: any) => {
 const itemData = s.item || s;
 if (!itemData) return null;
 
 return {
 item: {
 ...itemData,"รายการ": itemData.รายการ || itemData.name || s.displayString || 'อุปกรณ์เสริม'
 },
 quantity: s.quantity || 1,
 isSub: true,
 subType: s.type || '',
 serialNumber: s.sn || '',
 assetTag: s.assetTag || s.asset_tag || '',
 status: action === 'return' ? (s.condition || 'รอตรวจ') : (c.status || undefined),
 cabinetCondition: s.condition || 'ปกติ',
 returnReason: c.returnReason || returnReason,
 note: (s.condition && s.condition !== 'ปกติ') ?`[RIDER CLAIM (ACC): ${s.condition}]` : undefined
 };
 }).filter(Boolean));
 }


 return results;
 });

 if (batchItems.length === 0) throw new Error("ไม่พบรายการพัสดุที่จะบันทึก");

 await processBatchTransaction({
 action,
 items: batchItems,
 cv,
 deliveryBy,
 deliveryDate: combinedDate,
 txnNo,
 operator: operatorName,
 note,
 workZone: action === 'receive' ? (workZone || '-') : workZone, // Fallback for receive
 notifier,
 notificationDate,
 returnReason,
 cabinetCondition,
 jobId: jobId || undefined,
 lat: coords?.lat?.toString(),
 lng: coords?.lng?.toString(),
 warehouseId: effectiveWarehouseId,
 photos, // 👈 Send to API
 status: jobId ? (() => {
 if (action === 'issue') {
 const hasReturnItems = matchedJob?.items?.some((it: any) =>
 ['RETURN', 'RECEIVE', 'แจ้งคืน'].includes(String(it.action_type || '').toUpperCase()) ||
 String(it.action_type || '').includes('คืน')
 );
 return hasReturnItems ? 'กำลังไปส่งและรับคืน' : 'เบิกออก - กำลังเดินทาง';
 }
 if (action === 'return') return 'รอตรวจสภาพ - ถึงออฟฟิศแล้ว';
 return undefined;
 })() : undefined
 });


 setStep('success');
 if (onSuccess) onSuccess(txnNo);
 } catch (err: any) {
 setError(err.message || 'Error occurred');
 } finally {
 setLoading(false);
 }
 };

 const handlePlusClick = async () => {
 try {
 const nextCv = await getNextCustomerCv();
 setCv(nextCv);
 onEditCustomer();
 } catch (err) {
 onEditCustomer();
 }
 };

 const inputClass =`w-full h-14 bg-white border border-slate-100 rounded-2xl px-5 text-[15px] font-black text-slate-800 outline-none focus:border-slate-200 placeholder:font-normal placeholder:text-slate-300`;
 const labelClass ="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-2 mb-1 block";

 return (
 <div className="px-0 py-6 space-y-8 pb-12 w-full">
 {/* 🟣 JOB INFORMATION SECTION (Premium Ticket Style) */}
 {showReturnFields && (
 <div className=" w-full">
 {jobId && matchedJob ? (
 <div className="bg-white rounded-xl border border-slate-100 overflow-hidden w-full">
 <div className="p-4 sm:p-6 space-y-4">
 <div className="mobile-row flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="bg-amber-600 text-white px-3 py-1 rounded-full flex items-center gap-1.5">
 <span className="material-symbols-outlined text-[14px] font-black">assignment</span>
 <span className="text-[10px] font-black uppercase tracking-widest">แผนแจ้งงาน</span>
 </div>
 <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 uppercase italic">
 #{jobId}
 </span>
 </div>
 </div>

 <div className="px-1">
 <h3 className="text-[19px] font-black text-slate-900 tracking-tight leading-tight">
 {matchedCustomer?.name ||"ไม่ทราบชื่อลูกค้า"}
 </h3>
 <span className="text-[12px] font-bold text-slate-400">CV: <span className="text-slate-600 underline font-black">{cv}</span></span>
 </div>

 <div className="bg-amber-50/50 p-4 sm:p-5 rounded-xl border border-amber-100/50 space-y-4">
 <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] ml-1">รายละเอียดงาน</p>

 <div className="grid grid-cols-2 gap-2 border-b border-amber-100/50 pb-5">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 border border-amber-50 shrink-0">
 <span className="material-symbols-outlined text-[18px]">person_check</span>
 </div>
 <div className="flex flex-col min-w-0">
 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-0.5">คนสั่งงาน / ประเภท</span>
 <span className="text-[12px] font-black text-amber-700 uppercase truncate">
 {matchedJob.operator ||"SYSTEM"} / {matchedJob.type ||"RETURN"}
 </span>
 </div>
 </div>
 <div className="flex items-center gap-3 border-l border-amber-100/50 pl-3">
 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 border border-amber-50 shrink-0">
 <span className="material-symbols-outlined text-[18px]">event_available</span>
 </div>
 <div className="flex flex-col min-w-0">
 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-0.5">เวลานัดหมาย</span>
 <span className="text-[12px] font-black text-amber-700 uppercase">
 {(() => {
 const dateVal = matchedJob.appointmentDate || matchedJob.appointment_date || matchedJob.timestamp;
 if (!dateVal) return"ไม่ระบุเวลา";
 const d = new Date(dateVal);
 return isNaN(d.getTime()) ?"ไม่ระบุเวลา" : d.toLocaleString('th-TH', {
 day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
 });
 })()}
 </span>
 </div>
 </div>
 </div>

 <div className="flex items-start gap-4">
 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-400 border border-amber-50 shrink-0">
 <span className="material-symbols-outlined text-[18px]">sticky_note_2</span>
 </div>
 <div className="flex-1">
 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1 block">หมายเหตุสั่งการจากส่วนกลาง</span>
 <p className="text-[13px] font-black text-slate-700 leading-snug bg-white p-3 rounded-xl border border-amber-100/30 min-h-[50px]">
 {matchedJob.note ||"- ไม่มีหมายเหตุพิเศษ -"}
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 ) : (
 <div className="bg-slate-50/50 px-4 py-8 rounded-[2.5rem] border border-slate-100 space-y-4">
 <div className="flex items-center gap-3 mb-2 px-1">
 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-900 border border-slate-100">
 <span className="material-symbols-outlined text-[22px]">assignment_ind</span>
 </div>
 <h4 className="text-[15px] font-black uppercase text-slate-900 tracking-tight">ข้อมูลผู้แจ้งงาน</h4>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelClass}>ผู้แจ้งงาน</label>
 <input type="text" className={inputClass} placeholder="ระบุชื่อผู้นำส่ง / ผู้แจ้ง..." value={notifier} onChange={e => setNotifier?.(e.target.value)} />
 </div>
 <div className="space-y-1.5">
 <label className={labelClass}>วันที่แจ้งงาน</label>
 <input type="date" className={inputClass} value={notificationDate} onChange={e => setNotificationDate?.(e.target.value)} />
 </div>
 </div>
 </div>
 )}
 </div>
 )}

 {/* 🟢 CUSTOMER SECTION (Manual search only) */}
 {action !== 'receive' && !jobId && (
 <div className="space-y-4">
 <div className="mobile-row flex items-center justify-between px-1">
 <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-widest">{isReturn ? 'ข้อมูลลูกค้า' : 'ปลายทางพัสดุ'}</h3>
 {!jobId && (
 <button onClick={handlePlusClick} className="btn no-animation text-[10px] font-black uppercase px-3 py-1.5 rounded-full bg-slate-900 text-white">เพิ่มลูกค้า</button>
 )}
 </div>

 {!matchedCustomer ? (
 <div className="relative group flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1 group">
 <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600" />
 <input 
 type="text" 
 className="w-full h-14 pl-16 pr-6 bg-white border border-slate-200 rounded-full outline-none focus:border-indigo-500/20 text-[15px] font-bold text-slate-700 placeholder:text-slate-300" 
 placeholder="ระบุชื่อ หรือ เลข CV เพื่อค้นหา..." 
 value={cv} 
 onChange={e => setCv(e.target.value)} 
 onKeyDown={e => e.key === 'Enter' && handleSearch()} 
 />
 </div>
 <button
 onClick={handleSearch}
 disabled={isSearching}
 className={`btn no-animation h-14 px-6 rounded-full text-[13px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shrink-0 ${isSearching ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-indigo-600 text-white '}`}
 >
 {isSearching ? <RefreshCw className="w-5 h-5" /> : <Search size={20} />}
 <span>ค้นหา</span>
 </button>

 {searchResults.length > 0 && (
 <div className="absolute z-50 left-0 right-0 mt-3 bg-white/80 border border-slate-100 rounded-xl max-h-72 overflow-y-auto divide-y divide-slate-50">
 {searchResults.map((c, i) => (
 <button key={i} onClick={() => handleSelectCustomer(c)} className="w-full text-left px-6 py-5 group mobile-row flex items-center justify-between">
 <div className="min-w-0 pr-4">
 <div className="font-black text-slate-900 text-[15px] truncate">{c.name}</div>
 <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 uppercase font-black tracking-tight"><span>CV: {c.cv || c.CV}</span><span className="w-1 h-1 bg-slate-200 rounded-full"></span><span>{c.province}</span></div>
 </div>
 <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 shrink-0">
 <span className="material-symbols-outlined text-[20px]">chevron_right</span>
 </div>
 </button>
 ))}
 <button onClick={() => setSearchResults([])} className="w-full py-3 bg-slate-100/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">ปิดหน้านี้</button>
 </div>
 )}
 </div>
 ) : (
 <div className="bg-white border border-slate-100/60 rounded-xl px-4 py-6 space-y-4 relative">
 <div className="flex justify-between items-start">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center text-white"><span className="material-symbols-outlined text-[28px]">account_circle</span></div>
 <div>
 <h4 className="text-[17px] font-black text-slate-900 leading-tight">{matchedCustomer.name}</h4>
 <div className="flex items-center gap-2 mt-1.5">
 <span className="px-3 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black tracking-widest uppercase">CV: {matchedCustomer.cv || matchedCustomer.CV || 'N/A'}</span>
 </div>
 </div>
 </div>
 {!jobId && (
 <button onClick={() => setCv('')} className="w-10 h-10 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-[20px]">close</span></button>
 )}
 </div>
 <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100 flex gap-4 text-[13px] font-bold text-slate-600 leading-relaxed group">
 <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-300 shrink-0 border border-slate-50">
 <span className="material-symbols-outlined text-[18px]">location_on</span>
 </div>
 <p>{matchedCustomer.address} {matchedCustomer.subdistrict} {matchedCustomer.district} {matchedCustomer.province} {matchedCustomer.zipcode}</p>
 </div>
 </div>
 )}
 </div>
 )}

 {/* 🚚 LOGISTICS INFO */}
 {action !== 'receive' && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-1 md:col-span-2">
 <label className={labelClass}>เขตการทำงาน</label>
 <div className="relative">
 <select className={inputClass +" appearance-none pl-12"} value={workZone} onChange={e => setWorkZone(e.target.value)}>
 <option value="">-- เลือกเขตการทำงาน --</option>
 {zones.map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
 </select>
 <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[22px]">map</span>
 <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 text-[22px] pointer-events-none">expand_more</span>
 </div>
 </div>

 <div className="space-y-1">
 <label className={labelClass}>{isReturn ? 'ชื่อผู้รับคืน' : 'ระบุชื่อพนักงานขนส่ง'}</label>
 <div className="relative group">
 <input type="text" className={inputClass +" pl-12"} placeholder="ระบุชื่อ..." value={deliveryBy} onFocus={() => setIsRiderDropdownOpen(true)} onChange={e => setDeliveryBy(e.target.value)} />
 <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[22px]">local_shipping</span>
 {isRiderDropdownOpen && uniqueDeliveries.length > 0 && (
 <div className="absolute z-50 left-0 right-0 mt-2 bg-white/90 border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
 {uniqueDeliveries.map((d, i) => (
 <button key={i} onClick={() => { setDeliveryBy(d); setIsRiderDropdownOpen(false); }} className="w-full text-left px-5 py-4 text-[13px] font-black text-slate-700">{d}</button>
 ))}
 </div>
 )}
 </div>
 </div>

 <div className="space-y-1">
 <label className={labelClass}>วันที่และเวลาดำเนินการ</label>
<div className="flex flex-col gap-2">
<input type="date" className={inputClass} value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
<div className="flex items-center gap-2 bg-white border border-slate-100 rounded-2xl px-3 h-14">
 <select className="bg-transparent border-none text-[14px] font-black outline-none px-1" value={deliveryTime.split(':')[0]} onChange={e => setDeliveryTime(`${e.target.value}:${deliveryTime.split(':')[1]}`)}>{Array.from({ length: 24 }).map((_, i) => <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>)}</select>
 <span className="font-black text-slate-300">:</span>
 <select className="bg-transparent border-none text-[14px] font-black outline-none px-1" value={deliveryTime.split(':')[1]} onChange={e => setDeliveryTime(`${deliveryTime.split(':')[0]}:${e.target.value}`)}>{Array.from({ length: 60 }).map((_, i) => <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>)}</select>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* 🏢 WAREHOUSE SELECT */}
 <div className="space-y-1">
 <label className={labelClass}>
 คลังสินค้าที่ดำเนินการ
 {jobId && <span className="ml-2 text-rose-500 font-black">(ล็อกตามใบงาน)</span>}
 </label>
 <div className="relative">
 <select
 className={`${inputClass} pl-12 appearance-none border-slate-200 ${jobId ? 'bg-slate-100/80 text-slate-400 cursor-not-allowed opacity-80' : 'bg-slate-900/5'}`}
 value={effectiveWarehouseId}
 onChange={e => handleWarehouseChange(parseInt(e.target.value))}
 disabled={!!jobId}
 >
 {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
 </select>
 <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 ${jobId ? 'text-slate-300' : 'text-slate-900'} text-[22px]`}>hub</span>
 <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[22px] pointer-events-none">expand_more</span>
 </div>
 </div>

 {/* 📝 REMARKS */}
 <div className="space-y-1">
 <label className={labelClass}>บันทึกเพิ่มเติม</label>
 <textarea rows={2} className={inputClass +" h-auto py-5 text-[14px] leading-relaxed resize-none"} placeholder="ระบุสิ่งที่ต้องการบันทึกเพิ่มเติมที่นี่..." value={note} onChange={e => setNote(e.target.value)} />
 </div>

 {/* 🔘 ACTION SECTION */}
 <div className="flex flex-col gap-4 pt-8">
 {error && (
 <div className="p-5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex items-start gap-4 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-2 opacity-10">
 <span className="material-symbols-outlined text-[60px] text-rose-500">warning</span>
 </div>
 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 shrink-0 border border-rose-100">
 <span className="material-symbols-outlined text-[24px]">priority_high</span>
 </div>
 <div className="flex-1 relative">
 <p className="text-[14px] font-black uppercase tracking-tight leading-none mb-1">พบปัญหาในการบันทึก</p>
 <p className="text-[13px] font-bold opacity-80 leading-relaxed">{error}</p>
 </div>
 </div>
 )}
 <button
 id="final-submit-btn"
 onClick={handleFinalSubmit}
 disabled={loading}
 className={`btn no-animation w-full h-16 rounded-full flex items-center justify-center font-black text-white uppercase tracking-[0.2em] text-[16px] ${loading ? 'bg-slate-200 pointer-events-none' : 'bg-slate-900 '}`}
 >
 {loading ? (
 <div className="flex items-center gap-3">
 <RefreshCw className="w-5 h-5" />
 <span>กำลังส่งข้อมูล...</span>
 </div>
 ) : (
 <div className="flex items-center gap-3">
 <span className="material-symbols-outlined text-[24px]">task_alt</span>
 <span>{customSubmitText || 'ยืนยันและบันทึกข้อมูล'}</span>
 </div>
 )}
 </button>
 </div>
 </div>
 );
};

export default React.memo(LogisticsSummary);
