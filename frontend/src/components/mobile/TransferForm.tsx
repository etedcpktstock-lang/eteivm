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

interface TransferFormProps {
 items: MaterialItem[];
 onSuccess: () => void;
 operatorName: string;
 transactions?: any[];
 thaiAddressData?: any[];
 warehouses?: any[];
}

export default function TransferForm({ items, onSuccess, operatorName, transactions = [], thaiAddressData = [], warehouses = [] }: TransferFormProps) {

 const action = 'transfer';
 const CART_KEY =`ete-cart-${operatorName}-transfer`;
 const LOGISTICS_KEY =`ete-logistics-${operatorName}-transfer`;
 const TS_KEY =`ete-ts-${operatorName}-transfer`;

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
 const [deliveryBy, setDeliveryBy] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-deliveryBy`) || '');
 const [note, setNote] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-note`) || '');
 const [savedTxnNo, setSavedTxnNo] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-saved-txn`) || '');

 const [sourceWarehouseId, setSourceWarehouseId] = useState<number>(() => {
 const saved = localStorage.getItem(`${LOGISTICS_KEY}-sourceWh`);
 const parsed = saved ? parseInt(saved) : NaN;
 return !isNaN(parsed) ? parsed : (warehouses[0]?.id || 1);
 });

 const [destWarehouseId, setDestWarehouseId] = useState<number>(() => {
 const saved = localStorage.getItem(`${LOGISTICS_KEY}-destWh`);
 const parsed = saved ? parseInt(saved) : NaN;
 if (!isNaN(parsed)) return parsed;
 return warehouses.length > 1 ? warehouses[1].id : (warehouses[0]?.id || 1);
 });

 // Sync IDs when warehouses prop arrives/changes
 useEffect(() => {
 if (warehouses.length > 0) {
 const validSource = warehouses.some(w => w.id === sourceWarehouseId);
 const validDest = warehouses.some(w => w.id === destWarehouseId);

 if (!validSource) setSourceWarehouseId(warehouses[0].id);
 if (!validDest) {
 const fallbackDest = warehouses.length > 1 ? warehouses[1].id : warehouses[0].id;
 setDestWarehouseId(fallbackDest);
 }
 }
 }, [warehouses]);

 useEffect(() => {
 if (!isNaN(sourceWarehouseId)) localStorage.setItem(`${LOGISTICS_KEY}-sourceWh`, sourceWarehouseId.toString());
 if (!isNaN(destWarehouseId)) localStorage.setItem(`${LOGISTICS_KEY}-destWh`, destWarehouseId.toString());
 }, [sourceWarehouseId, destWarehouseId]);

 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [resetKey, setResetKey] = useState(Date.now());

 useEffect(() => {
 if (step === 'success') return;
 localStorage.setItem(CART_KEY, JSON.stringify(cart));
 }, [cart, step]);

 const handleAddToCart = useCallback((item: MaterialItem, quantity: number, displayString: string, serialNumber?: string) => {
 setCart(prev => {
 if (!serialNumber) {
 const existingIdx = prev.findIndex(c => c.item.rowIndex === item.rowIndex && c.displayString === displayString && !c.serialNumber);
 if (existingIdx !== -1) {
 return prev.map((c, idx) => idx === existingIdx ? { ...c, quantity: c.quantity + quantity } : c);
 }
 }
 return [...prev, {
 id: Math.random().toString(36).substring(7),
 item, quantity, displayString, action,
 serialNumber
 }];
 });
 }, []);

 const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

 const resetAll = () => {
 setCart([]); setNote(''); updateStep('form');
 localStorage.removeItem(`${LOGISTICS_KEY}-step`);
 setResetKey(Date.now());
 };

 const handleFinalSubmit = async () => {
 if (cart.length === 0) { setError('ไม่พบรายการในตะกร้า'); return; }
 if (sourceWarehouseId === destWarehouseId) { setError('คลังต้นทางและปลายทางต้องไม่เป็นคลังเดียวกัน'); return; }
 if (!deliveryBy.trim()) { setError('กรุณาระบุชื่อพนักงานขนส่ง'); return; }

 setLoading(true); setError(null);
 try {
 const txnNo = await getNextTxnNo();
 setSavedTxnNo(txnNo);

const batchItems = cart.filter(c => c && c.item).map(c => ({
 item: c.item,
 quantity: c.quantity,
 serialNumber: c.serialNumber,
 assetTag: c.assetTag || c.asset_tag || c.serialNumber || ''
}));

 await processBatchTransaction({
 action: 'transfer',
 items: batchItems,
 warehouseId: sourceWarehouseId,
 toWarehouseId: destWarehouseId,
 txnNo,
 operator: operatorName,
 note,
 deliveryBy
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
 const element = document.getElementById('transfer-receipt');
 if (!element) return;
 try {
 document.body.style.cursor = 'wait';
 const html2canvas = (await import('html2canvas')).default;
 const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
 canvas.toBlob((blob) => {
 if (!blob) throw new Error('Canvas to Blob failed');
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download =`ETE-TRANSFER-${savedTxnNo || Date.now()}.png`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
 }, 'image/png');
 } catch (err) {
 console.error('Screenshot failed:', err);
 } finally {
 document.body.style.cursor = 'default';
 }
 };

 if (step === 'success') return (
 <div className="mobile-page-frame max-w-2xl text-center space-y-6">
 <div className="flex flex-col items-center gap-4">
 <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center border-4 border-white">
 <span className="material-symbols-outlined text-[48px]">check_circle</span>
 </div>
 <div>
 <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">ย้ายพัสดุสำเร็จ</h2>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">Transfer Completed Successfully</p>
 </div>
 </div>

 <div id="transfer-receipt" className="mobile-surface-card p-6 space-y-6 text-left relative overflow-hidden">
 <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
 
 <div className="flex justify-between items-start border-b border-dashed border-slate-200 pb-6">
 <div>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">หมายเลขรายการ</p>
 <p className="text-[18px] font-black text-slate-900 mt-1 uppercase tracking-tighter">#{savedTxnNo || 'TXN-NEW'}</p>
 </div>
 <div className="text-right">
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">วันที่ดำเนินการ</p>
 <p className="text-[13px] font-bold text-slate-600 mt-1">{formatThaiDateTime(new Date())}</p>
 </div>
 </div>

 <div className="bg-slate-50/80 p-8 rounded-[2.5rem] border border-slate-100 mobile-row flex items-center justify-between gap-4 relative">
 <div className="text-center flex-1 space-y-2">
 <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto text-sky-500">
 <span className="material-symbols-outlined text-[20px]">logout</span>
 </div>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ต้นทาง</p>
 <p className="text-[16px] font-black text-slate-900 leading-tight">{warehouses.find(w => w.id === sourceWarehouseId)?.name || 'N/A'}</p>
 </div>

 <div className="flex flex-col items-center">
 <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center">
 <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
 </div>
 </div>

 <div className="text-center flex-1 space-y-2">
 <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto text-emerald-500">
 <span className="material-symbols-outlined text-[20px]">login</span>
 </div>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ปลายทาง</p>
 <p className="text-[16px] font-black text-slate-900 leading-tight">{warehouses.find(w => w.id === destWarehouseId)?.name || 'N/A'}</p>
 </div>
 </div>

 <div className="space-y-4">
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">รายละเอียดพัสดุ</p>
 <div className="space-y-2">
 {cart.map((c, i) => (
 <div key={i} className="flex justify-between items-center p-4 bg-white border border-slate-50 rounded-2xl">
 <div className="flex-1 pr-4">
 <p className="text-[14px] font-black text-slate-800 uppercase tracking-tight">
 {[c.item?.ประเภท, c.item?.ยี่ห้อหรือรูปแบบ, c.item?.รายการ].filter(Boolean).join(' ')}
 </p>
 <div className="flex items-center gap-2 mt-1">
 {c.item?.ขนาด && <span className="text-[9px] font-bold text-slate-400">ขนาด: {c.item.ขนาด}</span>}
 {c.item?.สภาพ && <span className="text-[9px] font-bold text-sky-500">สภาพ: {c.item.สภาพ}</span>}
 {c.serialNumber && <span className="text-[9px] font-black text-emerald-600">SN: {c.serialNumber}</span>}
 </div>
 </div>
 <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-900 border border-slate-100">
 {c.quantity}
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className="pt-8 border-t border-dashed border-slate-200 grid grid-cols-2 gap-8">
 <div>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ผู้ส่งมอบ / ขนส่ง</p>
 <p className="text-[14px] font-black text-sky-600 mt-1 uppercase">{deliveryBy || '-'}</p>
 </div>
 <div className="text-right">
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ผู้อนุมัติรายการ</p>
 <p className="text-[14px] font-black text-slate-900 mt-1 uppercase">{operatorName}</p>
 </div>
 {note && (
 <div className="col-span-2 pt-2">
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">หมายเหตุ</p>
 <p className="text-[12px] font-bold text-slate-600 mt-1 italic">"{note}"</p>
 </div>
 )}
 </div>

 <div className="flex justify-center pt-4">
 <div className="px-6 py-2 bg-slate-50 rounded-full border border-slate-200">
 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.5em]">ETE DC PHUKET • LOGISTICS TRANSFER SYSTEM</p>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <button 
 onClick={captureScreenshot} 
 className="btn no-animation h-14 bg-white text-slate-600 rounded-2xl font-black text-[12px] uppercase tracking-widest border-2 border-slate-100 flex items-center justify-center gap-3"
 >
 <span className="material-symbols-outlined">download</span> บันทึกรูปใบโอน
 </button>
 <button 
 onClick={resetAll} 
 className="btn no-animation h-14 bg-emerald-500 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-3"
 >
 <span className="material-symbols-outlined">restart_alt</span> ทำรายการใหม่
 </button>
 </div>
 </div>
 );

 return (
 <div className="mobile-page-frame max-w-4xl space-y-4 text-left">
 {loading && (
 <LoadingOverlay message="กำลังประมวลผลการย้ายพัสดุ..." />
 )}

 <div className="mobile-form-hero relative overflow-hidden">
 <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none rotate-12">
 <span className="material-symbols-outlined text-[120px] text-sky-600 font-black">swap_horiz</span>
 </div>

 <div className="flex items-center gap-4 relative z-10">
 <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-white border-4 border-white/40 rotate-3">
 <span className="material-symbols-outlined text-[32px]">swap_horiz</span>
 </div>
 <div>
 <h2 className="mobile-form-hero-title">ย้ายสินค้าระหว่างคลัง</h2>
 <div className="flex items-center gap-2 mt-2">
 <span className="mobile-chip">Stock Transfer System</span>
 <button onClick={resetAll} className="btn btn-ghost no-animation text-base-content/60 flex items-center gap-1 ml-1 border border-base-300 rounded-xl">
 <span className="material-symbols-outlined text-[14px]">refresh</span>
 <span className="text-[11px] font-semibold">รีเซ็ตฟอร์ม</span>
 </button>
 </div>
 </div>
 </div>
 </div>

 <div className="bg-white/40 rounded-[2.5rem] border border-white p-6 md:p-8 space-y-8">
 {/* Warehouse Selection Row */}
 <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8 bg-slate-50/50 p-6 rounded-xl border border-slate-100">
 <div className="space-y-3">
 <label className="text-[11px] font-black text-slate-400 ml-2 uppercase tracking-widest flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px] text-sky-500">logout</span> ต้นทาง (From)
 </label>
 <div className="relative group">
 <select 
 value={sourceWarehouseId} 
 onChange={(e) => { setSourceWarehouseId(parseInt(e.target.value)); setCart([]); }} 
 className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-6 font-black text-slate-800 outline-none focus:border-sky-500 cursor-pointer appearance-none"
 >
 {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
 </select>
 <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
 <span className="material-symbols-outlined">expand_more</span>
 </div>
 </div>
 </div>

 <div className="flex flex-col items-center justify-center">
 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 md:rotate-0 rotate-90">
 <span className="material-symbols-outlined text-[24px]">double_arrow</span>
 </div>
 </div>

 <div className="space-y-3">
 <label className="text-[11px] font-black text-slate-400 ml-2 uppercase tracking-widest flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px] text-emerald-500">login</span> ปลายทาง (To)
 </label>
 <div className="relative group">
 <select 
 value={destWarehouseId} 
 onChange={(e) => setDestWarehouseId(parseInt(e.target.value))} 
 className={`w-full h-14 bg-white border ${sourceWarehouseId === destWarehouseId ? 'border-rose-300 ' : 'border-slate-200'} rounded-2xl px-6 font-black text-slate-800 outline-none focus:border-sky-500 cursor-pointer appearance-none`}
 >
 {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
 </select>
 <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
 <span className="material-symbols-outlined">expand_more</span>
 </div>
 </div>
 </div>
 </div>

 {sourceWarehouseId === destWarehouseId && (
 <div className="bg-rose-50 text-rose-600 px-6 py-4 rounded-2xl border border-rose-100 text-[13px] font-black flex items-center gap-3 shake-in">
 <span className="material-symbols-outlined">warning</span>
 คลังต้นทางและปลายทางต้องไม่ซ้ำกัน
 </div>
 )}

 <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
 <Suspense fallback={<div className="p-6 text-center text-base-content/50 font-semibold space-y-3">
 <span className="app-spinner" aria-hidden="true"></span>
 <p>กำลังโหลดรายการสินค้า...</p>
 </div>}>
 <ItemSelector
 key={`transfer-picker-${resetKey}-${sourceWarehouseId}`}
 items={items} action={action} cart={cart} tempSubItems={[]}
 onAddToCart={handleAddToCart} onAddSubItem={() => { }} onRemoveSubItem={() => { }}
 onUpdateSubItemQty={() => { }}
 setError={setError} error={error}
 persistenceKey={LOGISTICS_KEY +"-picker"}
 warehouseId={sourceWarehouseId}
 />

 {cart.length > 0 && (
 <div className="p-6 md:p-8 bg-slate-50/50 border-t border-slate-100 space-y-8">
 <div className="space-y-4">
 <div className="mobile-row flex items-center justify-between px-2">
 <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px] text-sky-500">shopping_cart</span> รายการที่จะย้าย ({cart.length})
 </p>
 <button onClick={() => setCart([])} className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Clear All</button>
 </div>
 
 <div className="grid grid-cols-1 gap-3">
 {cart.map(c => (
 <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center group">
 <div className="flex-1 pr-4">
 <p className="font-black text-slate-900 text-[15px] uppercase tracking-tight line-clamp-1">{[c.item?.ประเภท, c.item?.ยี่ห้อหรือรูปแบบ, c.item?.รายการ].filter(Boolean).join(' ')}</p>
 <div className="flex items-center flex-wrap gap-2 mt-2">
 {c.item?.ขนาด && <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg uppercase font-black border border-slate-200">{c.item.ขนาด}</span>}
 {c.item?.สภาพ && <span className="text-[9px] bg-sky-50 text-sky-600 px-2 py-0.5 rounded-lg font-black border border-sky-100">{c.item.สภาพ}</span>}
 {c.serialNumber && <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg font-black border border-emerald-100">SN: {c.serialNumber}</span>}
 </div>
 </div>
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-[18px] font-black text-slate-900 border border-slate-100">
 {c.quantity}
 </div>
 <button onClick={() => removeFromCart(c.id)} className="w-10 h-10 text-slate-300 bg-slate-50 rounded-full flex items-center justify-center">
 <span className="material-symbols-outlined text-[20px]">delete</span>
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
 <div className="space-y-3">
 <label className="text-[11px] font-black text-slate-400 ml-2 uppercase tracking-widest flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px] text-sky-500">person</span> พนักงานขนส่ง <span className="text-rose-500 font-black">*</span>
 </label>
 <input
 type="text"
 value={deliveryBy}
 onChange={(e) => setDeliveryBy(e.target.value)}
 placeholder="ระบุชื่อผู้รับ/ผู้ส่ง..."
 className={`w-full h-14 bg-white border ${!deliveryBy.trim() && error === 'กรุณาระบุชื่อพนักงานขนส่ง' ? 'border-rose-400 ' : 'border-slate-200'} rounded-2xl px-6 font-black text-slate-800 outline-none focus:border-sky-500`}
 />
 </div>
 <div className="space-y-3">
 <label className="text-[11px] font-black text-slate-400 ml-2 uppercase tracking-widest flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px] text-slate-400">notes</span> หมายเหตุ
 </label>
 <input 
 type="text" 
 value={note} 
 onChange={(e) => setNote(e.target.value)} 
 placeholder="ระบุเหตุผลในการโอนย้าย..." 
 className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-6 font-black text-slate-800 outline-none focus:border-sky-500" 
 />
 </div>
 </div>

 {error && (
 <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl border border-rose-100 text-[13px] font-black text-center">
 {error}
 </div>
 )}

 <button 
 onClick={handleFinalSubmit} 
 disabled={loading || sourceWarehouseId === destWarehouseId || cart.length === 0} 
 className="btn no-animation w-full h-16 text-white rounded-2xl font-black text-[15px] uppercase tracking-[0.1em] disabled:opacity-30 flex items-center justify-center gap-4 group"
 >
 <span className="material-symbols-outlined">send</span>
 ยืนยันการทำรายการโอนย้าย
 </button>
 </div>
 )}
 </Suspense>
 </div>
 </div>
 </div>
 );
}
