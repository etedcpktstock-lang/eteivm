import React, { useState, useMemo } from 'react';
import { Truck, CheckCircle2, History, Camera, MapPin, ChevronLeft, Save, AlertCircle, Barcode } from 'lucide-react';
import { processBatchTransaction } from '../../api';
import { getCoordinates } from '../../utils/locationUtils';
import { formatItemName, calculateCustomerInventory } from '../../utils/logisticsUtils';
import { reconcileTransactions } from '../../utils/logisticsCore';

interface FulfillmentFormProps {
 job: any;
 operatorName: string;
 onSuccess: () => void;
 onBack: () => void;
 items?: any[];
 customers: any[];
 transactions: any[];
 jobs: any[];
}

const FulfillmentForm: React.FC<FulfillmentFormProps> = ({ 
 job, 
 operatorName, 
 onSuccess, 
 onBack, 
 items = [],
 customers = [],
 transactions = [],
 jobs: allJobs = []
}) => {
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [photos, setPhotos] = useState<File[]>([]);

 const [deliveryStatus, setDeliveryStatus] = useState<Record<string, boolean>>({});
 const [pickupData, setPickupData] = useState<Record<string, { condition: string; reason: string; serialNumber?: string; assetTag?: string }>>({});
 const [showConfirmModal, setShowConfirmModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

 // 📦 Customer Inventory Calculation (Persistent-prioritized)
 const customerInventory = useMemo(() => {
 const customer = customers.find(c => c.cv === (job.cv || job.CV));
 if (customer?.inventory) return customer.inventory;
 return calculateCustomerInventory(transactions, job.cv || job.CV, allJobs, items);
 }, [transactions, job.cv, job.CV, allJobs, items, customers]);

 const getInventoryQty = (item: any) => {
 const { main } = formatItemName(item);
 const normMain = main.replace(/[\s-]/g, '').toLowerCase();
 const size = String(item.ขนาด || '').replace(/[\s-]/g, '').toLowerCase();

 const match = customerInventory.find(inv => {
 const invMain = inv.name.replace(/[\s-]/g, '').toLowerCase();
 const invSize = String(inv.size || '').replace(/[\s-]/g, '').toLowerCase();

 // Match if names are similar (one contains another) and sizes match
 const nameMatches = invMain === normMain || invMain.includes(normMain) || normMain.includes(invMain);
 return nameMatches && invSize === size;
 });
 return match ? match.qty : 0;
 };

 // 🔥 ใช้ Core Logic ในการดึงรายการที่ยัง"ค้างอยู่"
 const { pendingItems } = useMemo(() => reconcileTransactions(job.items || []), [job.items]);

 const { deliveryItems, pickupItems } = useMemo(() => {
 return {
 deliveryItems: pendingItems.filter(p => p.category === 'SEND'),
 pickupItems: pendingItems.filter(p => p.category === 'RETURN')
 };
 }, [pendingItems]);



 const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files) {
 setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
 }
 };

 const resolveUnitAssetTag = (plan: any, index: number) => {
 const tagArray = Array.isArray(plan?.assetTags) ? plan.assetTags : (Array.isArray(plan?.asset_tags) ? plan.asset_tags : []);
 return String(tagArray[index] || plan?.assetTag || plan?.asset_tag || plan?.serialNumber || plan?.serial_number || '').trim();
 };

 const expandedDeliveryItems = useMemo(() => {
 return deliveryItems.flatMap(p => {
 const it = p.plan?.item || p.plan;
 const type = String(it.ประเภท || it.item_type || it.category || '').toLowerCase();
 const name = String(it.รายการ || it.item_name || '').toLowerCase();
 
 // Precise Freezer Detection: 
 // Must contain"ตู้" but NOT be an accessory like"กุญแจ" (Key) or"ตะกร้า" (Basket)
 const isAccessory = name.includes('กุญแจ') || name.includes('ตะกร้า') || name.includes('อะไหล่') || type.includes('อะไหล่') || type.includes('อุปกรณ์');
 const isFreezer = (type.includes('ตู้') || name.includes('ตู้')) && !isAccessory;
 
 if (isFreezer && p.remainingQty > 1) {
 // Freezers: expand into individual rows (1 per unit) for serial number tracking
 return Array.from({ length: p.remainingQty }).map((_, i) => ({
 ...p,
 remainingQty: 1,
 unitAssetTag: resolveUnitAssetTag(p.plan, i),
 uid:`${p.plan._internalId}_DEL_${i}`,
 displayIdx: i + 1
 }));
 }
 // Non-freezers: keep as single row with full quantity
 return [{ ...p, unitAssetTag: resolveUnitAssetTag(p.plan, 0), uid:`${p.plan._internalId}_DEL_AGG`, displayIdx: 1 }];
 });
 }, [deliveryItems]);

 const expandedPickupItems = useMemo(() => {
 return pickupItems.flatMap(p => {
 const it = p.plan?.item || p.plan;
 const type = String(it.ประเภท || it.item_type || it.category || '').toLowerCase();
 const name = String(it.รายการ || it.item_name || '').toLowerCase();
 
 const isAccessory = name.includes('กุญแจ') || name.includes('ตะกร้า') || name.includes('อะไหล่') || type.includes('อะไหล่') || type.includes('อุปกรณ์');
 const isFreezer = (type.includes('ตู้') || name.includes('ตู้')) && !isAccessory;
 
 if (isFreezer && p.remainingQty > 1) {
 return Array.from({ length: p.remainingQty }).map((_, i) => ({
 ...p,
 remainingQty: 1,
 uid:`${p.plan._internalId}_PICK_${i}`,
 displayIdx: i + 1
 }));
 }
 return [{ ...p, uid:`${p.plan._internalId}_PICK_AGG`, displayIdx: 1 }];
 });
 }, [pickupItems]);

 const isComplete = useMemo(() => {
 // ต้องกดยืนยันทุกเครื่องที่โชว์บนหน้าจอ
 const allDeliveryConfirmed = expandedDeliveryItems.every(p => !!deliveryStatus[p.uid]);
 const allPickupConditionsSelected = expandedPickupItems.every(p => !!pickupData[p.uid]?.condition);
 
 // ต้องมีอย่างน้อย 1 รายการ หรือถ้ามีรายการต้องทำให้ครบ
 const hasItems = expandedDeliveryItems.length > 0 || expandedPickupItems.length > 0;
 
 return hasItems && allDeliveryConfirmed && allPickupConditionsSelected;
 }, [expandedDeliveryItems, expandedPickupItems, deliveryStatus, pickupData]);

 const handleSave = async (_force = false) => {
 setLoading(true);
 setError(null);
 try {
 const coords = await getCoordinates();

 // สร้าง Payload ตาม TransactionResult interface โดยแยก 1 ชิ้นต่อ 1 record
 const batchItems = [
 ...expandedDeliveryItems.map(p => ({
 ...p.plan,
 item: p.plan.item || p.plan,
 quantity: p.remainingQty, // ส่งจำนวนตามจริง (ตู้แช่=1, อุปกรณ์=จำนวนรวม)
 จำนวน: p.remainingQty,
 status: deliveryStatus[p.uid] ? 'ส่งมอบเรียบร้อย' : 'อยู่ระหว่างดำเนินการ',
 cabinetCondition: 'ปกติ', // Default conditioning for delivery
 serialNumber: p.unitAssetTag || p.plan.serialNumber || p.plan.serial_number || '',
 assetTag: p.unitAssetTag || p.plan.assetTag || p.plan.asset_tag || '',
 assetTags: p.unitAssetTag ? [p.unitAssetTag] : (Array.isArray(p.plan.assetTags) ? p.plan.assetTags : (Array.isArray(p.plan.asset_tags) ? p.plan.asset_tags : []))
 })),
...expandedPickupItems.map(p => ({
...p.plan,
item: p.plan.item || p.plan,
quantity: p.remainingQty,
จำนวน: p.remainingQty,
// สำคัญ: fulfill รับคืนจากร้าน = Customer -> Transit
// ห้ามส่ง status เป็น "รอตรวจ" ในขั้นนี้ เพราะ backend จะตีความเป็น Return-to-Base (Transit -> Quarantine)
status: 'รับคืนจากร้าน',
cabinetCondition: pickupData[p.uid]?.condition || 'ปกติ',
returnReason: pickupData[p.uid]?.reason || '',
serialNumber: pickupData[p.uid]?.serialNumber || '',
assetTag: pickupData[p.uid]?.assetTag || pickupData[p.uid]?.serialNumber || ''
}))

 ];

const safeCv = String(job.cv || job.CV || job.customer_cv || '').trim();
if (!safeCv) {
throw new Error('กรุณาระบุ CV ลูกค้าก่อนบันทึกรายการ');
}

const res = await processBatchTransaction({
action: 'fulfill',
jobId: job.jobId,
items: batchItems,
cv: safeCv,
warehouseId: Number(job.warehouseId || job.warehouse_id || 1),
lat: coords?.lat?.toString(),
lng: coords?.lng?.toString(),
operator: operatorName,
status: pickupItems.length > 0 ? 'รับคืนจากร้าน - กำลังเดินทางกลับ' : 'ส่งมอบงานสำเร็จเรียบร้อย'
});
 
 if (res.status === 'success') {
 onSuccess();
 } else {
 setError(res.message || 'บันทึกไม่สำเร็จ');
 setLoading(false);
 }
 } catch (err: any) {
 console.error("Save error:", err);
 setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
 setLoading(false);
 }
 };

 return (
 <div className="mobile-app-shell pb-24">
 <div className="mobile-app-header sticky top-0 z-50 border-b border-base-300 mobile-row flex items-center justify-between">
 <button onClick={onBack} className="btn no-animation w-10 h-10 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-slate-400">
 <ChevronLeft size={20} />
 </button>
 <div className="text-center flex-1">
 <h2 className="mobile-form-hero-title">ยืนยันการดำเนินงาน</h2>
 <p className="mobile-chip mt-2 inline-flex">#{job.jobId}</p>
 </div>
 <div className="w-10 h-10" />
 </div>

 <div className="p-4 space-y-4">
 <div className="mobile-surface-card p-5 relative overflow-hidden group">
 <div className="flex items-center gap-4 relative z-10">
 <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
 <MapPin size={24} />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="text-lg font-black text-slate-900 leading-tight uppercase truncate">{job.customerName || job.cv}</h3>
 <p className="text-[11px] font-bold text-slate-400 mt-1 line-clamp-1 italic">{job.address || 'ไม่มีข้อมูลที่อยู่'}</p>
 </div>
 </div>
 </div>

 {/* 🚚 Section 1: Delivery Confirmation */}
 {expandedDeliveryItems.length > 0 && (
 <div className="space-y-4">
 <div className="flex items-center gap-2 px-2">
 <Truck size={18} className="text-indigo-600" />
 <h4 className="text-[13px] font-semibold text-slate-600 tracking-tight">รายการส่งมอบ</h4>
 </div>
 <div className="space-y-4">
 {expandedDeliveryItems.map(p => {
 const it = p.plan;
 const _id = p.uid;
 const fullItem = items.find(m => Number(m.id) === Number(it.rowIndex || it.item_id));
 const displayItem = fullItem ? { ...fullItem, ...it } : it;
 const { main, meta } = formatItemName(displayItem);

 return (
 <div key={_id} className="bg-white/80 border border-white rounded-3xl p-5 mobile-row flex items-center justify-between group active:bg-slate-50">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 font-black text-xs border border-slate-100">
 {p.remainingQty > 1 ? p.remainingQty : p.displayIdx}
 </div>
 <div>
 <h4 className="text-[14px] font-bold text-slate-800 leading-none">{formatItemName(displayItem, { hideCondition: false }).main}</h4>
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{meta}</p>
 </div>
 </div>
 <button
 onClick={() => setDeliveryStatus(prev => ({ ...prev, [_id]: !prev[_id] }))}
 className={`h-11 px-4 rounded-xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest ${deliveryStatus[_id]
 ? 'bg-emerald-500 text-white '
 : 'bg-white text-slate-400 border border-slate-100 '
 }`}
 >
 {deliveryStatus[_id] ? <CheckCircle2 size={16} /> : null}
 <span>{deliveryStatus[_id] ? 'ส่งแล้ว' : 'ยืนยัน'}</span>
 </button>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* ↩️ Section 2: Pickup/Return Control */}
 {expandedPickupItems.length > 0 && (
 <div className="space-y-4">
 <div className="flex items-center gap-2 px-2">
 <History size={18} className="text-purple-600" />
 <h4 className="text-[13px] font-semibold text-slate-600 tracking-tight">รายการรับคืน</h4>
 </div>
 <div className="space-y-4">
 {expandedPickupItems.map((p, itemIdx) => {
 const it = p.plan;
 const _id = p.uid;
 const fullItem = items.find(m => Number(m.id) === Number(it.rowIndex || it.item_id));
 const displayItem = fullItem ? { ...fullItem, ...it } : it;
 const { main, meta } = formatItemName(displayItem, { hideCondition: true });

 return (
 <div key={_id} className="bg-white/80 border border-white rounded-[2.5rem] p-6 space-y-4">
 <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
 <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-black text-lg">
 {p.remainingQty > 1 ? p.remainingQty : p.displayIdx}
 </div>
 <div className="min-w-0 pr-4">
 <p className="text-[15px] font-black text-slate-900 leading-tight uppercase truncate">{main} {(p.remainingQty === 1 && p.displayIdx) ?`(#${p.displayIdx})` : ''}</p>
 <div className="flex items-center gap-2 mt-0.5">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{meta}</p>
 {(() => {
 const invQty = getInventoryQty(it);
 if (invQty < p.remainingQty) {
 return (
 <span className="flex items-center gap-1 bg-rose-50 text-rose-500 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-rose-100">
 <AlertCircle size={8} /> {invQty > 0 ?`มีเพียง ${invQty} ในครอบครอง` : 'ไม่พบในครอบครอง'}
 </span>
 );
 }
 return (
 <span className="flex items-center gap-1 bg-emerald-50 text-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-emerald-100">
 <CheckCircle2 size={8} /> ยืนยันในครอบครอง ({invQty})
 </span>
 );
 })()}
 </div>
 </div>
 </div>

 <div className="space-y-4">
 <div className="space-y-3">
 <div className="flex items-center gap-2 px-1">
 <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
 <span className="text-[11px] font-bold text-slate-500">
 ร่องรอยการคืน: <span className="text-indigo-600 font-extrabold">{pickupData[_id]?.condition || 'ยังไม่ได้ระบุ'}</span>
 </span>
 </div>
 <div className="grid grid-cols-2 gap-2">
 {[
 { id: 'ปกติ', label: 'ปกติ', color: 'emerald' },
 { id: 'ส่งซ่อม', label: 'ส่งซ่อม', color: 'indigo' },
 { id: 'เสียหายหนัก', label: 'เสียหายหนัก', color: 'slate' },
 { id: 'สูญหาย', label: 'สูญหาย', color: 'rose' }
 ].map(cond => (
 <button
 key={cond.id}
 onClick={() => setPickupData(prev => ({ ...prev, [_id]: { ...(prev[_id] || { reason: '', serialNumber: '', assetTag: '' }), condition: cond.id } }))}
 className={`py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border ${pickupData[_id]?.condition === cond.id
 ? 'bg-slate-900 text-white border-slate-900 '
 : 'bg-white text-slate-400 border-slate-100 '
 }`}
 >
 {cond.label}
 </button>
 ))}
 </div>
 </div>

 {(displayItem.รายการ?.includes('ตู้แช่') || displayItem.ประเภท?.includes('ตู้แช่')) && (
 <div className="space-y-2">
 <label className="text-[11px] font-semibold text-slate-500 tracking-tight ml-1">รหัสเครื่องสำหรับตู้แช่</label>
 <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
 <div className="space-y-1">
 <span className="text-[10px] font-bold text-slate-400 ml-1">Serial Number (S/N)</span>
 <input
 type="text"
 className="w-full h-11 bg-white border border-slate-200 rounded-full px-5 text-[13px] font-bold text-slate-700 outline-none focus:border-indigo-200"
 placeholder="ระบุ S/N..."
 value={pickupData[_id]?.serialNumber || ''}
 onChange={(e) => setPickupData(prev => ({
 ...prev,
 [_id]: {
 condition: 'ปกติ',
 reason: '',
 ...(prev[_id] || {}),
 serialNumber: e.target.value
 }
 }))}
 />
 </div>
 <div className="space-y-1">
 <span className="text-[10px] font-bold text-slate-400 ml-1">Asset Tag</span>
 <input
 type="text"
 className="w-full h-11 bg-white border border-slate-200 rounded-full px-5 text-[13px] font-bold text-slate-700 outline-none focus:border-indigo-200"
 placeholder="ระบุ Asset Tag..."
 value={pickupData[_id]?.assetTag || ''}
 onChange={(e) => setPickupData(prev => ({
 ...prev,
 [_id]: {
 condition: 'ปกติ',
 reason: '',
 ...(prev[_id] || {}),
 assetTag: e.target.value
 }
 }))}
 />
 </div>
 <button
 className="btn no-animation h-11 w-full sm:w-11 bg-slate-900 rounded-full flex items-center justify-center text-white"
 onClick={() => {
 const mockScan = prompt('สแกน S/N หรือ Asset Tag (Barcode/QR):');
 if (mockScan) {
 setPickupData(prev => ({
 ...prev,
 [_id]: {
 condition: 'ปกติ',
 reason: '',
 ...(prev[_id] || {}),
 serialNumber: prev[_id]?.serialNumber || mockScan,
 assetTag: prev[_id]?.assetTag || mockScan
 }
 }));
 }
 }}
 >
 <Barcode size={16} />
 </button>
 </div>
 <p className="text-[10px] text-slate-400 ml-1">ถ้ามีรหัสเดียว กรอกช่องใดช่องหนึ่งได้ ระบบยังส่ง payload แบบเดิม</p>
 </div>
 )}

 <div className="space-y-1.5">
 <label className="text-[11px] font-semibold text-slate-500 tracking-tight ml-1">รายละเอียดเพิ่มเติม (ถ้ามี)</label>
 <textarea
 className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[13px] font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-200 resize-none"
 placeholder="ระบุเพิ่มเติม..."
 rows={2}
 value={pickupData[_id]?.reason || ''}
 onChange={(e) => setPickupData(prev => ({
 ...prev,
 [_id]: {
 condition: 'ปกติ',
 serialNumber: '',
 assetTag: '',
 ...(prev[_id] || {}),
 reason: e.target.value
 }
 }))}
 />
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* 📸 Evidence Section */}
 <div className="space-y-4">
 <div className="flex items-center gap-2 px-2">
 <Camera size={18} className="text-slate-400" />
 <h4 className="text-[13px] font-semibold text-slate-600 tracking-tight">หลักฐานการดำเนินงาน</h4>
 </div>
 <div className="grid grid-cols-4 gap-3">
 {photos.map((p, i) => (
 <div key={i} className="aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
 <img src={URL.createObjectURL(p)} alt="proof" className="w-full h-full object-cover" />
 </div>
 ))}
 <label className="aspect-square bg-white border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300 cursor-pointer">
 <Camera size={24} className="mb-1" />
 <span className="text-[10px] font-semibold tracking-tight">เพิ่มรูป</span>
 <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
 </label>
 </div>
 </div>

 {error && (
 <div className="bg-rose-50 border border-rose-100 p-4 rounded-3xl flex items-start gap-3">
 <AlertCircle className="text-rose-500 shrink-0" size={20} />
 <p className="text-[12px] font-bold text-rose-600 leading-snug">{error}</p>
 </div>
 )}
 </div>

 {/* 🔘 Float Bottom Action */}
 <div className="fixed bottom-6 left-4 right-4 z-50">
 <button
 onClick={() => handleSave()}
 disabled={loading || !isComplete}
 className={`btn no-animation w-full h-14 rounded-xl ${loading || !isComplete ? 'btn-disabled opacity-70' : 'btn-primary text-white'} flex items-center justify-center gap-3 font-semibold text-[14px]`}
 >
 {loading ? (
 <span className="app-spinner-sm" aria-hidden="true"></span>
 ) : (
 <Save size={18} />
 )}
 <span>{loading ? 'กำลังบันทึก...' : 'บันทึกและปิดงาน'}</span>
 </button>
 </div>

 {/* ⚠️ Confirmation Modal for Mismatched Data */}
 {showConfirmModal.isOpen && (
 <div className="fixed inset-0 z-[100] bg-slate-900/40 flex items-center justify-center p-6 fade-in">
 <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full zoom-in-95 border border-slate-100">
 <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-6 border border-amber-100 group overflow-hidden">
 <AlertCircle size={32} className="" />
 </div>
 <h3 className="text-xl font-bold text-slate-800 leading-tight">ยืนยันข้อมูลไม่ตรงกัน</h3>
 <p className="text-slate-500 text-sm font-bold mt-3 mb-8 leading-relaxed">
 {showConfirmModal.message}
 </p>
 <div className="flex gap-3">
 <button
 onClick={() => setShowConfirmModal({ isOpen: false, message: '' })}
 className="btn no-animation flex-1 h-14 bg-slate-100 text-slate-500 font-semibold text-[13px] rounded-xl"
 >
 ยกเลิก
 </button>
 <button
 onClick={() => {
 setShowConfirmModal({ isOpen: false, message: '' });
 handleSave(true);
 }}
 className="btn no-animation flex-[1.5] h-14 btn-warning text-white font-semibold text-[13px] rounded-xl"
 >
 บันทึกทั้งที่ไม่ตรง
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default FulfillmentForm;
