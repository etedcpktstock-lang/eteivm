import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { getCustomers, getZones, processBatchTransaction, getNextTxnNo } from '../../api';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import type { MaterialItem } from '../../types';
import { Button, Icon, LoadingOverlay } from '../shared/CommonUI';

// Lazy load modular components
const ItemSelector = lazy(() => import('./ItemSelector'));
const LogisticsSummary = lazy(() => import('./LogisticsSummary'));
const CustomerQuickEdit = lazy(() => import('../shared/CustomerQuickEdit'));

/** ตรวจสอบว่า cart item มี item object ที่ valid */
const isValidCartItem = (c: any): boolean =>
 c && c.item && typeof c.item === 'object' && !Array.isArray(c.item) && typeof c.item.ประเภท !== 'undefined';

interface ReceiveFormProps {
 items: MaterialItem[];
 onSuccess: () => void;
 operatorName: string;
 transactions?: any[];
 thaiAddressData?: any[];
 warehouses?: any[];
}

export default function ReceiveForm({ items, onSuccess, operatorName, transactions = [], thaiAddressData = [], warehouses = [] }: ReceiveFormProps) {

 const action = 'receive';
 const CART_KEY =`ete-cart-${operatorName}-receive`;
 const LOGISTICS_KEY =`ete-logistics-${operatorName}-receive`;
 const TS_KEY =`ete-ts-${operatorName}-receive`;

 const [step, setStep] = useState<'form' | 'success'>(() => {
 const saved = localStorage.getItem(`${LOGISTICS_KEY}-step`) as any;
 const savedCart = localStorage.getItem(CART_KEY);
 const hasCart = savedCart && savedCart !== '[]';
 if (saved === 'success' && !hasCart) return 'form';
 return saved || 'form';
 });

 const updateStep = (newStep: 'form' | 'success') => {
 setStep(newStep);
 localStorage.setItem(`${LOGISTICS_KEY}-step`, newStep);
 };

 const [cart, setCart] = useState<any[]>(() => {
 const saved = localStorage.getItem(CART_KEY);
 if (!saved) return [];
 try {
 const parsed = JSON.parse(saved);
 return Array.isArray(parsed) ? parsed.filter(isValidCartItem) : [];
 } catch { return []; }
 });

 const now = new Date();
 const defaultDate = now.toLocaleDateString('en-CA');
 const defaultTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

 const [cv, setCv] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-cv`) || '');
 const [deliveryBy, setDeliveryBy] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-deliveryBy`) || '');
 const [deliveryDate, setDeliveryDate] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-deliveryDate`) || defaultDate);
 const [deliveryTime, setDeliveryTime] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-deliveryTime`) || defaultTime);
 const [workZone, setWorkZone] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-workzone`) || '');
 const [note, setNote] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-note`) || '');
 const [savedTxnNo, setSavedTxnNo] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-saved-txn`) || '');

 // Mind Map fields (Optional for Standard Receive)
 const [notifier, setNotifier] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-notifier`) || '');
 const [notificationDate, setNotificationDate] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-notif-date`) || '');
 const [returnReason, setReturnReason] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-reason`) || '');
 const [cabinetCondition, setCabinetCondition] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-condition`) || '');
 const [warehouseId, setWarehouseId] = useState<number>(() => {
 const saved = localStorage.getItem(`${LOGISTICS_KEY}-warehouseId`);
 return saved ? parseInt(saved) : (warehouses[0]?.id || 1);
 });

 useEffect(() => {
 localStorage.setItem(`${LOGISTICS_KEY}-warehouseId`, warehouseId.toString());
 }, [warehouseId]);

 const [customers, setCustomers] = useState<any[]>([]);
 const [zones, setZones] = useState<any[]>([]);
 const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [resetKey, setResetKey] = useState(Date.now());
 const [tempSubItems, setTempSubItems] = useState<any[]>([]);

 useEffect(() => {
 if (step === 'success') return;
 localStorage.setItem(CART_KEY, JSON.stringify(cart));
 localStorage.setItem(TS_KEY, Date.now().toString());
 }, [cart, step]);

 useEffect(() => {
 if (step === 'success') {
 [CART_KEY, TS_KEY,`${LOGISTICS_KEY}-cv`,`${LOGISTICS_KEY}-deliveryBy`,`${LOGISTICS_KEY}-deliveryDate`,`${LOGISTICS_KEY}-deliveryTime`,`${LOGISTICS_KEY}-workzone`,`${LOGISTICS_KEY}-note`,`${LOGISTICS_KEY}-notifier`,`${LOGISTICS_KEY}-notif-date`,`${LOGISTICS_KEY}-reason`,`${LOGISTICS_KEY}-condition`,`${LOGISTICS_KEY}-saved-txn`,`${LOGISTICS_KEY}-step`].forEach(k => localStorage.removeItem(k));
 return;
 }
 const data: Record<string, string> = {
 [`${LOGISTICS_KEY}-cv`]: cv,
 [`${LOGISTICS_KEY}-deliveryBy`]: deliveryBy,
 [`${LOGISTICS_KEY}-deliveryDate`]: deliveryDate,
 [`${LOGISTICS_KEY}-deliveryTime`]: deliveryTime,
 [`${LOGISTICS_KEY}-workzone`]: workZone,
 [`${LOGISTICS_KEY}-note`]: note,
 [`${LOGISTICS_KEY}-notifier`]: notifier,
 [`${LOGISTICS_KEY}-notif-date`]: notificationDate,
 [`${LOGISTICS_KEY}-reason`]: returnReason,
 [`${LOGISTICS_KEY}-condition`]: cabinetCondition,
 [`${LOGISTICS_KEY}-saved-txn`]: savedTxnNo
 };
 Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
 }, [cv, deliveryBy, deliveryDate, deliveryTime, workZone, note, notifier, notificationDate, returnReason, cabinetCondition, savedTxnNo, step, CART_KEY, TS_KEY]);

 useEffect(() => {
 getCustomers().then(setCustomers).catch(console.error);
 getZones().then(setZones).catch(console.error);
 }, []);

 const handleAddToCart = useCallback((item: MaterialItem, quantity: number, displayString: string, serialNumber?: string) => {
 setCart(prev => {
 // If S/N is provided, we treat it as a unique entry (don't merge quantities)
 if (!serialNumber) {
 const existingIdx = prev.findIndex(c => c.item.rowIndex === item.rowIndex && c.displayString === displayString && !c.serialNumber);
 if (existingIdx !== -1) {
 return prev.map((c, idx) => idx === existingIdx ? { ...c, quantity: c.quantity + quantity } : c);
 }
 }
 return [...prev, {
 id: Math.random().toString(36).substring(7),
 item, quantity, displayString, action,
 serialNumber,
 subItems: tempSubItems.length > 0 ? [...tempSubItems] : undefined,
 }];
 });
 setTempSubItems([]);
 }, [tempSubItems]);

 const handleAddSubItem = useCallback((item: MaterialItem, quantity: number, type: 'accessory' | 'sticker') => {
 let display = [item.ยี่ห้อหรือรูปแบบ, item.สภาพ, item.ขนาด, item.รายการ, item.รายละเอียด].filter(v => v !== '-').join(' ');
 setTempSubItems(prev => [...prev, { item, quantity, displayString: display, type }]);
 }, []);

 const handleRemoveSubItem = (idx: number) => setTempSubItems(prev => prev.filter((_, i) => i !== idx));

 const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

 const resetAll = () => {
 setCart([]); setNote(''); updateStep('form'); setCv(''); setDeliveryBy(''); setDeliveryDate(''); setDeliveryTime('00:00'); setWorkZone('');
 setNotifier(''); setNotificationDate(''); setReturnReason(''); setCabinetCondition(''); setSavedTxnNo('');

 // Robust cleanup of all persistence keys
 for (let i = 0; i < localStorage.length; i++) {
 const k = localStorage.key(i);
 if (k && (k.includes(LOGISTICS_KEY) || k.includes(CART_KEY))) {
 localStorage.removeItem(k);
 i--;
 }
 }
 setResetKey(Date.now());
 };

 const handleFinalSubmit = async () => {
 if (cart.length === 0) { setError('ไม่พบรายการในตะกร้า'); return; }

 setLoading(true); setError(null);
 try {
 const txnNo = await getNextTxnNo();
 setSavedTxnNo(txnNo);

const batchItems = cart.filter(c => c && c.item).flatMap(c => [
 { item: c.item, quantity: c.quantity, isSub: false, subType: '', serialNumber: c.serialNumber, assetTag: c.assetTag || c.asset_tag || c.serialNumber || '' },
 ...(c.subItems || []).map((s: any) => ({ item: s.item, quantity: s.quantity, isSub: true, subType: s.type }))
]);

 await processBatchTransaction({
 action,
 items: batchItems,
 cv,
 deliveryBy,
 deliveryDate: deliveryDate ?`${deliveryDate}T${deliveryTime}` : '',
 txnNo,
 operator: operatorName,
 note,
 workZone,
 notifier,
 notificationDate,
 returnReason,
 cabinetCondition
 });

 onSuccess();
 updateStep('success');
 } catch (err: any) {
 setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
 } finally {
 setLoading(false);
 }
 };

 const captureScreenshot = async () => {
 const element = document.getElementById('receive-receipt');
 if (!element) return;
 try {
 document.body.style.cursor = 'wait';
 const html2canvas = (await import('html2canvas')).default;
 element.scrollIntoView({ behavior: 'auto', block: 'start' });
 
 const canvas = await html2canvas(element, { 
 scale: 2, 
 useCORS: true, 
 backgroundColor: '#ffffff',
 onclone: (clonedDoc) => {
 const clonedEl = clonedDoc.getElementById('receive-receipt');
 if (clonedEl) {
 clonedEl.style.width = '600px';
 clonedEl.style.height = 'auto';
 clonedEl.style.animation = 'none';
 clonedEl.style.transition = 'none';
 clonedEl.querySelectorAll('*').forEach((subEl: any) => {
 subEl.style.animation = 'none';
 subEl.style.transition = 'none';
 subEl.style.opacity = '1';
 });
 }
 }
 });
 
 const image = canvas.toDataURL("image/png");
 const link = document.createElement('a');
 link.style.display = 'none';
 link.href = image;
 link.download =`ETE-RECEIVE-${savedTxnNo || Date.now()}.png`;
 
 document.body.appendChild(link);
 link.click();

 setTimeout(() => {
 document.body.removeChild(link);
 document.body.style.cursor = 'default';
 }, 100);
 } catch (err) { 
 console.error(err); 
 document.body.style.cursor = 'default';
 alert("ไม่สามารถบันทึกภาพได้ในขณะนี้ กรุณาลองแคปหน้าจอด้วยมือถือแทนครับ");
 }
 };

 // ==============================
 // ใบเสร็จรับเงิน (Standard Receipt - Lightweight)
 // ==============================
 if (step === 'success') return (
 <div className="mobile-page-frame max-w-3xl space-y-4 mb-10 text-center">
 <div id="receive-receipt" className="mobile-surface-card overflow-hidden relative">
 <div className="absolute top-6 left-6">
 <div className="bg-white/10 px-3 py-1 rounded-full border border-white/20">
 <span className="text-white text-[11px] font-black tracking-widest">{savedTxnNo || 'TXN-NEW'}</span>
 </div>
 </div>

 <div className="bg-emerald-600 px-6 py-8 text-white text-center">
 <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
 <Icon name="check_circle" size="md" className="text-white" />
 </div>
 <h2 className="mobile-form-hero-title text-white">บันทึกรับเข้าพัสดุสำเร็จ</h2>
 <p className="text-emerald-100 text-[12px] font-medium mt-1">บันทึกรายการเข้าคลังเรียบร้อยแล้ว</p>
 </div>

 <div className="p-6 space-y-4">
 <div className="grid grid-cols-2 gap-4 text-left border-b border-slate-50 pb-6">
 <div>
 <p className="text-[11px] font-semibold text-slate-500 tracking-tight">ผู้ทำรายการ</p>
 <p className="text-sm font-bold text-slate-900">{operatorName}</p>
 </div>
 <div>
 <p className="text-[11px] font-semibold text-slate-500 tracking-tight">วันที่ / เวลา</p>
 <p className="text-sm font-bold text-slate-900">
 {formatThaiDateTime(new Date())}
 </p>
 </div>
 </div>

 <div className="space-y-3">
 <p className="text-[12px] font-semibold text-slate-500 tracking-tight px-1 text-left">รายการพัสดุที่รับเข้า</p>
 {cart.map((c, i) => (
 <div key={i} className="bg-slate-50 px-4 py-3.5 rounded-xl border border-slate-100 flex justify-between items-center group">
 <div className="text-left flex-1 min-w-0 pr-3">
 <p className="text-[9px] font-bold text-emerald-500 uppercase leading-none mb-1">{c.item?.ประเภท || 'พัสดุ'}</p>
 <p className="text-[14px] font-black text-slate-900 leading-tight uppercase truncate">
 {[c.item?.ยี่ห้อหรือรูปแบบ, c.item?.สภาพ, c.item?.ขนาด, c.item?.รายการ, c.item?.รายละเอียด].filter(v => v && v !== '-').join(' ') || c.displayString || '-'}
 </p>
 </div>
 <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
 <span className="text-[14px] font-black text-emerald-600">x{c.quantity}</span>
 </div>
 </div>
 ))}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
 <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3 text-left border border-slate-100">
 <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
 <Icon name="local_shipping" size="sm" />
 </div>
 <div className="min-w-0">
 <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">นำส่ง / รับโดย</p>
 <p className="text-[12px] font-black text-slate-700 truncate">{deliveryBy || '-'}</p>
 </div>
 </div>
 <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3 text-left border border-slate-100">
 <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
 <Icon name="calendar_today" size="sm" />
 </div>
 <div className="min-w-0">
 <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">กำหนดวันที่</p>
 <p className="text-[12px] font-black text-slate-700 truncate">{deliveryDate ? formatThaiDateTime(`${deliveryDate}T${deliveryTime}`) : '-'}</p>
 </div>
 </div>
 </div>

 {note && (
 <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-100 flex items-start gap-3 text-left">
 <Icon name="edit_note" className="text-amber-500 !text-[20px] mt-0.5" />
 <p className="text-[13px] font-medium text-amber-800 italic leading-relaxed">"{note}"</p>
 </div>
 )}
 </div>
 </div>

 <div className="space-y-3 pt-2">
 <Button variant="secondary" size="lg" className="w-full" onClick={captureScreenshot} leftIcon="screenshot_region">
 Cap หน้าจอเก็บหลักฐาน
 </Button>
 <Button variant="primary" size="lg" className="w-full" onClick={resetAll}>ตกลง</Button>
 </div>
 </div>
 );

 return (
 <div className="mobile-page-frame max-w-3xl relative">
 {/* Global Screen Lock Overlay */}
 {loading && (
 <LoadingOverlay message="กำลังบันทึกรายการรับเข้าคลัง..." />
 )}

 <div className="mobile-surface-card overflow-hidden">
 <div className="mobile-form-hero text-center relative">
 <button
 onClick={resetAll}
 className="btn no-animation absolute top-4 right-4 w-10 h-10 bg-white/50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100/50"
 title="เคลียร์ข้อมูลทั้งหมด"
 >
 <span className="material-symbols-outlined text-[20px]">restart_alt</span>
 </button>
 <h2 className="mobile-form-hero-title text-emerald-900">รับพัสดุเข้าคลัง</h2>
 <p className="mobile-form-hero-subtitle mt-1 text-emerald-700">โหมดมาตรฐาน • พัสดุใหม่ / อะไหล่</p>
 </div>

 <Suspense fallback={<div className="p-6 text-center text-base-content/50 font-semibold"><span className="app-spinner-sm mr-2" aria-hidden="true"></span>กำลังโหลดรายการสินค้า...</div>}>
 <ItemSelector 
 key={`receive-picker-${resetKey}`}
 items={items} action={action} cart={cart} tempSubItems={tempSubItems}
 onAddToCart={handleAddToCart} onAddSubItem={handleAddSubItem} onRemoveSubItem={handleRemoveSubItem}
 onUpdateSubItemQty={() => {}}
 setError={setError} error={error}
 persistenceKey={LOGISTICS_KEY +"-picker"}
 warehouseId={warehouseId}
 />

 {cart.length > 0 && (
 <div className="bg-slate-50 border-t p-6 space-y-4">
 <div className="flex flex-col items-center">
 <h4 className="text-[14px] font-semibold text-slate-600 tracking-tight mb-1">รายการที่เลือก ({cart.length})</h4>
 <div className="w-10 h-0.5 bg-emerald-400 rounded-full opacity-30"></div>
 </div>
 <div className="space-y-3">
 {cart.map(c => (
 <div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
 <div className="flex items-center gap-4">
 <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-[13px] border border-emerald-100">x{c.quantity}</div>
 <div>
 <p className="text-[14px] font-black text-slate-900 uppercase leading-none mb-1">
 {c.item?.ประเภท} {c.displayString}
 </p>
 <div className="flex items-center gap-2 mt-1">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">ยี่ห้อ: {c.item?.ยี่ห้อหรือรูปแบบ || '-'}</p>
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">ขนาด: {c.item?.ขนาด || '-'}</p>
 {c.serialNumber && (
 <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">SN: {c.serialNumber}</span>
 )}
 </div>
 </div>
 </div>
 <button 
 title="ลบ" 
 onClick={() => removeFromCart(c.id)} 
 className="btn no-animation w-10 h-10 bg-rose-50 text-rose-500 rounded-xl border border-rose-100/50"
 >
 <span className="material-symbols-outlined text-[18px]">delete</span>
 </button>
 </div>
 ))}
 </div>

 <LogisticsSummary
 cart={cart} action="receive" cv={cv} setCv={setCv}
 deliveryBy={deliveryBy} setDeliveryBy={setDeliveryBy}
 deliveryDate={deliveryDate} setDeliveryDate={setDeliveryDate} deliveryTime={deliveryTime} setDeliveryTime={setDeliveryTime}
 workZone={workZone} setWorkZone={setWorkZone} note={note} setNote={setNote}
 onSuccess={onSuccess} setStep={updateStep}
 operatorName={operatorName} loading={loading}
 setLoading={setLoading} setError={setError} error={error} onEditCustomer={() => setIsCustomerModalOpen(true)}
 customers={customers} zones={zones} transactions={transactions}
 notifier={notifier} setNotifier={setNotifier}
 notificationDate={notificationDate} setNotificationDate={setNotificationDate}
 returnReason={returnReason} setReturnReason={setReturnReason}
 cabinetCondition={cabinetCondition} setCabinetCondition={setCabinetCondition}
 customSubmit={handleFinalSubmit}
 customSubmitText="บันทึกรับเข้าคลังทั้งหมด"
 warehouses={warehouses}
 warehouseId={warehouseId}
 setWarehouseId={setWarehouseId}
 />

 </div>
 )}

 {cart.length === 0 && (
 <div className="p-6 text-center text-slate-300">
 <Icon name="inventory_2" size="lg" className="mb-4 opacity-50 mx-auto" />
 <p className="font-bold text-xs uppercase tracking-widest leading-relaxed">ค้นหาพัสดุจากด้านบน<br />เพื่อเริ่มทำรายการรับเข้าครับ</p>
 </div>
 )}
 </Suspense>
 </div>

 <Suspense fallback={null}>
 <CustomerQuickEdit
 isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)}
 customer={customers.find(c => String(c.cv || c.CV || '') === cv) || { cv, name: '', phone: '', address: '', subdistrict: '', district: '', province: '', zipcode: '', lat: '', lng: '' }}
 onSave={async () => {
 const d = await getCustomers();
 setCustomers(d);
 }} thaiAddressData={thaiAddressData}
 customers={customers}
 />
 </Suspense>
 </div>
 );
}
