import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
 Package, Wrench, Search, CheckCircle2, AlertCircle, 
 Trash2, ShieldCheck, ShoppingBag, FileSearch, RefreshCw, 
 ChevronRight, Box, History, Clock
} from 'lucide-react';
import { API_URL, safeFetch } from '../../api';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import type { MaterialItem, Transaction } from '../../types';
import { ImageLightbox } from '../shared/CommonUI';

interface RepairManagementProps {
 items: MaterialItem[];
 transactions: Transaction[];
 onSuccess?: () => void;
 operatorName?: string;
 customers?: any[];
 loading?: boolean;
 onClose?: () => void;
}

type ManagementTab = 'quarantine' | 'repair' | 'scrap' | 'lost';

const RepairManagement: React.FC<RepairManagementProps> = ({ 
 items = [], 
 transactions = [], 
 onSuccess, 
 operatorName = 'System',
 customers = [],
 loading: externalLoading
}) => {
 const [activeTab, setActiveTab] = useState<ManagementTab>('quarantine');
 const [searchTerm, setSearchTerm] = useState('');
 const [localLoading, setLocalLoading] = useState<string | null>(null);
 const [confirmDialog, setConfirmDialog] = useState<any>(null);
 const [removedItems, setRemovedItems] = useState<string[]>([]);
 const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

 // รีเซ็ตสถานะการซ่อนเมื่อข้อมูลชุดใหม่มา (เช่น หลัง Refresh)
 useEffect(() => {
 setRemovedItems([]);
 }, [items, transactions]);

 // --- Logic ประมวลผลข้อมูล ---
 
 // 1. หาธุรกรรมล่าสุดของพัสดุแต่ละชิ้นในแต่ละใบงาน (ป้องกันข้อมูลค้างจากประวัติเก่า)
 const latestTxns = useMemo(() => {
 const map: Record<string, Transaction> = {};
 const unmapped: Transaction[] = []; // Items without precise physical IDs

 if (!Array.isArray(transactions)) return [];

 transactions.forEach(t => {
 const jobId = t.job_id || t.jobId || 'NO_JOB';
 
 // If it has an explicit tracking ID (SN), we can track its state progression
 if (t.serial_number && String(t.serial_number).trim() !== '') {
 const key =`${jobId}-${t.item_id}-SN_${t.serial_number}`;
 if (!map[key]) map[key] = t; // Keep the latest status
 } 
 // If no SN but explicitly linked to a slot (legacy or future compatibility)
 else if (t.rowIndex) {
 const key =`${jobId}-${t.item_id}-ROW_${t.rowIndex}`;
 if (!map[key]) map[key] = t;
 }
 // Anonymous batches (e.g.,askets, or unresolved freezers). We can't track state progression reliably,
 // so we evaluate each transaction independently.
 else {
 unmapped.push(t);
 }
 });

 return [...Object.values(map), ...unmapped];
 }, [transactions]);

 // 2. จัดกลุ่มตาม Job ID และกรองตาม Tab
 const groupedTasks = useMemo(() => {
 const groups: Record<string, any> = {};
 const hasOfficeReturnByJobItem = new Set<string>();
 latestTxns.forEach(t => {
 if (!t) return;
 const statusStr = String(t.action_type || t.status || t.สถานะ || '').toLowerCase();
 if (statusStr.includes('รอตรวจ') || statusStr.includes('quarantine')) {
 const jobId = String(t.job_id || t.jobId || 'NO_JOB');
 const itemId = String(t.item_id || t.rowIndex || 'NO_ITEM');
 hasOfficeReturnByJobItem.add(`${jobId}-${itemId}`);
 }
 });
 
 // We must expand Freezers (ตู้) that were grouped into qty > 1 
 // so they can be inspected one by one!
 const expandedTxns: any[] = [];
 latestTxns.forEach(t => {
 if (!t) return;
 const statusStr = String(t.action_type || t.status || t.สถานะ || '').toLowerCase();
 const jobId = String(t.job_id || t.jobId || 'NO_JOB');
 const itemId = String(t.item_id || t.rowIndex || 'NO_ITEM');
 // For anonymous batch returns, hide the earlier pickup row once the same job/item has reached office inspection.
 if (statusStr.includes('รับคืน') && hasOfficeReturnByJobItem.has(`${jobId}-${itemId}`)) return;
 const qty = Number(t.จำนวน || t.quantity || 1);
 const isFreezer = String(t.รายการ || '').includes('ตู้') || String(t.ประเภท || '').includes('ตู้');
 
 if (isFreezer && qty > 1) {
 for (let i = 0; i < qty; i++) {
 expandedTxns.push({ ...t, จำนวน: 1, quantity: 1, _splitIndex: i });
 }
 } else {
 expandedTxns.push(t);
 }
 });
 
 expandedTxns.forEach(t => {
 if (!t) return;
 
 const statusStr = String(t.action_type || t.status || t.สถานะ || '').toLowerCase();
 const cabStatus = String(t.cabinet_status || t['สภาพตู้'] || '').toLowerCase();
 
 // Filter out outgoing transactions ( fulfillment)
 if (statusStr.includes('(out)')) return;

 const isInspected = statusStr.includes('ตรวจสอบแล้ว') || statusStr.includes('อนุมัติ') || statusStr.includes('checked');
 
 // Tab matching logic
 let matchTab = false;
 if (activeTab === 'quarantine') {
 const isQuarantineStrict = statusStr.includes('รับคืน') || statusStr.includes('รอตรวจ') || statusStr.includes('quarantine');
 matchTab = !isInspected && isQuarantineStrict;
 } else if (isInspected) {
 // Exclude transactions that indicate the process is already COMPLETED (e.g. 'ซ่อมเสร็จ', 'ปกติ', 'out')
 const isProcessDone = statusStr.includes('ซ่อมเสร็จ') || statusStr.includes('ปกติ') || 
 statusStr.includes('(out)') || statusStr.includes('ยกเลิก');
 
 if (!isProcessDone) {
 if (activeTab === 'repair') {
 matchTab = (cabStatus.includes('เสีย') || cabStatus.includes('ซ่อม') || cabStatus.includes('repair')) && !cabStatus.includes('จำหน่าย');
 } else if (activeTab === 'scrap') {
 matchTab = cabStatus.includes('ซาก') || cabStatus.includes('scrap') || cabStatus.includes('จำหน่าย');
 } else if (activeTab === 'lost') {
 matchTab = cabStatus.includes('หาย') || cabStatus.includes('lost');
 }
 }
 }

 if (!matchTab) return;

 const jobId = String(t.job_id || t.jobId ||"NO_ID");
 
 if (!groups[jobId]) {
 const cv = t.CV || t.customer_cv || t.cv || '';
 const custFound = Array.isArray(customers) ? customers.find(c => c.cv === cv || c.rowIndex === cv) : null;
 
 groups[jobId] = {
 jobId,
 customer: custFound?.name || t.customer_name || cv ||"งานรับคืนพัสดุ",
 customerCv: cv,
 customerPhone: custFound?.phone || '',
 customerAddress: custFound ?`${custFound.address || ''} ${custFound.subdistrict || ''} ${custFound.district || ''} ${custFound.province || ''} ${custFound.zipcode || ''}`.trim() : '',
 customerLat: custFound?.lat,
 customerLng: custFound?.lng,
 operator: t.ผู้ทำรายการ || t.delivery_by || 'Unknown',
 notifier: t.ผู้แจ้ง || 'System',
 date: t['วัน-เวลา'] || t.created_at || new Date().toISOString(),
 appointment: t.เวลานัดหมาย || t['เวลานัดหมาย'] || '',
 itemMap: {} // Use map for internal aggregation
 };
 }

 // Aggregate by physical distinctness
 const isFreezer = String(t.รายการ || '').includes('ตู้') || String(t.ประเภท || '').includes('ตู้') || (t.serial_number && String(t.serial_number).trim() !== '');

 // Key Generation: 
 // - Freezers with Serial Numbers: Unique by SN
 // - Others: Aggregated by Item ID + Status + Cabinet Status
 let aggKey = isFreezer 
 ?`${t.item_id}-${t.serial_number || t.rowIndex || t.id || 'NO_ID'}`
 :`${t.item_id}-${statusStr}-${cabStatus}`;

 if (t._splitIndex !== undefined) {
 aggKey +=`-SPLIT-${t._splitIndex}`; // Perfectly isolate expanded units if they were already split
 }

 const exactKey =`job-${jobId}-item-${aggKey}`;
 if (removedItems.includes(exactKey)) return;

 if (!groups[jobId].itemMap[aggKey]) {
 let mItem = items.find(it => String(it.id || (it as any).rowIndex) === String(t.item_id));
 if (!mItem) {
 mItem = items.find(it => 
 (it.รายการ === t.รายการ) && 
 (it.ยี่ห้อหรือรูปแบบ === t['ยี่ห้อ/รูปแบบ']) && 
 (it.ขนาด === t.ขนาด)
 );
 }

 // --- PRECISE NAME FORMATTING ---
 const category = (mItem?.ประเภท || t.ประเภท || '').trim();
 const brand = (t['ยี่ห้อ/รูปแบบ'] || mItem?.ยี่ห้อหรือรูปแบบ || '').trim();
 const itemName = (t.รายการ || mItem?.รายการ || '').trim();
 
 // Build"Complete" name: [Category] Brand Name
 const fullNameParts = [];
 if (category) fullNameParts.push(`[${category}]`);
 if (brand && brand !== '-') fullNameParts.push(brand);
 if (itemName && itemName !== '-') fullNameParts.push(itemName);
 
 groups[jobId].itemMap[aggKey] = {
 id: mItem?.id || t.item_id,
 displayName: fullNameParts.join(' ') || 'พัสดุ',
 displayDetails: (t.ขนาด || mItem?.ขนาด || '').trim(),
 qty: 0,
 txnIds: [],
 serial: isFreezer ? t.serial_number : null,
 riderNote: t.cabinet_status || t['สภาพตู้'] || t.note || '',
 photos: t['รูปภาพประกอบ'] || t.image_url || '',
 key: exactKey,
 status: statusStr,
 cabStatus: cabStatus
 };
 }

 // Add to aggregate
 const txnQty = Number(t.จำนวน || t.quantity || 1);
 groups[jobId].itemMap[aggKey].qty += txnQty;
 groups[jobId].itemMap[aggKey].txnIds.push(t.id);
 
 // Keep note/photos from latest if multiple
 if (t['รูปภาพประกอบ'] || t.image_url) {
 groups[jobId].itemMap[aggKey].photos = t['รูปภาพประกอบ'] || t.image_url;
 }
 if (t.note) {
 groups[jobId].itemMap[aggKey].riderNote = t.note;
 }
 });

 return Object.values(groups).map(g => {
 const aggregatedItems = Object.values(g.itemMap);
 
 const filtered = aggregatedItems.filter((it: any) => 
 it.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
 String(it.serial).toLowerCase().includes(searchTerm.toLowerCase()) ||
 g.jobId.toLowerCase().includes(searchTerm.toLowerCase())
 );

 const allPhotosSet = new Set<string>();
 aggregatedItems.forEach((it: any) => {
 if (it.photos) {
 it.photos.split('\n').filter(Boolean).forEach((url: string) => allPhotosSet.add(url.trim()));
 }
 });
 
 return { ...g, items: filtered, allPhotos: Array.from(allPhotosSet).join('\n') };
 }).filter(g => g.items.length > 0)
 .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

 }, [transactions, items, activeTab, searchTerm, removedItems]);

 // 3. คำนวณตัวเลขสถิติบน Badge
 const stats = useMemo(() => {
 const s = { quarantine: 0, repair: 0, scrap: 0, lost: 0 };
 if (!Array.isArray(latestTxns)) return s;
 const hasOfficeReturnByJobItem = new Set<string>();
 latestTxns.forEach(t => {
 if (!t) return;
 const statusStr = String(t.action_type || t.status || t.สถานะ || '').toLowerCase();
 if (statusStr.includes('รอตรวจ') || statusStr.includes('quarantine')) {
 const jobId = String(t.job_id || t.jobId || 'NO_JOB');
 const itemId = String(t.item_id || t.rowIndex || 'NO_ITEM');
 hasOfficeReturnByJobItem.add(`${jobId}-${itemId}`);
 }
 });

 // We must ensure that a transaction with qty=2 increments the badge by 2!
 latestTxns.forEach(t => {
 if (!t) return;
 const qty = Number(t.จำนวน || t.quantity || 1);
 const statusStr = String(t.action_type || t.status || t.สถานะ || '').toLowerCase();
 const jobId = String(t.job_id || t.jobId || 'NO_JOB');
 const itemId = String(t.item_id || t.rowIndex || 'NO_ITEM');
 if (statusStr.includes('รับคืน') && hasOfficeReturnByJobItem.has(`${jobId}-${itemId}`)) return;
 const cabStatus = String(t.cabinet_status || t['สภาพตู้'] || '').toLowerCase();
 if (statusStr.includes('(out)')) return;

 const isInspected = statusStr.includes('ตรวจสอบแล้ว') || statusStr.includes('อนุมัติ') || statusStr.includes('checked');
 
 if (!isInspected) {
 const isQuarantineStrict = statusStr.includes('รับคืน') || statusStr.includes('รอตรวจ');
 if (isQuarantineStrict) {
 s.quarantine += qty;
 }
 } else {
 const isProcessDone = statusStr.includes('ซ่อมเสร็จ') || statusStr.includes('ปกติ') || 
 statusStr.includes('(out)') || statusStr.includes('ยกเลิก');
 
 if (!isProcessDone) {
 if ((cabStatus.includes('เสีย') || cabStatus.includes('ซ่อม')) && !cabStatus.includes('จำหน่าย')) {
 s.repair += qty;
 } else if (cabStatus.includes('ซาก')) {
 s.scrap += qty;
 } else if (cabStatus.includes('หาย')) {
 s.lost += qty;
 }
 }
 }
 });
 return s;
 }, [transactions]);

 // --- Actions ---
 
 const executeAction = async (task: any, action: string, qty: number) => {
 const itemKey = task.key;
 console.log(`🚀 Executing action: ${action} for item ${itemKey}`, { itemId: task.id, qty });
 
 setLocalLoading(itemKey);
 setRemovedItems(prev => [...prev, itemKey]);

 try {
 const response = await safeFetch(`${API_URL}/transactions/confirm-repair`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ 
 action, 
 itemId: task.id, 
 serialNumber: task.serial, 
 originalTxnIds: task.txnIds, 
 operatorName,
 quantity: qty 
 })
 });

 if (!response.ok) {
 throw new Error(`Server responded with ${response.status}`);
 }

 const result = await response.json();
 console.log('✅ Action result:', result);

 if (result.status === 'success') {
 if (onSuccess) {
 console.log('🔄 Triggering onSuccess refresh...');
 onSuccess();
 }
 } else {
 setRemovedItems(prev => prev.filter(k => k !== itemKey));
 alert(result.message || 'เกิดข้อผิดพลาดในการทำรายการ');
 }
 } catch (error: any) {
 console.error('❌ Action failed:', error);
 setRemovedItems(prev => prev.filter(k => k !== itemKey));
 alert(`ไม่สามารถติดต่อ Server ได้: ${error.message}`);
 } finally {
 setLocalLoading(null);
 }
 };

 const handleActionClick = (task: any, action: string) => {
 const qty = Number(task.qty || 1);
 const msgs: Record<string, string> = {
 quarantine_approve: 'พัสดุชิ้นนี้ปกติ และพร้อมกลับเข้าคลัง?',
 quarantine_to_repair: 'พัสดุชิ้นนี้เสียหาย และต้องส่งไปห้องซ่อม?',
 quarantine_to_scrap: 'พัสดุชิ้นนี้ชำรุดหนัก ไม่สามารถซ่อมได้ (คัดแยกเป็นซาก)?',
 quarantine_to_lost: 'พัสดุชิ้นนี้สูญหาย (ยืนยันเพื่อปรับสต็อก)?',
 repair_done: 'ซ่อมแซมเสร็จสิ้น และพร้อมกลับเข้าคลังใช้งาน?',
 to_scrap: 'หลังจากประเมินหน้างานแล้ว พบว่าต้องจำหน่ายเป็นซาก?',
 scrap_sold: 'ยืนยันการทำรายการจำหน่ายซากออกจากคลัง?',
 confirm_loss: 'ยืนยันการตัดพัสดุที่หายออกจากระบบ?'
 };
 setConfirmDialog({ item: task, action, message: msgs[action] || 'ยืนยันรายการ?', qty });
 };

 return (
 <div className="mobile-app-shell pb-32">
 <div className="mobile-app-header border-b border-base-300">
 <div className="max-w-4xl mx-auto space-y-4">
 <div className="mobile-row flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
 <Box size={24} />
 </div>
 <h2 className="mobile-form-hero-title">จัดการงานรับคืน</h2>
 </div>
 {(externalLoading || localLoading) && <RefreshCw size={20} className="text-indigo-500" />}
 </div>

 <div className="relative group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500" size={20} />
 <input 
 type="text" 
 placeholder="ค้นหาตามชื่อ, S/N หรือรหัสงาน..."
 className="w-full bg-gray-100 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl py-3 pl-12 pr-4 text-gray-700 outline-none"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 </div>
 </div>

 {/* Tabs Section */}
 <div className="bg-white/50 sticky top-0 z-40 border-b border-gray-200">
 <div className="max-w-4xl mx-auto flex">
 {[
 { id: 'quarantine', label: 'รอตรวจ', icon: ShieldCheck, color: 'text-indigo-500', bg: 'bg-indigo-50', count: stats.quarantine },
 { id: 'repair', label: 'รอซ่อม', icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-50', count: stats.repair },
 { id: 'scrap', label: 'รอจำหน่าย', icon: Trash2, color: 'text-rose-500', bg: 'bg-rose-50', count: stats.scrap },
 { id: 'lost', label: 'หาย', icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-100', count: stats.lost },
 ].map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as ManagementTab)}
 className={`flex-1 py-4 px-2 flex flex-col items-center gap-1 relative ${activeTab === tab.id ? 'border-b-2 border-indigo-600 bg-white' : 'bg-transparent'}`}
 >
 <tab.icon size={20} className={activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'} />
 <span className={`text-[11px] font-bold ${activeTab === tab.id ? 'text-indigo-600' : 'text-gray-500'}`}>{tab.label}</span>
 {tab.count > 0 && (
 <span className={`absolute top-2 right-4 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white`}>
 {tab.count}
 </span>
 )}
 </button>
 ))}
 </div>
 </div>

 {/* List Container */}
 <div className="flex-1 px-4 py-6">
 <div className="max-w-4xl mx-auto space-y-4">
 {groupedTasks.length === 0 ? (
 <div className="bg-white rounded-3xl p-6 text-center border-2 border-dashed border-gray-200">
 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
 <Box size={32} />
 </div>
 <h3 className="text-gray-500 font-bold">ไม่พบรายการงานในขณะนี้</h3>
 <p className="text-gray-400 text-sm">ข้อมูลทุกอย่างอัปเดตเป็นปัจจุบันแล้ว</p>
 </div>
 ) : (
 groupedTasks.map((group) => (
 <div key={group.jobId} className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden group">
 {/* Group Header */}
 <div className="px-6 py-5 mobile-row flex items-center justify-between border-b border-gray-100">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-600">
 <History size={24} />
 </div>
 <div className="flex-1">
 <div className="mobile-row flex items-center justify-between">
 <div>
 <div className="flex items-center gap-3">
 <h3 className="text-xl font-black text-gray-800 tracking-tight">
 {group.customer}
 </h3>
 <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 uppercase tracking-widest shrink-0">
 #{group.jobId}
 </span>
 </div>
 <div className="flex items-center gap-4 mt-1">
 <div className="flex items-center gap-1 text-indigo-600 font-bold text-sm">
 <span className="material-symbols-outlined text-[18px]">badge</span>
 CV: {group.customerCv}
 </div>
 {group.customerPhone && (
 <div className="flex items-center gap-1 text-gray-500 font-bold text-sm">
 <span className="material-symbols-outlined text-[18px]">call</span>
 {group.customerPhone}
 </div>
 )}
 </div>
 </div>

 {(group.customerLat || group.customerAddress) && (
 <div className="flex gap-2">
 <a 
 href={group.customerLat 
 ?`https://www.google.com/maps?q=${group.customerLat},${group.customerLng}`
 :`https://www.google.com/maps?q=${encodeURIComponent(group.customerAddress)}`
 }
 target="_blank"
 rel="noreferrer"
 className="h-10 px-4 bg-indigo-50 text-indigo-600 rounded-xl flex items-center gap-2 font-bold text-xs border border-indigo-100/50"
 >
 <span className="material-symbols-outlined text-[18px]">map</span>
 <span>นำทาง</span>
 </a>
 </div>
 )}
 </div>
 
 {group.customerAddress && (
 <div className="mt-4 bg-gray-50/80 rounded-2xl px-4 py-2.5 border border-gray-100/50 flex items-start gap-3">
 <span className="text-indigo-400 mt-0.5">
 <span className="material-symbols-outlined text-[18px]">location_on</span>
 </span>
 <span className="text-[13px] font-medium text-gray-600 leading-relaxed">{group.customerAddress}</span>
 </div>
 )}

 <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-3 border-t border-gray-100/50">
 <div className="flex items-center gap-1.5 text-gray-400 text-[11px] font-bold">
 <Clock size={12} className="text-gray-300" />
 ทำรายการ: {formatThaiDateTime(group.date)}
 </div>
 {group.appointment && (
 <div className="flex items-center gap-1.5 text-amber-600 text-[11px] font-black">
 <span className="material-symbols-outlined text-[14px]">calendar_clock</span>
 นัดหมาย: {formatThaiDateTime(group.appointment)}
 </div>
 )}
 <div className="flex items-center gap-1.5 text-indigo-500 text-[11px] font-black">
 <span className="material-symbols-outlined text-[14px]">person_edit</span>
 เปิดงาน: {group.notifier}
 </div>
 <div className="flex items-center gap-1.5 text-emerald-600 text-[11px] font-black">
 <span className="material-symbols-outlined text-[14px]">delivery_dining</span>
 ผู้รับคืน: {group.operator}
 </div>
 </div>
 </div>
 </div>
 <ChevronRight className="text-gray-300" />
 </div>

 {/* Items in Group */}
 <div className="p-4 space-y-4">
 {group.items.map((it: any) => (
 <div key={it.key} className="bg-gray-50 rounded-3xl p-4 border border-transparent">
 <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400">
 <Package size={20} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <h4 className="font-bold text-gray-800 text-[15px] leading-tight">{it.displayName}</h4>
 <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">x{it.qty}</span>
 </div>
 <div className="flex flex-wrap items-center gap-2 mt-1.5">
 {it.displayDetails && (
 <span className="text-[10px] text-gray-500 font-bold bg-white px-2 py-0.5 rounded-lg border border-gray-100">{it.displayDetails}</span>
 )}
 {it.serial && (
 <span className="text-[10px] bg-slate-800 text-white px-2 py-0.5 rounded-lg font-bold tracking-tight">S/N: {it.serial}</span>
 )}
 </div>
 
 {/* Rider/Admin Note Badge */}
 {(() => {
 const rawNote = String(it.riderNote || '').trim();
 let displayNote = rawNote;
 if (rawNote === 'รอซ่อม') displayNote = 'ส่งซ่อม';
 else if (rawNote === 'ชำรุดหนัก/ซาก' || rawNote === 'ชำรุดหนัก' || rawNote === 'ซาก') displayNote = 'เสียหายหนัก';
 else if (rawNote === 'ปกติ' || rawNote === 'ปรกติ') displayNote = 'ปกติ';
 else if (rawNote === 'สูญหาย' || rawNote === 'หาย') displayNote = 'สูญหาย';
 
 return (
 <div className="mt-3 flex flex-wrap items-center gap-2">
 <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-gray-100">
 <span className="text-[11px] font-bold text-gray-600">ร่องรอยการคืน:</span>
 <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${ displayNote === 'ปกติ' ? 'bg-emerald-100 text-emerald-700' : displayNote === 'ส่งซ่อม' ? 'bg-indigo-100 text-indigo-700' : displayNote === 'เสียหายหนัก' ? 'bg-slate-200 text-slate-700' : displayNote === 'สูญหาย' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700' }`}>
 {displayNote || 'ยังไม่ได้ระบุ'}
 </span>
 </div>
 </div>
 );
 })()}
 </div>
 </div>

 {/* Actions */}
 <div className="flex flex-wrap gap-2 justify-end w-full md:w-auto">
 {activeTab === 'quarantine' && (
 <>
 <button onClick={() => handleActionClick(it, 'quarantine_approve')} className="flex-1 md:flex-none h-10 px-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black">
 ปกติ
 </button>
 <button onClick={() => handleActionClick(it, 'quarantine_to_repair')} className="flex-1 md:flex-none h-10 px-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black">
 ส่งซ่อม
 </button>
 <button onClick={() => handleActionClick(it, 'quarantine_to_scrap')} className="flex-1 md:flex-none h-10 px-4 bg-gray-800 text-white rounded-2xl text-[11px] font-black">
 ตีซาก
 </button>
 <button onClick={() => handleActionClick(it, 'quarantine_to_lost')} className="flex-1 md:flex-none h-10 px-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black">
 ตีหาย
 </button>
 </>
 )}
 {activeTab === 'repair' && (
 <>
 <button onClick={() => handleActionClick(it, 'repair_done')} className="flex-1 md:flex-none h-10 px-5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black">
 ซ่อมเสร็จ
 </button>
 <button onClick={() => handleActionClick(it, 'to_scrap')} className="flex-1 md:flex-none h-10 px-5 bg-rose-600 text-white rounded-2xl text-[11px] font-black">
 ตัดซาก
 </button>
 </>
 )}
 {activeTab === 'scrap' && (
 <button onClick={() => handleActionClick(it, 'scrap_sold')} className="flex-1 md:flex-none h-10 px-8 bg-amber-600 text-white rounded-2xl text-[11px] font-black">
 ทำรายการจำหน่าย
 </button>
 )}
 {activeTab === 'lost' && (
 <button onClick={() => handleActionClick(it, 'confirm_loss')} className="flex-1 md:flex-none h-10 px-8 bg-rose-600 text-white rounded-2xl text-[11px] font-black">
 ตัดยอดสูญหาย
 </button>
 )}
 </div>
 </div>
 ))}
 </div>

 {/* Unified Photo Gallery for the entire Job (Moved to Bottom of the Job Card) */}
 {group.allPhotos && group.allPhotos.length > 0 && (
 <div className="px-6 py-5 bg-gray-50/50 border-t border-gray-100">
 <div className="flex items-center gap-2 mb-3 text-gray-500">
 <span className="material-symbols-outlined text-[18px]">collections</span>
 <span className="text-[11px] font-black uppercase tracking-widest">รูปภาพประกอบใบงาน</span>
 </div>
 <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
 {group.allPhotos.split('\n').filter(Boolean).map((url: string, idx: number) => (
 <button 
 key={idx} 
 onClick={() => setLightboxUrl(url)}
 className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 border-4 border-white group/img outline-none"
 >
 <img src={url} alt={`Job Photo ${idx+1}`} className="w-full h-full object-cover" />
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 ))
 )}
 </div>
 </div>

 {/* Confirmation Modal */}
 {confirmDialog && (
 <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
 <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm flex flex-col items-center">
 <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-600">
 <AlertCircle size={32} />
 </div>
 <h3 className="text-lg font-black text-gray-800 text-center leading-relaxed">โปรดยืนยันการทำรายการ</h3>
 <p className="text-gray-500 font-medium text-sm mt-3 text-center leading-relaxed">
 {confirmDialog.message}
 </p>
 <div className="flex gap-3 w-full mt-8">
 <button 
 onClick={() => setConfirmDialog(null)}
 className="flex-1 h-12 bg-gray-100 text-gray-600 font-bold rounded-2xl"
 disabled={!!localLoading}
 >
 ยกเลิก
 </button>
 <button 
 onClick={() => {
 executeAction(confirmDialog.item, confirmDialog.action, confirmDialog.qty);
 setConfirmDialog(null);
 }}
 className="flex-1 h-12 bg-indigo-600 text-white font-bold rounded-2xl"
 disabled={!!localLoading}
 >
 {localLoading ? 'กำลังส่ง...' : 'ยืนยัน'}
 </button>
 </div>
 </div>
 </div>
 )}
 
 <ImageLightbox 
 isOpen={!!lightboxUrl} 
 imageUrl={lightboxUrl || ''} 
 onClose={() => setLightboxUrl(null)} 
 />
 </div>
 );
};

export default RepairManagement;
