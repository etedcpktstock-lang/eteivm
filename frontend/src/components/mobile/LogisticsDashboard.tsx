import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import {
 Truck,
 MapPin,
 CheckCircle2,
 Clock,
 Search,
 RefreshCw,
 Camera,
 ChevronRight,
 Package,
 ArrowRight,
 FileText,
 ShieldCheck,
 AlertCircle,
 LayoutGrid,
 Map,
 Navigation,
 Save,
 History,
 XCircle,
 Plus,
 Building2,
 Phone,
 LogOut,
 QrCode,
 TrendingUp
} from 'lucide-react';
import { getLogisticsJobs, processBatchTransaction, searchAssetUnits } from '../../api';
import FulfillmentForm from './FulfillmentForm';
import LogisticsTasks from './LogisticsTasks';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import { 
 aggregateJobItems, 
 checkIsWaitingJob, 
 checkIsActiveJob, 
 checkIsHistoryJob, 
 formatItemName,
 classifyLogisticsItem
} from '../../utils/logisticsUtils';
import type { MaterialItem, Customer } from '../../types';

interface LogisticsDashboardProps {
 items: MaterialItem[];
 customers: Customer[];
 operatorName: string;
 onNavigateToTab: (tab: string, jobId: string) => void;
 onSuccess: () => void;
 initialTab?: 'waiting' | 'active' | 'history';
 transactions: any[];
 loading?: boolean;
}

const LogisticsDashboard: React.FC<LogisticsDashboardProps> = ({
 items,
 customers,
 operatorName,
 onNavigateToTab,
 onSuccess,
 initialTab = 'waiting',
 transactions = [],
 loading: globalLoading = false
}) => {
 /* 
 📝 FIX NOTE (2024-04-20): 
 - Resolved item count discrepancy (e.g., 33 instead of 15).
 - Previous logic double-counted items when they had multiple transaction states (Plan + Action + Inspected).
 - Now uses a deduplication strategy per unique Item ID within specific category keyword filters.
 - Specifically excluded"ตรวจสอบแล้ว" (Inspected) from the SEND count to ensure"Physical Reality" matching.
 */
 const [activeTab, setActiveTab] = useState<'waiting' | 'active' | 'history'>(initialTab);
 const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
 const [jobs, setJobs] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [actionLoading, setActionLoading] = useState<string | null>(null);
 const [selectedJobForFulfillment, setSelectedJobForFulfillment] = useState<any | null>(null);
 const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
 const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [assetQuery, setAssetQuery] = useState('');
 const [assetLoading, setAssetLoading] = useState(false);
 const [assetError, setAssetError] = useState<string | null>(null);
 const [assetResults, setAssetResults] = useState<any[]>([]);
 const [cancelJobDialog, setCancelJobDialog] = useState<{ jobId: string; reason: string; isCustom?: boolean } | null>(null);

 const fetchJobs = useCallback(async (showLoading = true) => {
 if (showLoading) setLoading(true);
 try {
 const data = await getLogisticsJobs();
 setJobs(data);
 setLastSyncTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
 } catch (err) {
 console.error("Fetch Jobs Error:", err);
 } finally {
 if (showLoading) setLoading(false);
 }
 }, []);

useEffect(() => {
 fetchJobs();
 const basePollMs = window.innerWidth < 768 ? 15000 : 8000;
 const interval = setInterval(() => {
 const pollMs = document.visibilityState === 'visible' ? basePollMs : basePollMs * 3;
 // ลดการยิง API ตอนแอปอยู่ background โดยยังคงอัปเดตเมื่อกลับมาใช้งาน
 if (pollMs === basePollMs) {
 fetchJobs(false);
 }
 }, basePollMs);
 return () => clearInterval(interval);
}, [fetchJobs]);

 const handleCancelJob = async () => {
 if (!cancelJobDialog || !cancelJobDialog.reason.trim()) return;
 
 setActionLoading(cancelJobDialog.jobId);
 try {
 const { cancelTransaction } = await import('../../api');
 const res = await cancelTransaction(cancelJobDialog.jobId, operatorName, cancelJobDialog.reason);
 
 if (res.status === 'success') {
 setCancelJobDialog(null);
 fetchJobs(); 
 if (onSuccess) onSuccess();
 } else {
 alert(res.message || 'ไม่สามารถยกเลิกงานได้');
 }
 } catch (err: any) {
 alert(`Error: ${err.message}`);
 } finally {
 setActionLoading(null);
 }
 };

 const isWaitingJob = useCallback((j: any) => checkIsWaitingJob(j), []);
 const isActiveJob = useCallback((j: any) => checkIsActiveJob(j), []);
 const isHistoryJob = useCallback((j: any) => checkIsHistoryJob(j), []);
 
 const isDoneStatus = (s: string) => {
 const su = String(s ||"").toUpperCase();
 return ['สำเร็จ', 'CLOSED', 'SUCCESS', 'ยืนยันแล้ว', 'เดินทางกลับ', 'จากร้าน', 'ปิดงาน'].some(k => su.includes(k.toUpperCase()));
 };
 
 const hasPendingItems = (j: any) => {
 return j.items?.some((it: any) => 
 ['แจ้งส่ง', 'แจ้งคืน', 'ISSUE_REQUEST', 'RETURN_REQUEST'].includes(String(it.action_type || it.action || '').toUpperCase())
 ) || false;
 };

 const filteredJobs = useMemo(() => {
 const baseFiltered = jobs.filter(j => {
 const search = searchTerm.toLowerCase();
 return (
 j.jobId?.toLowerCase().includes(search) ||
 j.cv?.toLowerCase().includes(search) ||
 j.customerName?.toLowerCase().includes(search)
 );
 });

 if (activeTab === 'waiting') {
 return baseFiltered.filter(isWaitingJob);
 } else if (activeTab === 'active') {
 return baseFiltered.filter(isActiveJob);
 } else {
 return baseFiltered.filter(isHistoryJob);
 }
 }, [jobs, activeTab, searchTerm, isWaitingJob, isActiveJob, isHistoryJob]);

 const mapAssetStatusLabel = (s: string) => {
 const status = String(s || '').toLowerCase();
 if (status === 'stock') return 'สต็อก';
 if (status === 'quarantine') return 'รอตรวจ';
 if (status === 'repair') return 'รอซ่อม';
 if (status === 'in_transit') return 'ระหว่างทาง';
 if (status === 'with_customer') return 'อยู่กับลูกค้า';
 if (status === 'scrap') return 'ซาก';
 if (status === 'lost') return 'สูญหาย';
 return s || '-';
 };

 const handleAssetLookup = async () => {
 const q = assetQuery.trim();
 if (!q) {
 setAssetResults([]);
 setAssetError('กรอก S/N หรือ Asset Tag ก่อนค้นหา');
 return;
 }
 setAssetLoading(true);
 setAssetError(null);
 try {
 const results = await searchAssetUnits({ q, limit: 20 });
 setAssetResults(results || []);
 if (!results || results.length === 0) {
 setAssetError('ไม่พบข้อมูลรหัสเครื่องนี้');
 }
 } catch (err: any) {
 setAssetResults([]);
 setAssetError(err?.message || 'ค้นหาไม่สำเร็จ');
 } finally {
 setAssetLoading(false);
 }
 };

 const handleUpdateStatus = async (job: any, nextStatus: string, actionType: any) => {
 setActionLoading(job.jobId);

 // 🌐 Capture GPS Coordinates
 let lat: number | undefined;
 let lng: number | undefined;

 try {
 const position = await new Promise<GeolocationPosition>((resolve, reject) => {
 navigator.geolocation.getCurrentPosition(resolve, reject, {
 enableHighAccuracy: true,
 timeout: 5000,
 maximumAge: 0
 });
 });
 lat = position.coords.latitude;
 lng = position.coords.longitude;
 } catch (err) {
 console.warn("Failed to capture GPS:", err);
 }

 try {
 // สำหรับ status_only (กดรับงาน) ไม่ต้องส่ง items ไป
const jobItems = actionType === 'status_only' ? [] : job.items.map((it: any) => ({
 item: items.find(m => Number(m.id) === Number(it.rowIndex)) || it,
 quantity: it.จำนวน || 1,
 serialNumber: it.serialNumber || '',
 assetTag: it.assetTag || it.asset_tag || it.serialNumber || '',
 returnReason: it.return_reason || ''
}));

 const res = await processBatchTransaction({
 action: actionType,
 items: jobItems,
 cv: job.cv,
 deliveryBy: operatorName,
 deliveryDate: new Date().toISOString(),
 txnNo: job.jobId,
 operator: operatorName,
 note:`[Logistics App] อัปเดตสถานะ: ${nextStatus}`,
 workZone: '',
 jobId: job.jobId,
 status: nextStatus,
 lat: lat?.toString(),
 lng: lng?.toString(),
 warehouseId: job.warehouseId
 });

 if (res.status === 'success') {
 fetchJobs();
 onSuccess();

 if (activeTab === 'waiting') {
 setActiveTab('active');
 }
 else if (nextStatus.includes('เสร็จ') || nextStatus.includes('คืนแล้ว') || nextStatus.includes('ปิดงาน')) {
 setActiveTab('history');
 setSelectedJobId(null);
 }

 } else {
 alert(res.message ||"เกิดข้อผิดพลาด");
 }
 } catch (err: any) {
 alert("เกิดข้อผิดพลาด:" + err.message);
 } finally {
 setActionLoading(null);
 }
 };

 const getCustomer = (cv: string) => customers.find(c => c.cv === cv);

 if (selectedJobId) {
 const job = jobs.find(j => j.jobId === selectedJobId);
 if (job) {
 return (
 <LogisticsTasks
 jobs={jobs}
 items={items}
 customers={customers}
 operatorName={operatorName}
 onRefresh={() => { fetchJobs(true); onSuccess(); }}
 onSuccess={() => {
 fetchJobs(true);
 onSuccess();
 }}
 onBack={() => setSelectedJobId(null)}
 onNavigateToTab={onNavigateToTab}
 onFulfill={(job) => {
 setSelectedJobId(null);
 setSelectedJobForFulfillment(job);
 }}
 initialJobId={selectedJobId}
 />
 );
 }
 }

 if (selectedJobForFulfillment) {
 return (
 <FulfillmentForm
 job={selectedJobForFulfillment}
 items={items}
 customers={customers}
 transactions={transactions}
 jobs={jobs}
 operatorName={operatorName}
 onSuccess={() => {
 setSelectedJobForFulfillment(null);
 onSuccess();
 fetchJobs(true);
 }}
 onBack={() => setSelectedJobForFulfillment(null)}
 />
 );
 }

  return (
  <div className="min-h-screen bg-slate-50 pb-32 font-sans selection:bg-indigo-500/30">
  <div className="relative h-56 bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 overflow-hidden">
  {/* Abstract Background Patterns */}
  <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
    <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500 rounded-full mix-blend-screen filter blur-[80px] animate-pulse" style={{ animationDuration: '8s' }}></div>
    <div className="absolute top-10 -right-20 w-80 h-80 bg-violet-400 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }}></div>
  </div>

  <div className="relative px-4 pt-14 pb-24 flex flex-col gap-1 items-start max-w-4xl mx-auto z-10">
  <div className="mobile-row flex items-center justify-between w-full">
  <div className="flex items-center gap-4">
  <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 shadow-xl">
  <Truck size={24} strokeWidth={2.5} />
  </div>
  <div className="flex flex-col">
  <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-md">ระบบจัดการขนส่ง</h1>
  <p className="text-[12px] font-bold text-indigo-200 mt-0.5 tracking-wide uppercase">ศูนย์ควบคุมการขนส่ง</p>
  </div>
  </div>

  {/* 📍 Sync Status Badge (Glassmorphism) */}
  <div className="flex flex-col items-end gap-1.5">
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all duration-300 shadow-lg ${(loading || globalLoading) ? 'bg-amber-500/20 border-amber-400/30' : 'bg-emerald-500/20 border-emerald-400/30'}`}>
  <div className={`w-2 h-2 rounded-full animate-pulse ${(loading || globalLoading) ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'}`} />
  <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${(loading || globalLoading) ? 'text-amber-200' : 'text-emerald-100'}`}>
  {(loading || globalLoading) ? 'Syncing...' : 'Live'}
  {(loading || globalLoading) && <RefreshCw size={10} className="animate-spin" />}
  </span>
  </div>
  <div className="flex items-center gap-2">
  <p className="text-[9px] font-bold text-indigo-300/80 uppercase tracking-tighter">ล่าสุด: {lastSyncTime}</p>
  <button
  onClick={() => fetchJobs(true)}
  disabled={loading || globalLoading}
  className={`material-symbols-outlined text-[14px] text-indigo-200 hover:text-white transition-colors duration-200 ${(loading || globalLoading) ? 'animate-spin' : ''}`}
  >
  refresh
  </button>
  </div>
  </div>
  </div>
  <div className="flex flex-wrap gap-2 text-indigo-100 text-[10px] font-bold tracking-wider mt-4">
  <span className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
    <div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>
    ผู้ดำเนินการ: <span className="font-black">{operatorName}</span>
  </span>
  </div>
  </div>
  </div>

 {/* 🗂 Floating Tab Switcher */}
 <div className="flex justify-center -mt-8 px-4 relative z-20 max-w-4xl mx-auto w-full">
 <div className="bg-white/90 backdrop-blur-xl p-1.5 rounded-2xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center gap-1 w-full overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
 {[
 {
 id: 'waiting',
 label: 'รอรับงาน',
 icon: Clock,
 count: jobs.filter(isWaitingJob).length
 },
 {
 id: 'active',
 label: 'ดำเนินการ',
 icon: RefreshCw,
 count: jobs.filter(isActiveJob).length
 },
 {
 id: 'history',
 label: 'เสร็จสิ้น',
 icon: CheckCircle2,
 count: jobs.filter(isHistoryJob).length
 }
 ].map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-xl relative transition-all duration-300 overflow-hidden ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-[1.02]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600' }`}
 >
 <tab.icon size={18} className={`transition-colors duration-300 ${activeTab === tab.id ? 'text-indigo-100' : ''}`} />
 <span className="text-[11px] font-black tracking-wide">{tab.label}</span>
 {tab.count > 0 && activeTab !== tab.id && (
 <span className="absolute top-2 right-3 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce" style={{ animationIterationCount: 3 }}>
 {tab.count}
 </span>
 )}
 </button>
 ))}
 </div>
 </div>

 {/* 🚫 Cancel Job Dialog */}
 {cancelJobDialog && (
 <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
 <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
 <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mb-4 text-rose-600 mx-auto border border-rose-100">
 <AlertCircle size={32} />
 </div>
 <h3 className="text-xl font-black text-gray-800 text-center uppercase tracking-tight">ยกเลิกภารกิจกลางทาง</h3>
 <p className="text-gray-500 text-center text-[13px] font-bold mt-2 mb-6">กรุณาระบุเหตุผลที่ต้องยกเลิกงานนี้</p>
 
 <div className="space-y-2 mb-6">
 {["ติดต่อร้านค้าไม่สำเร็จ / โทรไม่ติด","ร้านค้าปิด / ไม่พบผู้รับสิ่งของ","รถเสีย / อุบัติเหตุระหว่างเดินทาง","ข้อมูลพิกัดร้านค้าไม่ถูกต้อง","เลิกงานเนื่องจากหมดเวลาปฏิบัติงาน"
 ].map((reason) => (
 <button
 key={reason}
 onClick={() => setCancelJobDialog({ ...cancelJobDialog, reason, isCustom: false })}
 className={`w-full py-4 px-5 rounded-xl text-[13px] font-black text-left border-2 mobile-row flex items-center justify-between group ${ cancelJobDialog.reason === reason && !cancelJobDialog.isCustom ? 'bg-rose-50 border-rose-500 text-rose-600' : 'bg-gray-50/50 border-gray-100 text-gray-500' }`}
 >
 <span className="truncate pr-4">{reason}</span>
 {cancelJobDialog.reason === reason && !cancelJobDialog.isCustom ? (
 <CheckCircle2 size={18} className="shrink-0" />
 ) : (
 <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
 )}
 </button>
 ))}
 <button
 onClick={() => setCancelJobDialog({ ...cancelJobDialog, reason: cancelJobDialog.isCustom ? cancelJobDialog.reason : '', isCustom: true })}
 className={`w-full py-4 px-5 rounded-xl text-[13px] font-black text-left border-2 mobile-row flex items-center justify-between group ${ cancelJobDialog.isCustom ? 'bg-rose-50 border-rose-500 text-rose-600' : 'bg-gray-50/50 border-gray-100 text-gray-500' }`}
 >
 <div className="flex items-center gap-2">
 <span className="truncate pr-4">อื่นๆ (ระบุเหตุผลเอง)</span>
 </div>
 {cancelJobDialog.isCustom ? (
 <FileText size={18} className="shrink-0" />
 ) : (
 <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
 )}
 </button>
 </div>

 {cancelJobDialog.isCustom && (
 <div className="mb-6">
 <textarea
 className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-sm font-bold text-slate-700 focus:border-rose-500 focus:bg-white outline-none placeholder:text-slate-300"
 placeholder="พิมพ์เหตุผลที่ต้องการยกเลิกที่นี่..."
 rows={3}
 value={cancelJobDialog.reason}
 onChange={(e) => setCancelJobDialog({ ...cancelJobDialog, reason: e.target.value })}
 autoFocus
 />
 </div>
 )}

 <div className="flex gap-3">
 <button
 onClick={() => setCancelJobDialog(null)}
 className="flex-1 h-14 bg-gray-100 text-gray-400 font-black text-[13px] uppercase tracking-widest rounded-2xl"
 >
 ย้อนกลับ
 </button>
 <button
 onClick={handleCancelJob}
 disabled={!cancelJobDialog.reason.trim() || !!actionLoading}
 className="btn no-animation flex-[1.5] h-14 bg-rose-600 text-white font-black text-[13px] uppercase tracking-widest rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
 >
 {actionLoading ? <RefreshCw size={18} className="" /> : <XCircle size={18} />}
 <span>{actionLoading ? 'กำลังส่ง...' : 'ยืนยันยกเลิก'}</span>
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Task List Container */}
 <div className="p-3 space-y-4 max-w-4xl mx-auto w-full">
 {/* Asset Tag Lookup */}
 <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
 <div className="mobile-row flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <QrCode size={16} className="text-slate-500" />
 <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">ค้นหารหัสเครื่อง</p>
 </div>
 <span className="text-[9px] text-slate-400 font-bold">S/N หรือ Asset Tag</span>
 </div>
 <div className="flex items-center gap-2">
  <input
  type="text"
  value={assetQuery}
  onChange={(e) => setAssetQuery(e.target.value)}
  onKeyDown={(e) => { if (e.key === 'Enter') handleAssetLookup(); }}
  placeholder="เช่น AST-... หรือ SN..."
  className="flex-1 h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[13px] font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300"
  />
  <button
  onClick={handleAssetLookup}
  disabled={assetLoading}
  className="btn no-animation h-12 px-5 bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 rounded-xl text-[11px] font-black uppercase tracking-wider disabled:opacity-50 transition-all duration-300"
  >
 {assetLoading ? 'ค้นหา...' : 'ค้นหา'}
 </button>
 </div>
 {assetError && <p className="text-[11px] font-bold text-rose-600">{assetError}</p>}
 {assetResults.length > 0 && (
 <div className="space-y-2 max-h-56 overflow-auto">
 {assetResults.map((u: any) => (
 <div key={u.id || u.assetTag} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
 <div className="mobile-row flex items-center justify-between gap-2">
 <p className="text-[11px] font-black text-slate-800">{u.assetTag || '-'}</p>
 <span className="text-[10px] font-black text-indigo-600">{mapAssetStatusLabel(u.status)}</span>
 </div>
 <p className="text-[10px] text-slate-500 font-bold">{u.itemName || '-'} {u.category ? `(${u.category})` : ''}</p>
 <p className="text-[10px] text-slate-500 font-bold">คลัง: {u.warehouseName || '-'} • ลูกค้า: {u.holderCustomerCv || '-'}</p>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Search Bar Overlay */}
 <div className="relative group w-full flex items-center gap-2">
 <div className="relative flex-1 group">
 <Search size={18} className="absolute left-6 top-1/2 text-slate-300 group-focus-within:text-indigo-600" />
  <input
  type="text"
  placeholder="ค้นหาตามเลขที่งานหรือชื่อลูกค้า..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="w-full h-14 bg-white border border-slate-200 hover:border-slate-300 rounded-full pl-16 pr-6 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300 placeholder:text-slate-300 shadow-sm"
  />
 </div>
  <button className="btn no-animation h-14 px-8 bg-slate-900 text-white hover:bg-black rounded-full flex items-center justify-center gap-2 font-black text-[13px] uppercase shrink-0 transition-colors duration-300 shadow-md">
  <Search size={18} />
  <span>ค้นหา</span>
  </button>
 </div>

 {filteredJobs.length === 0 ? (
 <div className="py-6 flex flex-col items-center justify-center text-center opacity-30 select-none">
 <Package size={80} strokeWidth={1} className="mb-4 text-slate-300" />
 <h3 className="text-xl font-black text-slate-900 leading-tight">ไม่มีรายการค้างในขณะนี้</h3>
 <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">ข้อมูลอัปเดตเป็นปัจจุบันแล้ว</p>
 </div>
 ) : (
 filteredJobs.map((job) => {
 const customer = getCustomer(job.cv);

 return (
 <div
 key={job.jobId}
 onClick={() => setExpandedJobId(expandedJobId === job.jobId ? null : job.jobId)}
 className={`bg-white border border-slate-200 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] ${expandedJobId === job.jobId ? 'ring-2 ring-indigo-500/20 shadow-xl' : 'shadow-sm'}`}
 >
 {/* Visual Status Bar */}
 <div className={`h-1.5 w-full bg-gradient-to-r ${job.status?.includes('หน้าร้าน') ? 'from-purple-500 to-fuchsia-500' : job.status?.includes('เดินทาง') ? 'from-teal-400 to-emerald-500' : job.status?.includes('เบิกออก') ? 'from-amber-400 to-orange-500' : 'from-indigo-500 to-violet-500' }`} />

 <div className="p-4">
 <div className="flex justify-between items-start mb-3 gap-3">
 <div className="flex-1 min-w-0 pr-3">
 <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
 <span className="px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded-md">
 #{job.jobId}
 </span>
 <span className={`px-2 py-0.5 text-[9px] font-black rounded-md border ${job.status?.includes('หน้าร้าน') ? 'bg-purple-50 text-purple-600 border-purple-100' : job.status?.includes('เดินทาง') ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : job.status?.includes('เบิกออก') ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100' }`}>
 {job.status === 'PENDING' ? 'รอรับงาน' : (job.status || 'รอรับงาน')}
 </span>
 {(() => {
 const { totalSend, totalReturn } = aggregateJobItems(job.items);
 if (totalSend > 0 && totalReturn > 0) {
 return (
 <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-md flex items-center gap-1">
 <Truck size={8} /> <Navigation size={8} /> MIXED
 </span>
 );
 }
 return null;
 })()}
 </div>
 <h3 className="text-[16px] font-black text-slate-800 tracking-tight leading-tight uppercase truncate">
 {job.customerName || customer?.name || job.cv || 'ไม่ทราบชื่อ'}
 </h3>
 {(job.customerPhone || customer?.phone) && (
 <p className="text-[10px] font-black text-indigo-500 mt-1 flex items-center gap-1">
 <span className="material-symbols-outlined text-[13px]">call</span>
 {job.customerPhone || customer?.phone}
 </p>
 )}
 <div className="flex items-center gap-2 mt-2">
 <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300 shrink-0">
 <MapPin size={14} />
 </div>
 <p className="text-[11px] font-bold text-slate-400 leading-snug truncate">
 {customer ? [customer.address, customer.sub_district, customer.district, customer.province].filter(Boolean).join(' ') : 'No location data'}
 </p>
 </div>
 </div>

 <div className="flex flex-col items-end gap-2 shrink-0">
 {(job.appointmentDate || job.appointment_date) ? (
 <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-100/50">
 <Clock size={12} className="text-amber-500" />
 <div className="flex flex-col items-end">
 <p className="text-[8px] font-black text-amber-500 uppercase tracking-tighter leading-none mb-0.5">เวลานัดหมาย</p>
 <p className="text-[11px] font-black text-slate-700 leading-none">
 {formatThaiDateTime(job.appointmentDate || job.appointment_date).split('•')[0]}
 </p>
 <p className="text-[10px] font-black text-amber-600 leading-none mt-0.5">
 {formatThaiDateTime(job.appointmentDate || job.appointment_date).split('•')[1] || ''}
 </p>
 </div>
 </div>
 ) : (
 <div className="w-10 h-10" /> 
 )}

 <button
 onClick={(e) => {
 e.stopPropagation();
 const query = customer ?`${customer.latitude},${customer.longitude}` : job.cv;
 window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
 }}
 className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100"
 >
 <Map size={18} />
 </button>
 </div>
 </div>

 <div className="h-px w-full bg-slate-50 my-3" />

 <div className="grid grid-cols-2 gap-3 mb-4">
 {(() => {
 const { totalSend, totalReturn } = aggregateJobItems(job.items, job.status);
 return (
 <>
 <div className="bg-slate-50/50 p-3 rounded-2xl border border-white flex flex-col gap-0.5 relative overflow-hidden group/mini">
 <Truck size={24} className="absolute -bottom-1 -right-1 text-indigo-900 opacity-[0.03]" />
 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">ส่งพัสดุ</p>
 <p className="text-[15px] font-black text-slate-900 leading-none">{totalSend}</p>
 </div>
 <div className="bg-slate-50/50 p-3 rounded-2xl border border-white flex flex-col gap-0.5 relative overflow-hidden group/mini">
 <History size={24} className="absolute -bottom-1 -right-1 text-purple-900 opacity-[0.03]" />
 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">รับคืน</p>
 <p className="text-[15px] font-black text-slate-900 leading-none">{totalReturn}</p>
 </div>
 </>
 );
 })()}
 </div>

 {job.note && (
 <div className="mx-5 mb-5 p-4 bg-indigo-50/20 rounded-3xl border border-indigo-100/30 relative overflow-hidden">
 <div className="flex items-center gap-2 mb-1.5">
 <FileText size={12} className="text-indigo-400 opacity-70" />
 <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] opacity-80">บันทึกเพิ่มเติม</span>
 </div>
 <p className="text-[12px] font-bold text-slate-600 italic leading-relaxed">"{job.note}"
 </p>
 </div>
 )}

 {expandedJobId === job.jobId && (
 <div className="px-4 pb-4 border-t border-slate-50 pt-4 mt-1">
 <div className="mobile-row flex items-center justify-between mb-3 px-1">
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">รายการพัสดุ</p>
 <ChevronRight size={14} className="rotate-90 text-slate-300" />
 </div>
 <div className="space-y-2">
 {(() => {
 const { allAggregated } = aggregateJobItems(job.items, job.status);
 
 // 🪄 UI AGGREGATION: Group non-freezer items
 const displayGroups: any[] = [];
 const otherGroups: Record<string, any> = {};

 allAggregated.forEach((agg: any) => {
 const it = agg.it;
 const fullItem = items.find(m => Number(m.id) === Number(it.rowIndex || it.item_id));
 const displayItem = fullItem ? { ...fullItem, ...it } : it;
 const { main, meta } = formatItemName(displayItem, { hideCondition: agg.category === 'RETURN' });
 const isFreezer = main.includes('ตู้แช่') || meta.includes('ตู้แช่');

 if (isFreezer) {
 // 🧊 Freezers stay separate
 displayGroups.push({ ...agg, main, meta, isGrouped: false });
 } else {
 // 📦 Others are grouped by name + type
 const groupKey =`${main}-${meta}-${agg.action_type}-${agg.category}`;
 if (!otherGroups[groupKey]) {
 otherGroups[groupKey] = { ...agg, main, meta, isGrouped: true, qty: 0 };
 }
 otherGroups[groupKey].qty += (agg.action > 0 ? agg.action : agg.plan);
 }
 });

 const finalDisplayItems = [...displayGroups, ...Object.values(otherGroups)];
 
 // 🎨 Layout Arrangement: Group SEND first, then RETURN
 finalDisplayItems.sort((a, b) => {
 if (a.category === b.category) return a.main.localeCompare(b.main);
 return a.category === 'SEND' ? -1 : 1;
 });

 return finalDisplayItems.map((agg: any, i: number) => {
 const { main, meta, isGrouped, qty } = agg;
 const finalQty = isGrouped ? qty : (agg.action > 0 ? agg.action : agg.plan);
 const hasDetails = agg.detailsList.some((d: any) => d.serial_number || d.serialNumber || d.return_reason);

 return (
 <div key={i} className="flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100 group/item">
 <div className="mobile-row flex items-center justify-between">
 <div className="flex items-center gap-3 min-w-0 flex-1">
 <div className={`w-1.5 h-6 rounded-full ${agg.category === 'RETURN' ? 'bg-rose-500' : (agg.category === 'SEND' ? 'bg-indigo-500' : 'bg-slate-300')} shrink-0`} />
 <div className="min-w-0">
 <p className="text-[12px] font-black text-slate-800 uppercase leading-none truncate pr-2">
 <span className={agg.category === 'RETURN' ? 'text-rose-600' : (agg.category === 'SEND' ? 'text-indigo-600' : 'text-slate-500')}>[{agg.action_type || 'พัสดุ'}]</span> {main} {meta !== '-' ? meta : ''}
 </p>
 </div>
 </div>
 <div className="bg-white text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 font-black text-[11px] shrink-0">
 {finalQty}
 </div>
 </div>

 {hasDetails && !isGrouped && (
 <div className="mt-2.5 pt-2 border-t border-slate-100 ml-4 space-y-1">
 {(() => {
 const uniqueDetails = agg.detailsList.reduce((acc: any[], d: any) => {
 const sn = d.serial_number || d.serialNumber || '';
 const reason = d.return_reason || '';
 const key =`${sn}-${reason}`;
 if (!acc.find(v => v.key === key)) acc.push({ key, sn, reason });
 return acc;
 }, []);

 return uniqueDetails.map((v: any, idx: number) => {
 if (!v.sn && !v.reason) return null;
 return (
 <div key={idx} className="mobile-row flex items-center justify-between text-[11px]">
 <span className="text-slate-500 font-bold">
 {v.sn ? <>SN: <span className="text-slate-800 font-black">{v.sn}</span></> : <span className="text-slate-400 italic">ไม่มี S/N</span>}
 </span>
 {v.reason && <span className="text-slate-500 italic text-[10px] ml-2 text-right">"{v.reason}"</span>}
 </div>
 );
 });
 })()}
 </div>
 )}
 </div>
 );
 });
 })()}
 </div>
 </div>
 )}

 {/* Dynamic Action Button */}
 <div className="flex gap-2">
 {activeTab === 'waiting' && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleUpdateStatus(job, 'ACCEPTED', 'status_only');
 }}
 disabled={!!actionLoading}
 className="relative w-full h-14 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl mobile-row flex items-center justify-between px-2 font-black text-[13px] uppercase tracking-[0.1em] overflow-hidden disabled:opacity-70 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 group"
 >
 <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
 <span className="pl-6 relative z-10">{actionLoading === job.jobId ? 'กำลังโหลด...' : 'รับงาน'}</span>
 <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white relative z-10 border border-white/30 shadow-inner group-hover:scale-110 transition-transform duration-300">
 {actionLoading === job.jobId ? <RefreshCw size={18} className="animate-spin" /> : <Truck size={18} strokeWidth={2.5} />}
 </div>
 </button>
 )}

 {activeTab === 'active' && (
 <div className="flex flex-col gap-2 w-full">
 {(() => {
 const jobStatus = String(job.status ||"").toUpperCase();

 const isIssued =
 jobStatus.includes('เบิกออก') ||
 jobStatus.includes('กำลังไปส่ง') ||
 jobStatus.includes('กำลังเดินทาง') ||
 jobStatus.includes('ถึงหน้าร้าน') ||
 jobStatus.includes('ถึงเครื่อง') ||
 jobStatus.includes('รับคืน') ||
 jobStatus.includes('OFFICE') ||
 jobStatus.includes('รอตรวจ') ||
 jobStatus.includes('ตรวจสอบ');

 const isReturned =
 jobStatus.includes('รับจากร้าน') ||
 jobStatus.includes('รับคืนสำเร็จ') ||
 jobStatus.includes('คืนของแล้ว') ||
 jobStatus.includes('กำลังเดินทางกลับ') ||
 jobStatus.includes('เสร็จสิ้น') ||
 jobStatus.includes('รอตรวจสภาพ') ||
 jobStatus.includes('ถึงออฟฟิศ');

 const deliveryItems = job.items?.filter((it: any) => {
 const action = String(it.action_type || it.action ||"").toUpperCase();
 return ['ISSUE', 'DELIVERY', 'BORROW', 'TRANSFER_OUT', 'แจ้งส่ง', 'ส่ง'].some(k => action.includes(k));
 }) || [];

 const returnItems = job.items?.filter((it: any) => {
 const action = String(it.action_type || it.action ||"").toUpperCase();
 return ['RETURN', 'RECEIVE', 'แจ้งคืน', 'รับคืน', 'คืน'].some(k => action.includes(k));
 }) || [];

const hasDelivery = deliveryItems.length > 0;
const hasReturn = returnItems.length > 0;
const plannedDeliveryQty = deliveryItems.reduce((sum: number, it: any) => sum + Number(it.quantity || it.จำนวน || 1), 0);
const issuedDeliveryQty = (job.items || [])
.filter((it: any) => {
 const action = String(it.action_type || it.action || '').toUpperCase();
 return (action.includes('เบิกออก') || action === 'ISSUE') && !action.includes('REQUEST');
})
.reduce((sum: number, it: any) => sum + Number(it.quantity || it.จำนวน || 1), 0);
const hasUnissuedDelivery = plannedDeliveryQty > issuedDeliveryQty;

const hasPendingPlans = job.items?.some((it: any) => 
['แจ้งส่ง', 'แจ้งคืน', 'ISSUE_REQUEST', 'RETURN_REQUEST'].includes(String(it.action_type || it.action || '').toUpperCase())
);

 const isHandedOver = 
 (jobStatus.includes('รอตรวจ') || 
 jobStatus.includes('ตรวจสอบ') ||
 jobStatus.includes('เดินทางกลับ') ||
 jobStatus.includes('รับคืนจากร้าน') ||
 job.items?.some((it: any) => {
 const at = String(it.action_type || it.status ||"").toUpperCase();
 return at.includes('รอตรวจ') || at.includes('ตรวจสอบ') || at.includes('รับคืนจากร้าน');
 })) && !hasPendingPlans;

 if (isHandedOver) {
 return (
 <div className="w-full h-12 bg-indigo-50/50 text-indigo-600 rounded-full mobile-row flex items-center justify-between px-6 font-black text-[12px] uppercase tracking-[0.1em] border border-indigo-100">
 <div className="flex items-center gap-3">
 <RefreshCw size={16} className="" />
 <div className="flex flex-col">
 <span className="leading-tight">ออฟฟิศกำลังตรวจสอบ...</span>
 <span className="text-[8px] opacity-60 font-medium lowercase tracking-normal italic">Waiting for admin...</span>
 </div>
 </div>
 <ShieldCheck size={18} className="text-indigo-400" />
 </div>
 );
 }

 const isArrived = 
 jobStatus.includes('ถึงหน้าร้าน') || 
 jobStatus.includes('ARRIVED') || 
 jobStatus.includes('ถึงเครื่อง') ||
 jobStatus.includes('รับคืน') ||
 jobStatus.includes('เดินทางกลับ');

 if (hasDelivery && !isIssued && !isArrived) {
 return (
 <button
 onClick={(e) => {
 e.stopPropagation();
 onNavigateToTab('issue', job.jobId);
 }}
 className="relative w-full h-12 bg-amber-500 text-white rounded-full mobile-row flex items-center justify-between px-1.5 font-black text-[13px] uppercase tracking-[0.05em] group overflow-hidden border border-amber-400"
 >
 <div className="absolute inset-0"></div>
 <span className="pl-5 relative z-10">เบิกพัสดุอุปกรณ์</span>
 <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white relative z-10">
 <Package size={16} strokeWidth={2.5} />
 </div>
 </button>
 );
 }

if (isArrived) {
return (
<button
onClick={(e) => {
e.stopPropagation();
if (hasUnissuedDelivery) {
onNavigateToTab('issue', job.jobId);
} else {
setSelectedJobForFulfillment(job);
}
}}
className={`relative w-full h-12 ${hasUnissuedDelivery ? 'bg-amber-600 border-amber-500' : 'bg-rose-600 border-rose-500'} text-white rounded-full mobile-row flex items-center justify-between px-1.5 font-black text-[13px] uppercase tracking-[0.05em] group overflow-hidden border`}
>
<div className="absolute inset-0"></div>
<span className="pl-5 relative z-10">{hasUnissuedDelivery ? 'ต้องเบิกพัสดุก่อน' : 'บันทึกการส่งมอบ / รับคืน'}</span>
<div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white relative z-10">
{hasUnissuedDelivery ? <Package size={16} strokeWidth={2.5} /> : <CheckCircle2 size={16} strokeWidth={2.5} />}
</div>
</button>
);
}

 if ((isIssued || jobStatus === 'ACCEPTED') && !isArrived) {
 return (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleUpdateStatus(job, 'ARRIVED', 'status_only');
 }}
 disabled={!!actionLoading}
 className="relative w-full h-12 bg-emerald-600 text-white rounded-full mobile-row flex items-center justify-between px-1.5 font-black text-[13px] uppercase tracking-[0.08em] group overflow-hidden border border-emerald-500 disabled:opacity-75"
 >
 <div className="absolute inset-0"></div>
 <span className="pl-5 relative z-10">{actionLoading === job.jobId ? 'กำลังโหลด...' : 'ถึงหน้าร้านแล้ว'}</span>
 <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white relative z-10">
 <MapPin size={16} strokeWidth={2.5} />
 </div>
 </button>
 );
 }

 if (hasReturn && !isReturned) {
 return (
 <button
 onClick={(e) => {
 e.stopPropagation();
 onNavigateToTab('return', job.jobId);
 }}
 className="relative w-full h-12 bg-purple-600 text-white rounded-full mobile-row flex items-center justify-between px-1.5 font-black text-[13px] uppercase tracking-[0.05em] group overflow-hidden border border-purple-500"
 >
 <div className="absolute inset-0"></div>
 <span className="pl-5 relative z-10">รับพัสดุคืน</span>
 <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white relative z-10">
 <ArrowRight size={16} strokeWidth={2.5} />
 </div>
 </button>
 );
 }
 })()}
 
 <button
 onClick={(e) => {
 e.stopPropagation();
 setCancelJobDialog({ jobId: job.jobId, reason: '' });
 }}
 className="w-full mt-2 py-3 text-rose-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-dashed border-rose-100 flex items-center justify-center gap-2"
 >
 <XCircle size={14} />
 <span>ยกเลิกภารกิจกลางทาง</span>
 </button>
 </div>
 )}

 {activeTab === 'history' && (() => {
 const itemInspectionMap: Record<string, boolean> = {};
 job.items?.forEach((it: any) => {
 const status = String(it.action_type || it.status ||"").toUpperCase();
 const isInspected = status.includes('ตรวจสอบแล้ว') || status.includes('อนุมัติ') || status.includes('CHECKED') || status.includes('สำเร็จ');
 const isReturn = isInspected || ['คืน', 'RETURN', 'RECEIVE', 'รอตรวจ'].some(k => status.includes(k));
 
 const itemId = String(it.rowIndex || it.item_id || it.id);
 if (isReturn) {
 itemInspectionMap[itemId] = itemInspectionMap[itemId] || isInspected;
 }
 });

 const jobStatus = String(job.status ||"").toUpperCase();
 const hasUninspectedItems = Object.values(itemInspectionMap).some(inspected => !inspected) && (jobStatus.includes('คืน') || jobStatus.includes('ออฟฟิศ'));

 if (hasUninspectedItems) {
 return (
 <div className="relative w-full h-12 bg-indigo-50/50 rounded-2xl border border-indigo-100 mobile-row flex items-center justify-between px-2 group overflow-hidden">
 <div className="absolute -left-1 -top-1 w-20 h-20 bg-indigo-400/5" />
 <span className="pl-4 text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-3 relative z-10">
 <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-indigo-500 border border-indigo-50/50">
 <RefreshCw size={14} className="" />
 </div>
 กำลังตรวจสอบสินค้า
 </span>
 <div className="h-8 px-3.5 rounded-xl bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider flex items-center justify-center relative z-10">
 Wait Review
 </div>
 </div>
 );
 }

 return (
 <div className="relative w-full h-12 bg-emerald-50/50 rounded-2xl border border-emerald-100 mobile-row flex items-center justify-between px-2 group overflow-hidden">
 <div className="absolute -left-1 -top-1 w-20 h-20 bg-emerald-400/5" />
 <span className="pl-4 text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-3 relative z-10">
 <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-emerald-500 border border-emerald-50/50">
 <ShieldCheck size={16} />
 </div>
 เสร็จสมบูรณ์
 </span>
 <div className="h-8 px-3.5 rounded-xl bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider flex items-center justify-center relative z-10">
 Verified
 </div>
 </div>
 );
 })()}
 </div>
 </div>

 <div className="px-4 py-3 bg-slate-50/50 mobile-row flex items-center justify-between text-[9px] font-bold text-slate-400">
 <div className="flex items-center gap-2">
 <Clock size={10} />
 <span>{formatThaiDateTime(job.createdAt)}</span>
 </div>
 <span className="text-slate-500">{job.operator}</span>
 </div>
 </div>
 );
 })
 )}
 </div>


 
 <style>{`
 ::-webkit-scrollbar {
 width: 0px;
 background: transparent;
 }`}</style>
 </div>
 );
};

export default LogisticsDashboard;
