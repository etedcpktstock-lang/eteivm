import React, { useState, useMemo } from 'react';
import { 
 Package, 
 MapPin, 
 CheckCircle2, 
 ChevronRight, 
 Camera, 
 Truck, 
 Clock, 
 ArrowRight,
 RefreshCw,
 Search,
 Navigation,
 FileText,
 ShieldCheck
} from 'lucide-react';
import { processBatchTransaction, API_URL } from '../../api';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import { formatItemName } from '../../utils/logisticsUtils';
import { reconcileTransactions } from '../../utils/logisticsCore';
import type { Transaction, MaterialItem, Customer } from '../../types';

interface LogisticsTasksProps {
 jobs: any[];
 items: MaterialItem[];
 customers: Customer[];
 operatorName: string;
 onRefresh: () => void;
 onSuccess: () => void;
 onBack: () => void;
 onFulfill?: (job: any) => void;
 onNavigateToTab?: (tab: string, jobId: string) => void;
 initialJobId?: string | null;
}

const LogisticsTasks: React.FC<LogisticsTasksProps> = ({ 
 jobs, 
 items, 
 customers, 
 operatorName, 
 onRefresh, 
 onSuccess,
 onBack,
 onFulfill,
 onNavigateToTab,
 initialJobId
}) => {
 const [searchTerm, setSearchTerm] = useState('');
 const [loading, setLoading] = useState<string | null>(null);
 const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});

 const toggleJob = (jobId: string) => {
 setExpandedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));
 };

 const getCustomer = (cv: string) => customers.find(c => c.cv === cv);

 const filteredJobs = useMemo(() => {
 if (initialJobId) {
 return jobs.filter(j => j.jobId === initialJobId);
 }

 const relevantStatuses = ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'รอส่ง', 'รอรับคืน', 'กำลังไปส่ง', 'ถึงหน้าร้านแล้ว', 'รับงานแล้ว', 'ยืนยันรับงาน', 'ดำเนินการ'];
 return jobs.filter(j => {
 const jId = String(j.jobId || j.job_id || j.txnNo || j.txn_no || '').toUpperCase();
 if (jId.startsWith('TXN-')) return false;

 const isRelevant = relevantStatuses.some(s => j.status?.toUpperCase().includes(s.toUpperCase()) || j.status === s);
 const search = searchTerm.toLowerCase();
 return isRelevant && (
 (j.jobId || '').toLowerCase().includes(search) || 
 (j.customerName || '').toLowerCase().includes(search) ||
 (j.cv || '').toLowerCase().includes(search)
 );
 }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
 }, [jobs, searchTerm, initialJobId]);

 const handleUpdateStatusOnly = async (job: any, nextStatus: string) => {
 setLoading(job.jobId);
 try {
 let lat: string | undefined;
 let lng: string | undefined;
 try {
 const position = await new Promise<GeolocationPosition>((resolve, reject) => {
 navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
 });
 lat = position.coords.latitude.toString();
 lng = position.coords.longitude.toString();
 } catch (e) { console.warn("GPS failed", e); }

 const res = await processBatchTransaction({
 action: 'issue',
 items: [],
 cv: job.cv,
 deliveryBy: operatorName,
 deliveryDate: new Date().toISOString(),
 txnNo: job.jobId,
 operator: operatorName,
 note:`เปลี่ยนสถานะเป็น: ${nextStatus}`,
 workZone: '-',
 jobId: job.jobId,
 status: nextStatus,
 lat, lng
 });

 if (res.status === 'success') onSuccess();
 else alert(res.message);
 } catch (err: any) {
 alert(err.message);
 } finally {
 setLoading(null);
 }
 };

 const getStatusConfig = (status: string) => {
 const s = (status || '').toUpperCase();
 if (s === 'PENDING' || s === 'รอส่ง' || s === 'รอรับคืน') return { color: 'bg-amber-50 text-amber-600 border-amber-100', label: 'รอรับงาน' };
 if (s === 'ACCEPTED' || s === 'รับงานแล้ว') return { color: 'bg-indigo-50 text-indigo-600 border-indigo-100', label: 'รับงานแล้ว' };
 if (s.includes('TRANSIT') || s.includes('เดินทาง')) return { color: 'bg-blue-50 text-blue-600 border-blue-100', label: 'กำลังเดินทาง' };
 if (s.includes('ARRIVED') || s.includes('หน้าร้าน')) return { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', label: 'ถึงหน้าร้านแล้ว' };
 if (s.includes('รอตรวจ') || s.includes('ตรวจสอบ') || s.includes('OFFICE')) return { color: 'bg-purple-50 text-purple-600 border-purple-100', label: 'กำลังตรวจสอบ' };
 if (s.includes('คืนของแล้ว') || s.includes('สำเร็จ') || s.includes('SUCCESS')) return { color: 'bg-green-50 text-emerald-600 border-emerald-100', label: 'เสร็จสมบูรณ์' };
 if (s.includes('ปิดงาน') || s.includes('CLOSED')) return { color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'เสร็จสมบูรณ์' };
 return { color: 'bg-slate-50 text-slate-500 border-slate-100', label: status };
 };

 return (
 <div className="mobile-app-shell pb-24">
 <div className="mobile-app-header sticky top-0 z-30 border-b border-base-300 flex items-center gap-4">
 <button 
 onClick={onBack}
 className="btn no-animation w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 shrink-0"
 >
 <ArrowRight size={22} className="rotate-180" />
 </button>
 <div className="flex-1">
 <h1 className="mobile-form-hero-title">
 {initialJobId ? 'จัดการงานละเอียด' : 'งานขนส่งทั้งหมด'}
 </h1>
 <p className="mobile-form-hero-subtitle mt-1">
 {initialJobId ? `งานเลขที่ #${initialJobId}` : 'จัดการงานขนส่ง'}
 </p>
 </div>
 <button 
 onClick={onRefresh}
 className={`btn no-animation w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 ${loading ? '' : ''}`}
 >
 <RefreshCw size={22} />
 </button>
 </div>

 {!initialJobId && (
 <div className="p-4">
 <div className="mobile-toolbar-card relative group flex items-center gap-2">
 <div className="relative flex-1 group">
 <Search size={18} className="absolute left-6 top-1/2 text-slate-300 group-focus-within:text-indigo-600" />
 <input 
 type="text" 
 placeholder="ค้นหาตามรหัสงาน หรือลูกค้า..." 
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full h-14 pl-16 pr-6 bg-white border border-slate-200 rounded-full outline-none focus:border-indigo-500/20 text-[15px] font-bold text-slate-700 placeholder:text-slate-300"
 />
 </div>
 <button className="btn no-animation h-14 px-8 bg-indigo-600 text-white rounded-full flex items-center justify-center gap-2 font-black text-[13px] uppercase shrink-0">
 <Search size={18} />
 <span>ค้นหา</span>
 </button>
 </div>
 </div>
 )}

 <div className="px-4 py-4 space-y-4">
 {filteredJobs.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-6">
 <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-6">
 <CheckCircle2 size={48} />
 </div>
 <p className="text-xl font-black text-slate-900">ไม่มีงานค้างในขณะนี้</p>
 <p className="text-slate-400 font-medium mt-2">คุณปฏิบัติงานครบถ้วนแล้ว!</p>
 </div>
 ) : (
 filteredJobs.map((job: any) => {
 const customer = getCustomer(job.cv);
 const statusStyle = getStatusConfig(job.status);
const plannedDeliveryQty = job.items
.filter((i: any) => ['แจ้งส่ง', 'ISSUE_REQUEST', 'DELIVERY_REQUEST'].includes(String(i.action_type || i.action || '').toUpperCase()))
.reduce((sum: number, i: any) => sum + Number(i.quantity || i.จำนวน || 1), 0);
const issuedDeliveryQty = job.items
.filter((i: any) => {
 const action = String(i.action_type || i.action || '').toUpperCase();
 return (action.includes('เบิกออก') || action === 'ISSUE') && !action.includes('REQUEST');
})
.reduce((sum: number, i: any) => sum + Number(i.quantity || i.จำนวน || 1), 0);
const hasUnissuedDelivery = plannedDeliveryQty > issuedDeliveryQty;
 const hasReturn = job.items.some((i: any) => i.action_type === 'แจ้งคืน' || i.action_type === 'RETURN_REQUEST');
 const status = (job.status || '').toUpperCase();

 return (
 <div 
 key={job.jobId} 
 className="bg-white rounded-[2.8rem] border border-slate-100/60 overflow-hidden"
 >
 <div className="p-5 flex items-start justify-between bg-slate-50/30">
 <div className="flex items-center gap-4">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${!hasReturn ? 'bg-indigo-600 text-white' : (hasUnissuedDelivery ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white')}`}>
 {!hasReturn ? <Truck size={22} /> : (hasUnissuedDelivery ? <Package size={22} /> : <RefreshCw size={22} />)}
 </div>
 <div>
 <h3 className="text-[17px] font-black text-slate-900 leading-tight">
 {job.customerName || job.cv}
 </h3>
 <div className="flex items-center gap-2 mt-1">
 <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusStyle.color}`}>
 {statusStyle.label}
 </span>
 <span className="text-[10px] font-black text-slate-300 px-2 py-0.5 bg-white/50 rounded-full border border-slate-100/50 italic">
 #{job.jobId}
 </span>
 </div>
 </div>
 </div>
 <div className="text-right hidden sm:block">
 <p className="text-[11.5px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">สถานะคลังพัสดุ</p>
 <p className="text-[14px] font-black text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-100">{formatThaiDateTime(job.createdAt)}</p>
 </div>
 </div>

 <div className="px-7 pb-8 pt-2">
 <div className="flex items-center gap-3 bg-slate-50/50 p-4 rounded-3xl border border-slate-100/30 mb-5">
 <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-300 border border-slate-50">
 <MapPin size={14} />
 </div>
 <p className="text-[13px] font-bold text-slate-500 line-clamp-1 italic">
 {customer?.address || 'ไม่ระบุที่อยู่'}
 </p>
 <div className="flex-1" />
 {customer?.lat && customer?.lng && (
 <a 
 href={`https://www.google.com/maps?q=${customer.lat},${customer.lng}`}
 target="_blank" rel="noreferrer"
 className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-500 border border-slate-100"
 >
 <Navigation size={14} />
 </a>
 )}
 </div>

 {job.note && (
 <div className="bg-indigo-50/30 p-5 rounded-xl border border-indigo-100/30 mb-5 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full translate-x-6"></div>
 <div className="flex items-center gap-2 mb-2">
 <FileText size={14} className="text-indigo-400" />
 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">บันทึกเพิ่มเติมจากหน้างาน</span>
 </div>
 <p className="text-[13px] font-bold text-slate-600 italic leading-relaxed">"{job.note}"
 </p>
 </div>
 )}

 <div 
 onClick={() => toggleJob(job.jobId)}
 className="grid grid-cols-2 gap-4 cursor-pointer"
 >
 <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100/50 flex flex-col gap-2 relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 rounded-full translate-x-4"></div>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">ส่งพัสดุ</p>
 <div className="mobile-row flex items-center justify-between">
 <span className="text-3xl font-black text-slate-900 leading-none pl-1">
 {(() => {
 const { pendingItems, completedItems } = reconcileTransactions(job.items || []);
 const sendPending = pendingItems.filter(p => p.category === 'SEND').reduce((acc, p) => acc + p.remainingQty, 0);
 const sendCompleted = completedItems.filter(c => c.category === 'SEND').reduce((acc, c) => acc + (c.result.quantity || 1), 0);
 return sendPending + sendCompleted;
 })()}
 </span>
 <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-200">
 <Package size={20} />
 </div>
 </div>
 </div>
 <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100/50 flex flex-col gap-2 relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-12 h-12 bg-rose-500/5 rounded-full translate-x-4"></div>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">รับคืน</p>
 <div className="mobile-row flex items-center justify-between">
 <span className="text-3xl font-black text-slate-900 leading-none pl-1">
 {(() => {
 const { pendingItems, completedItems } = reconcileTransactions(job.items || []);
 const returnPending = pendingItems.filter(p => p.category === 'RETURN').reduce((acc, p) => acc + p.remainingQty, 0);
 const returnCompleted = completedItems.filter(c => c.category === 'RETURN').reduce((acc, c) => acc + (c.result.quantity || 1), 0);
 return returnPending + returnCompleted;
 })()}
 </span>
 <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-200">
 <RefreshCw size={20} />
 </div>
 </div>
 </div>
 </div>

 {expandedJobs[job.jobId] && (
 <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
 <div className="mobile-row flex items-center justify-between px-2 mb-2">
 <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">รายละเอียดพัสดุ</p>
 <Package size={14} className="text-slate-200" />
 </div>
 {(() => {
 const { allAggregated = [] } = reconcileTransactions(job?.items || []);
 const expandedList = allAggregated.flatMap((agg: any) => {
 const isFreezer = (agg.it?.ประเภท || agg.it?.รายการ || '').includes('ตู้แช่');
 if (isFreezer && agg.totalQty > 1) {
 return Array.from({ length: agg.totalQty }).map((_, idx) => {
 const record = agg.detailsList?.[idx] || agg.it;
 return { ...agg, it: record, totalQty: 1, _subIdx: idx };
 });
 }
 return [agg];
 });
 
 return expandedList.map((agg: any, idx: number) => {
 const item = agg?.it;
 if (!item) return null;
 const fullItem = items.find(m => Number(m.id) === Number(item.rowIndex || item.item_id));
 const displayItem = fullItem ? { ...fullItem, ...item } : item;

 return (
 <div key={idx} className="mobile-row flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100/80 group">
 <div className="flex items-center gap-4 min-w-0 flex-1">
 <div className={`w-2 h-8 rounded-full ${agg?.category === 'RETURN' ? 'bg-rose-500' : 'bg-indigo-500'} shrink-0`} />
 <div className="min-w-0">
 <p className="text-[14px] font-black text-slate-800 uppercase leading-snug truncate">
 <span className={agg?.category === 'RETURN' ? 'text-rose-600' : 'text-indigo-600'}>[{agg?.isReconciled ? (agg.action_type || 'สำเร็จ') : (agg?.category === 'SEND' ? 'แจ้งส่ง' : 'แจ้งคืน')}]</span> {displayItem?.ประเภท || ''} {displayItem?.รายการ || ''}
 </p>
 <div className="flex items-center gap-2 mt-0.5 flex-wrap">
 <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide truncate max-w-[150px]">
 {displayItem?.ยี่ห้อหรือรูปแบบ || displayItem?.brand || '-'} • {displayItem?.ขนาด || '-'}
 </p>
 {(() => {
 const rawCond = agg?.cabinet_status || item?.cabinet_status || agg?.cabinetCondition || item?.cabinetCondition || agg?.status;
 if (!rawCond) return null;
 let displayCond = String(rawCond).trim();
 if (displayCond === 'รอซ่อม') displayCond = 'ส่งซ่อม';
 else if (displayCond === 'ชำรุดหนัก/ซาก' || displayCond === 'ชำรุดหนัก' || displayCond === 'ซาก' || displayCond === 'ตีซาก') displayCond = 'เสียหายหนัก';
 else if (displayCond === 'ปรกติ') displayCond = 'ปกติ';
 else if (displayCond === 'หาย' || displayCond === 'ตีหาย') displayCond = 'สูญหาย';

 if (!['ปกติ', 'ส่งซ่อม', 'เสียหายหนัก', 'สูญหาย'].includes(displayCond)) return null;

 return (
 <span className={`px-2 py-0.5 rounded border text-[9px] font-black tracking-widest uppercase ${ displayCond === 'ปกติ' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : displayCond === 'ส่งซ่อม' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : displayCond === 'เสียหายหนัก' ? 'bg-slate-100 text-slate-600 border-slate-200' : displayCond === 'สูญหาย' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100' }`}>
 {displayCond}
 </span>
 );
 })()}
 {(item?.serialNumber || item?.serial_number) && (
 <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 italic">SN: {item.serialNumber || item.serial_number}</span>
 )}
 </div>
 </div>
 </div>
 <div className="bg-slate-900 text-white px-3 h-10 rounded-2xl flex items-center justify-center font-black text-[11px] shrink-0">
 {agg?._subIdx !== undefined ?`ชิ้นที่ ${agg._subIdx + 1}` : (agg?.totalQty || 1)}
 </div>
 </div>
 );
 });
 })()}
 <button 
 onClick={() => toggleJob(job.jobId)}
 className="w-full py-2 text-[10px] font-black text-slate-300 uppercase tracking-widest"
 >
 ย่อรายละเอียด
 </button>
 </div>
 )}

 <div className="pt-6">
 {(() => {
 const jobStatus = String(job.status ||"").toUpperCase();
 const hasPendingPlans = job.items?.some((it: any) => 
 ['แจ้งส่ง', 'แจ้งคืน', 'ISSUE_REQUEST', 'RETURN_REQUEST'].includes(String(it.action_type || it.action || '').toUpperCase())
 );
 
 const isHandedOver = 
 (jobStatus.includes('รอตรวจ') || jobStatus.includes('ตรวจสอบ') ||
 job.items?.some((it: any) => {
 const s = String(it.action_type || it.status || it.ประเภท || '').toUpperCase();
 return s.includes('รอตรวจ') || s.includes('ตรวจสอบ');
 })) && !hasPendingPlans; // Only lock if ALL plans are fulfilled!
 
 if (isHandedOver) {
 return (
 <div className="w-full h-14 bg-indigo-50/50 text-indigo-500 rounded-3xl mobile-row flex items-center justify-between px-6 font-black text-[13px] uppercase tracking-[0.1em] border border-indigo-100">
 <div className="flex items-center gap-3">
 <RefreshCw size={18} className="" />
 <div className="flex flex-col">
 <span className="leading-tight">ออฟฟิศกำลังตรวจสอบ</span>
 <span className="text-[9px] opacity-60 font-medium lowercase tracking-normal italic mt-0.5">Wait for admin approval...</span>
 </div>
 </div>
 <ShieldCheck size={20} className="text-indigo-300" />
 </div>
 );
 }

 if (status === 'PENDING' || status === 'รอส่ง' || status === 'รอรับคืน') {
 return (
 <button 
 onClick={() => handleUpdateStatusOnly(job, 'ACCEPTED')}
 disabled={!!loading}
 className="relative w-full h-12 bg-slate-900 text-white rounded-full mobile-row flex items-center justify-between px-1.5 font-black text-[13px] uppercase tracking-[0.15em] group overflow-hidden disabled:opacity-75"
 >
 <div className="absolute inset-0"></div>
 <span className="pl-5 relative z-10">{loading === job.jobId ? 'กำลังโหลด...' : 'ยืนยันรับงาน'}</span>
 <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white relative z-10 border border-white/10">
 {loading === job.jobId ? <RefreshCw size={18} className="" /> : <ShieldCheck size={18} strokeWidth={2.5} />}
 </div>
 </button>
 );
 }

 if (status === 'ACCEPTED') {
 return (
 <button 
 onClick={() => {
 const tab = hasUnissuedDelivery ? 'issue' : 'return';
 if (onNavigateToTab) onNavigateToTab(tab, job.jobId);
 else (window as any).onNavigateToTab?.(tab, job.jobId);
 }}
 className={`relative w-full h-12 ${hasUnissuedDelivery ? 'bg-amber-500' : 'bg-indigo-600'} text-white rounded-full mobile-row flex items-center justify-between px-1.5 font-black text-[13px] uppercase tracking-[0.1em] group overflow-hidden`}
 >
 <div className="absolute inset-0"></div>
 <span className="pl-5 relative z-10">{hasUnissuedDelivery ? 'ไปหน้าเบิกพัสดุ' : 'ไปหน้าแบบฟอร์ม'}</span>
 <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white relative z-10 border border-white/10">
 {hasUnissuedDelivery ? <Package size={18} strokeWidth={2.5} /> : <ArrowRight size={18} strokeWidth={2.5} />}
 </div>
 </button>
 );
 }

 if (status.includes('TRANSIT') || status.includes('กำลังเดินทาง')) {
 return (
 <button 
 onClick={() => handleUpdateStatusOnly(job, 'ARRIVED')}
 className="relative w-full h-12 bg-emerald-600 text-white rounded-full mobile-row flex items-center justify-between px-1.5 font-black text-[12px] uppercase tracking-[0.1em] group overflow-hidden"
 >
 <div className="absolute inset-0"></div>
 <span className="pl-4 relative z-10">ถึงหน้าร้านแล้ว (เช็คอิน)</span>
 <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white relative z-10 border border-white/10">
 <MapPin size={18} strokeWidth={2.5} />
 </div>
 </button>
 );
 }

 if (status.includes('ARRIVED') || status.includes('หน้า')) {
 return (
 <button 
 onClick={() => {
 if (hasUnissuedDelivery) {
 if (onNavigateToTab) onNavigateToTab('issue', job.jobId);
 else (window as any).onNavigateToTab?.('issue', job.jobId);
 } else {
 if (onFulfill) onFulfill(job);
 }
 }}
 className={`relative w-full h-12 ${hasUnissuedDelivery ? 'bg-amber-600' : 'bg-rose-600'} text-white rounded-full mobile-row flex items-center justify-between px-1.5 font-black text-[12px] uppercase tracking-[0.05em] group overflow-hidden border border-rose-500`}
 >
 <div className="absolute inset-0"></div>
 <span className="pl-4 relative z-10">{hasUnissuedDelivery ? 'ต้องเบิกพัสดุก่อน' : 'บันทึกการส่งมอบ / รับคืน'}</span>
 <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white relative z-10 border border-white/10">
 {hasUnissuedDelivery ? <Package size={20} strokeWidth={3} /> : <CheckCircle2 size={20} strokeWidth={3} />}
 </div>
 </button>
 );
 }

 return null;
 })()}

 <button className="btn no-animation w-full mt-4 h-11 bg-white rounded-full border border-slate-100 flex items-center justify-center gap-2 text-slate-500 text-[12px] font-black outline-none">
 <Camera size={16} className="text-slate-400" />
 <span>หลักฐานการส่ง (รูปภาพ)</span>
 </button>
 </div>
 </div>
 </div>
 );
 })
 )}
 </div>

 <div className="fixed bottom-6 left-4 right-4 z-[40]">
 <div className="bg-slate-900/80 px-6 py-5 rounded-[2.5rem] border border-white/10 mobile-row flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white">
 <FileText size={20} />
 </div>
 <div>
 <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]"></p>
 <p className="text-[16px] font-black text-white">{filteredJobs.length} งานที่เหลือ</p>
 </div>
 </div>
 <button 
 onClick={onRefresh}
 className="btn no-animation w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white"
 >
 <RefreshCw size={20} className={loading ? '' : ''} />
 </button>
 </div>
 </div>
 </div>
 );
};

export default LogisticsTasks;
