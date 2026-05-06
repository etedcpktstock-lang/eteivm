import { useState, useMemo } from 'react';
import { Search, ShieldAlert, BadgeCheck, FileText, Filter, User as UserIcon, Package, Clock, ArrowRight, ArrowLeft, X, RefreshCw } from 'lucide-react';
import type { Transaction, User } from '../../types';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';

interface Props {
 transactions: Transaction[];
 user: User;
}

export default function AuditLog({ transactions, user }: Props) {
 const [searchTerm, setSearchTerm] = useState('');
 const [filterAction, setFilterAction] = useState<string>('ALL');

 const filteredLogs = useMemo(() => {
 let logs = [...transactions].sort((a,b) => new Date(b['วัน-เวลา']).getTime() - new Date(a['วัน-เวลา']).getTime());
 
 if (searchTerm) {
 const lower = searchTerm.toLowerCase();
 logs = logs.filter(tx => 
 String(tx['ผู้ทำรายการ']||'').toLowerCase().includes(lower) ||
 String(tx['เลขที่รายการ']||'').toLowerCase().includes(lower) ||
 String(tx['รายการ']||'').toLowerCase().includes(lower) ||
 String(tx['หมายเหตุ']||'').toLowerCase().includes(lower)
 );
 }

 if (filterAction !== 'ALL') {
 logs = logs.filter(tx => {
 const status = String(tx['สถานะ']||'').toUpperCase();
 const actionType = String(tx['รายการ']||'');
 
 if (filterAction === 'ISSUE') return status.includes('เบิก') || status.includes('ISSUE');
 if (filterAction === 'RETURN') return status.includes('เข้า') || status.includes('คืน') || status.includes('RETURN') || status.includes('RECEIVE');
 if (filterAction === 'VOID') return status.includes('ยกเลิก') || status.includes('VOID');
 if (filterAction === 'REPAIR') return status.includes('ซ่อม') || status.includes('REPAIR');
 
 return true;
 });
 }

 return logs;
 }, [transactions, searchTerm, filterAction]);

 const normalizedRole = String(user.role || '').toLowerCase();
 const canViewAudit = normalizedRole === 'admin' || normalizedRole === 'manager' || normalizedRole === 'super_admin' || normalizedRole.includes('admin');

 if (!canViewAudit) {
 return (
 <div className="p-6 text-center bg-rose-50 text-rose-500 rounded-[3rem] m-6 border border-rose-100">
 <ShieldAlert size={64} className="mx-auto mb-6 opacity-30" />
 <h2 className="text-2xl font-black uppercase tracking-widest mb-2">Access Denied</h2>
 <p className="text-sm font-medium">หน้านี้สงวนไว้สำหรับผู้ดูแลระบบ (Admin/Manager) เท่านั้น</p>
 </div>
 );
 }

 return (
 <div className="max-w-[1200px] mx-auto py-6 pb-32 px-4 space-y-4">
 
 {/* HEADER & SUMMARY SECTION */}
 <div className="bg-white/90 p-8 rounded-[3.5rem] border border-slate-100 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3"></div>
 <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500/5 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/4"></div>
 
 <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
 <div className="flex items-center gap-4">
 <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center text-white">
 <BadgeCheck size={32} />
 </div>
 <div>
 <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase mb-2">Audit Logs</h1>
 <div className="flex items-center gap-2">
 <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
 <p className="text-[12px] font-black text-indigo-500 uppercase tracking-[0.2em] leading-none">Real-time System Traceability</p>
 </div>
 </div>
 </div>
 
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full lg:w-auto">
 <div className="bg-slate-50/50 px-6 py-4 rounded-3xl border border-slate-100 flex flex-col items-center justify-center min-w-[120px]">
 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Logs</span>
 <span className="text-2xl font-black text-slate-800 leading-none">{filteredLogs.length}</span>
 </div>
 <div className="bg-orange-50/50 px-6 py-4 rounded-3xl border border-orange-100 flex flex-col items-center justify-center min-w-[120px]">
 <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Today</span>
 <span className="text-2xl font-black text-orange-600 leading-none">
 {transactions.filter(t => new Date(t['วัน-เวลา']).toDateString() === new Date().toDateString()).length}
 </span>
 </div>
 <div className="hidden md:flex bg-rose-50/50 px-6 py-4 rounded-3xl border border-rose-100 flex-col items-center justify-center min-w-[120px]">
 <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Voids</span>
 <span className="text-2xl font-black text-rose-600 leading-none">
 {transactions.filter(t => String(t['สถานะ']||'').includes('ยกเลิก')).length}
 </span>
 </div>
 </div>
 </div>
 </div>

 {/* FILTER CONTROLS */}
 <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
 <div className="md:col-span-8 relative">
 <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
 <input
 type="text"
 placeholder="ค้นหาพนักงาน, เลขรายการ, พัสดุ, หรือหมายเหตุ..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full h-16 bg-white border border-slate-200 rounded-xl pl-16 pr-14 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500"
 />
 {searchTerm && (
 <button onClick={() => setSearchTerm('')} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400">
 <X size={20} />
 </button>
 )}
 </div>
 <div className="md:col-span-4 relative">
 <Filter className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
 <select
 value={filterAction}
 onChange={(e) => setFilterAction(e.target.value)}
 className="w-full h-16 bg-white border border-slate-200 rounded-xl pl-14 pr-6 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 appearance-none"
 >
 <option value="ALL">ทุกประเภทรายการ (All Activity)</option>
 <option value="ISSUE">เบิกออก (Issue/Delivery)</option>
 <option value="RETURN">รับเข้า/คืน (Return/Receive)</option>
 <option value="REPAIR">ปรับปรุงสภาพ (Repair/Stock)</option>
 <option value="VOID">ยกเลิก (Void)</option>
 </select>
 </div>
 </div>

 {/* LOG STREAM */}
 <div className="space-y-4">
 {filteredLogs.slice(0, 100).map((log, idx) => {
 const action = String(log['สถานะ']||'');
 let colorStr ="bg-slate-50 text-slate-600 border-slate-200";
 let IconCmp = FileText;
 
 if (action.includes('เบิก') || action.includes('ISSUE')) { colorStr ="bg-orange-50 text-orange-600 border-orange-100"; IconCmp = ArrowRight; }
 if (action.includes('เข้า') || action.includes('คืน') || action.includes('RETURN')) { colorStr ="bg-emerald-50 text-emerald-600 border-emerald-100"; IconCmp = ArrowLeft; }
 if (action.includes('ยกเลิก') || action.includes('VOID')) { colorStr ="bg-rose-50 text-rose-600 border-rose-100"; IconCmp = X; }
 if (action.includes('ซ่อม') || action.includes('ปรับปรุง') || action.includes('สต๊อก')) { colorStr ="bg-indigo-50 text-indigo-600 border-indigo-100"; IconCmp = RefreshCw; }

 return (
 <div key={log.id || idx} className="bg-white p-5 rounded-xl border border-slate-100 flex flex-col md:flex-row justify-between gap-4 group">
 {/* LEFT SIDE: Identity & Type */}
 <div className="flex items-center gap-4 min-w-[250px]">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${colorStr}`}>
 <IconCmp size={20} />
 </div>
 <div className="space-y-1">
 <p className="text-[13px] font-black text-slate-800 tracking-tight leading-none uppercase">{log['ผู้ทำรายการ'] || 'Unknown User'}</p>
 <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{action || 'UNKNOWN'}</p>
 </div>
 </div>
 
 {/* CENTER SIDE: Details */}
 <div className="flex-1 px-4 md:border-l border-slate-100 flex flex-col justify-center">
 <p className="text-sm font-bold text-slate-700 leading-tight">
 {log['รายการ']} <span className="text-slate-400 font-medium">({log['ประเภท']} / {log['ขนาด']})</span>
 </p>
 <div className="flex flex-wrap gap-2 mt-2">
 {log['จำนวน'] && (
 <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest">QTY: {log['จำนวน']}</span>
 )}
 {log.serial_number && (
 <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg text-[10px] font-black tracking-tighter">S/N: {log.serial_number}</span>
 )}
 {log.CV && (
 <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest">CV: {log.CV}</span>
 )}
 </div>
 </div>

 {/* RIGHT SIDE: Timing & TxnNo */}
 <div className="shrink-0 flex md:flex-col justify-between items-end gap-2 text-right">
 <div className="space-y-1 text-right">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">เลขอ้างอิง</p>
 <p className="text-[12px] font-mono font-black text-slate-800">{log['เลขที่รายการ'] || '-'}</p>
 </div>
 <div className="space-y-1 text-right">
 <p className="text-[11px] font-bold text-slate-500 flex items-center justify-end gap-1"><Clock size={12}/> {formatThaiDateTime(log['วัน-เวลา']).split(' ')[1]}</p>
 <p className="text-[9px] font-medium text-slate-400">{formatThaiDateTime(log['วัน-เวลา']).split(' ')[0]}</p>
 </div>
 </div>
 </div>
 );
 })}
 {filteredLogs.length > 100 && (
 <div className="text-center py-8">
 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">แสดง 100 รายการล่าสุด (พบทั้งหมด {filteredLogs.length} รายการ)</p>
 </div>
 )}
 {filteredLogs.length === 0 && (
 <div className="text-center py-6 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
 <Search size={48} className="mx-auto text-slate-300 mb-4" />
 <p className="text-slate-500 font-medium">ไม่พบประวัติการทำรายการที่ตรงกับเงื่อนไข</p>
 </div>
 )}
 </div>
 </div>
 );
}
