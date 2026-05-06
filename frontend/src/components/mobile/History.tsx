import { useState, useMemo } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import type { Transaction, User, Customer } from '../../types';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import { ImageLightbox } from '../shared/CommonUI';

const getDriveDirectLink = (url: string) => {
 if (!url) return '';
 const cleanUrl = url.trim();
 const match = cleanUrl.match(/\/d\/(.*?)(?:\/|\?|$)/);
 if (match && match[1]) {
 return`https://drive.google.com/thumbnail?id=${match[1]}&sz=w256-h256`;
 }
 return cleanUrl.replace("/view?usp=drivesdk","").replace("file/d/","uc?id=");
};

interface Props {
 transactions: Transaction[];
 user: User;
 customers: Customer[];
 onRefresh?: () => void;
 onVoid?: (txnNo: string) => void;
}

export default function History({ transactions, user, customers, onRefresh, onVoid }: Props) {
 const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
 const [pageSize, setPageSize] = useState<number>(30);
 const [currentPage, setCurrentPage] = useState<number>(1);
 const [searchTerm, setSearchTerm] = useState('');
 const [userInput, setUserInput] = useState('');
 const [isSearching, setIsSearching] = useState(false);
 const [selectedImage, setSelectedImage] = useState<string | null>(null);

 const toggleGroup = (txnNo: string) => {
 setExpandedGroups(prev => {
 const next = new Set(prev);
 if (next.has(txnNo)) next.delete(txnNo);
 else next.add(txnNo);
 return next;
 });
 };

 const expandAll = (visibleItems: Transaction[][]) => {
 const allIds = visibleItems.map(group => {
 const first = group[0];
 return String(first['เลขที่รายการ'] || '');
 }).filter(Boolean);
 setExpandedGroups(new Set(allIds));
 };

 const collapseAll = () => {
 setExpandedGroups(new Set());
 };

 const handleSearch = async (e?: React.FormEvent) => {
 if (e) e.preventDefault();
 const term = userInput.trim();
 setSearchTerm(term);
 setCurrentPage(1);

 const termLower = term.toLowerCase();
 const baseTransactions = user.role.toLowerCase() === 'staff'
 ? transactions.filter(tx => tx['ผู้ทำรายการ'] === user.name)
 : transactions;

 const localMatches = baseTransactions.filter(tx =>
 Object.values(tx).some(v => String(v).toLowerCase().includes(termLower))
 );

 if (term && localMatches.length === 0 && onRefresh) {
 setIsSearching(true);
 try {
 await onRefresh();
 } finally {
 setTimeout(() => setIsSearching(false), 800);
 }
 }
 };


 const filteredTransactions = useMemo(() => {
 let baseTransactions = transactions;
 if (user.role.toLowerCase() === 'staff') {
 baseTransactions = transactions.filter(tx => tx['ผู้ทำรายการ'] === user.name);
 }
 const term = userInput.toLowerCase();
 if (!term) return baseTransactions;
 return baseTransactions.filter(tx =>
 Object.values(tx).some(v => String(v).toLowerCase().includes(term))
 );
 }, [transactions, userInput, user.role, user.name]);

 const groupedTransactions = useMemo(() => {
 if (!filteredTransactions.length) return [];

 const sorted = [...filteredTransactions]
 .sort((a, b) => {
 const timeA = new Date(a['วัน-เวลา']).getTime();
 const timeB = new Date(b['วัน-เวลา']).getTime();
 if (isNaN(timeA) || isNaN(timeB)) {
 return String(b['เลขที่รายการ'] || '').localeCompare(String(a['เลขที่รายการ'] || ''), undefined, { numeric: true });
 }
 return timeB - timeA;
 });

 const groupsList: Transaction[][] = [];
 const groupsMap = new Map<string, number>();
 let noTxnCounter = 0;

 sorted.forEach(tx => {
 let txnNo = String(tx['เลขที่รายการ'] || '').trim();
 if (!txnNo) txnNo =`NO_TXN_${noTxnCounter++}`;

 const timeMs = new Date(tx['วัน-เวลา']).getTime();
 const timeWindow = Math.floor(timeMs / 60000);
 const groupKey =`${txnNo}_${timeWindow}`;

 const existingIdx = groupsMap.get(groupKey);
 if (existingIdx !== undefined) {
 groupsList[existingIdx].push(tx);
 } else {
 groupsMap.set(groupKey, groupsList.length);
 groupsList.push([tx]);
 }
 });

 return groupsList;
 }, [filteredTransactions]);

 const totalPages = Math.max(1, Math.ceil(groupedTransactions.length / pageSize));
 const paginatedGroups = useMemo(() => {
 const start = (currentPage - 1) * pageSize;
 return groupedTransactions.slice(start, start + pageSize);
 }, [groupedTransactions, currentPage, pageSize]);

 const exportToPDF = async () => {
 try {
 const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
 import('jspdf'),
 import('jspdf-autotable')
 ]);
 const doc = new jsPDF('l', 'mm', 'a4');
 doc.setFontSize(22);
 doc.text('ETE DC PHUKET - Transaction History Report', 14, 20);
 doc.setFontSize(10);
 doc.text(`Generated on: ${new Date().toLocaleString('th-TH')}`, 14, 28);

 const tableData = groupedTransactions.flatMap(group => {
 const first = group[0];
 const dateStr = new Date(first['วัน-เวลา']).toLocaleString('th-TH');
 const cust = customers.find(c => String(c.cv) === String(first.CV));
 const custInfo = cust ?`${cust.name} (CV: ${cust.cv})` : (first.CV || '-');
 
      return group.map((t, idx) => [
 idx === 0 ? first['เลขที่รายการ'] : '',
 idx === 0 ? dateStr : '',
 idx === 0 ? (t.สถานะ || '') : '',
 idx === 0 ? custInfo : '',`${t.ประเภท} ${t["ยี่ห้อ/รูปแบบ"] || ''} ${t.รายการ || ''} ${t.ขนาด || ''}`,
 t.serial_number || '-',
 t.asset_tag || t.assetTag || '-',
 t.จำนวน,
 idx === 0 ? (t["ผู้แจ้ง"] || '-') : '',
 idx === 0 ? (t["จัดส่งโดย"] || '-') : ''
 ]);
 });

 autoTable(doc, {
 startY: 35,
      head: [['เลขที่รายการ', 'วัน-เวลา', 'ประเภทงาน', 'ร้านค้า/ลูกค้า', 'รายการพัสดุ', 'S/N (ถ้ามี)', 'Asset Tag', 'จำนวน', 'ผู้แจ้งงาน', 'ผู้จัดส่ง/รับ']],
 body: tableData,
 theme: 'grid',
 headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
 styles: { fontSize: 9, cellPadding: 2 },
 columnStyles: {
 4: { cellWidth: 60 },
 3: { cellWidth: 40 }
 }
 });

 doc.save(`History_Report_${new Date().getTime()}.pdf`);
 } catch (e: any) {
 alert(`Export Failed: ${e.message}`);
 }
 };

 if (transactions.length === 0) {
 return (
 <div className="text-center py-6 px-4">
 <p className="text-slate-300 font-bold uppercase tracking-widest text-xs">ยังไม่มีประวัติรายการ</p>
 </div>
 );
 }

 return (
 <div className="mobile-page-frame flex flex-col h-full gap-4 bg-base-200/40">
 <div className="mobile-toolbar-card shrink-0">
 <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
 <form onSubmit={handleSearch} className="relative flex-1 group flex items-center gap-2.5 flex-col sm:flex-row">
 <div className="relative flex-1 group w-full">
 <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30" />
 <input
 type="text"
 value={userInput}
 onChange={e => setUserInput(e.target.value)}
 placeholder="ค้นหาเลขที่รายการ, ชื่อร้านค้า, ยี่ห้อพัสดุ..."
 className="input input-bordered w-full h-12 pl-11 pr-10 rounded-xl text-[14px] font-medium"
 />
 {userInput && (
 <button type="button" onClick={() => { setUserInput(''); setSearchTerm(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-base-content/30">
 <X size={18} />
 </button>
 )}
 </div>
 <button type="submit" className="btn btn-primary no-animation h-12 px-5 rounded-xl flex items-center justify-center gap-2 font-semibold text-[13px] shrink-0 w-full sm:w-auto">
 <Search size={18} />
 <span>ค้นหา</span>
 </button>
 </form>
 
 <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
 <button
 onClick={exportToPDF}
 className="btn btn-outline no-animation h-12 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-[13px]"
 title="ส่งออกรายงาน PDF"
 >
 <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
 <span>ส่งออก PDF</span>
 </button>

 <button
 onClick={() => {
 setUserInput('');
 setSearchTerm('');
 onRefresh?.();
 }}
 disabled={isSearching}
 className="btn btn-ghost no-animation btn-circle border border-base-300 disabled:opacity-50 shrink-0"
 title="ล้างการค้นหาและรีเฟรช"
 >
 <RotateCcw size={18} className={isSearching ? '' : ''} />
 </button>
 </div>
 </div>

 <div className="mobile-row flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
 <button 
 onClick={() => expandAll(paginatedGroups)}
 className="px-4 py-2 bg-indigo-50/50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-indigo-100/30"
 >
 <span className="material-symbols-outlined text-[16px]">expand_all</span> ขยายทั้งหมด
 </button>
 <button 
 onClick={collapseAll}
 className="btn no-animation px-4 py-2 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-slate-200/50"
 >
 <span className="material-symbols-outlined text-[16px]">collapse_all</span> ย่อทั้งหมด
 </button>
 </div>
 <div className="flex items-center gap-2">
 <p className="text-[10px] font-semibold text-slate-500 tracking-tight">
 {groupedTransactions.length.toLocaleString()} รายการ
 </p>
 <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
 </div>
 </div>
 </div>

 {/* Main List Area */}
 <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
 <div className="space-y-2.5 pb-20">
 {paginatedGroups.length === 0 ? (
 <div className="text-center py-6 px-4">
 <p className="text-slate-300 font-black uppercase tracking-[0.2em] text-[10px]">ไม่พบรายการที่ค้นหา</p>
 </div>
 ) : paginatedGroups.map((group, groupIdx) => {
 const firstTx = group[0];
 const txnNo = firstTx['เลขที่รายการ'] ||`TXN-${groupIdx}`;
 const status = String(firstTx['สถานะ'] || '');
 const isReturn = status === 'รับคืน' || status === 'รับคืนแล้ว' || status === 'คืนบางส่วน';
 const isReceive = status === 'รับเข้า';
 const isIssue = status === 'เบิกออก';
 const isCancelled = status.includes('ยกเลิก');
 const isExpanded = expandedGroups.has(String(txnNo));
 const totalQty = group.reduce((sum, tx) => sum + Math.abs(parseFloat(String(tx.จำนวน || 0))), 0);
 const dateStr = formatThaiDateTime(firstTx['วัน-เวลา'] || '');
 const dateParts = dateStr.split(' • ');

 const badgeStyles = isCancelled
 ? 'bg-rose-50 text-rose-500 border-rose-100/50'
 : isReturn
 ? 'bg-purple-50 text-purple-600 border-purple-100/50'
 : isReceive
 ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50'
 : isIssue
 ? 'bg-amber-50 text-amber-600 border-amber-100/50'
 : 'bg-slate-50 text-slate-500 border-slate-100';

 const qtyStyles = isCancelled
 ? 'text-rose-400 line-through opacity-60'
 : isReturn
 ? 'text-purple-600'
 : isReceive
 ? 'text-emerald-600 font-bold'
 : 'text-slate-900';

 return (
 <div key={`${txnNo}-${groupIdx}`} className={`bg-white border rounded-2xl overflow-hidden ${isExpanded ? 'border-primary/20 ' : 'border-slate-100 '}`}>
 {/* Compact Header */}
 <div
 onClick={() => toggleGroup(String(txnNo))}
 className={`py-3 px-4 mobile-row flex items-center justify-between cursor-pointer active:bg-slate-50/80 ${isExpanded ? 'bg-primary/[0.02]' : ''}`}
 >
 <div className="flex items-center gap-4 flex-1 min-w-0">
 <div className="flex flex-col min-w-0">
 <div className="flex items-center gap-2 mb-1.5 flex-wrap">
 <span className="text-[15px] font-black text-slate-900 tracking-tight font-mono">#{txnNo}</span>
 {firstTx['เลขงาน'] && firstTx['เลขงาน'] !== '-' && (
 <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg border border-indigo-100">
 JOB: {firstTx['เลขงาน']}
 </span>
 )}
 <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${badgeStyles}`}>{status}</span>
 {group.some(t => t.distance_warning) && (
 <div className="flex items-center gap-1.5 bg-rose-50 text-rose-500 px-2 py-0.5 rounded-lg border border-rose-100">
 <span className="material-symbols-outlined text-[14px]">location_off</span>
 <span className="text-[9px] font-black uppercase tracking-tighter">Geofence Warning</span>
 </div>
 )}
 </div>
 <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-3">
 <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_today</span> {dateParts[0]}</span>
 <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
 <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span> {dateParts[1]}</span>
 </div>
 </div>
 </div>
 
 <div className="flex items-center gap-4 ml-4">
 <div className="text-right">
 <p className={`text-[22px] font-black tracking-tighter leading-none ${qtyStyles}`}>
 {isCancelled ? '' : isReceive ? '+' : '-'}{totalQty.toLocaleString()}
 </p>
 <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.15em] mt-1">{group.length} รายการ</p>
 </div>
 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isExpanded ? 'bg-indigo-50 text-indigo-600 rotate-180' : 'bg-slate-50 text-slate-300'}`}>
 <span className="material-symbols-outlined text-[20px]">expand_more</span>
 </div>
 </div>
 </div>

 {/* Expanded Content */}
 {isExpanded && (
 <div className="border-t border-slate-50 p-4 bg-white space-y-4">
 {/* Item Lines */}
 <div className="space-y-3">
 {group.map((t, idx) => (
 <div key={idx} className="flex justify-between items-center py-4 border-b border-slate-50 last:border-0 px-2 rounded-xl">
 <div className="flex flex-col min-w-0 pr-4">
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 <span className="text-[9px] font-black bg-slate-800 text-white px-2 py-1 rounded-lg uppercase tracking-wider">
 {t.ประเภท || 'ITEM'}
 </span>
 <p className="text-[15px] font-black text-slate-800 uppercase leading-none tracking-tight">
 {t.ยี่ห้อหรือรูปแบบ} {t.รายการ}
 </p>
 </div>
 
 <div className="flex flex-wrap gap-1.5 items-center">
 {t.ขนาด && (
 <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100/50 uppercase">
 {t.ขนาด}
 </span>
 )}
 {t.สภาพ && (
 <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/50 uppercase">
 {t.สภาพ}
 </span>
 )}
 {t.รายละเอียด && (
 <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 uppercase">
 {t.รายละเอียด}
 </span>
 )}
 {t.serial_number && (
 <div className="flex items-center gap-1.5 bg-slate-900 text-white px-2 py-1 rounded-lg scale-[0.9] origin-left">
 <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
 <span className="text-[10px] font-black font-mono italic tracking-tighter uppercase whitespace-nowrap">S/N: {t.serial_number}</span>
 </div>
 )}
 {(t.asset_tag || t.assetTag) && (
 <div className="flex items-center gap-1.5 bg-indigo-600 text-white px-2 py-1 rounded-lg scale-[0.9] origin-left">
 <span className="material-symbols-outlined text-[14px]">sell</span>
 <span className="text-[10px] font-black font-mono italic tracking-tighter uppercase whitespace-nowrap">TAG: {t.asset_tag || t.assetTag}</span>
 </div>
 )}
 {(t.tracking_type || t.trackingType) && (
 <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 uppercase">
 {String(t.tracking_type || t.trackingType)}
 </span>
 )}
 </div>
 </div>
 <div className={`px-4 py-2 rounded-2xl text-[16px] font-black shrink-0 border border-slate-100 bg-white ${qtyStyles}`}>
 x{t.จำนวน}
 </div>
 </div>
 ))}
 </div>


 <div className="pt-4 space-y-4 border-t border-slate-100">
 {/* Customer / Logistics metadata */}
 {(isIssue || isReturn) ? (
 <div className="space-y-4">
 {isReturn && (
 <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 mobile-row flex items-center justify-between relative overflow-hidden">
 <div className="flex flex-col gap-1">
 <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest leading-none mb-1">ผู้แจ้งพัสดุรับคืน</p>
 <p className="text-[14px] font-black text-slate-800">{firstTx['ผู้แจ้ง'] || '-'}</p>
 <p className="text-[10px] font-black text-purple-400/50 tracking-tighter">วันที่แจ้ง: {firstTx['วันที่แจ้ง'] || '-'}</p>
 </div>
 <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-200 border border-slate-100">
 <span className="material-symbols-outlined text-[24px]">person</span>
 </div>
 </div>
 )}

 {/* Customer Card */}
 {(() => {
 const allValues = group.flatMap(tx => Object.values(tx)).map(v => String(v || '').replace(/^[']*/, '').trim().toLowerCase()).filter(Boolean);
 const finalCust = customers.find(c => {
 const cleanCV = String(c.cv || '').replace(/^[']*/, '').trim().toLowerCase();
 const cleanName = String(c.name || '').trim().toLowerCase();
 return allValues.some(val => (cleanCV && val === cleanCV) || (cleanName && val === cleanName));
 });
 if (!finalCust) return null;
 return (
 <div className="bg-white p-6 rounded-xl border border-slate-100 space-y-4 relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full -mr-16 -mt-16"></div>
 <div className="mobile-row flex items-center justify-between relative z-10">
 <div className="flex items-center gap-4">
 <div className={`w-14 h-14 ${isIssue ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'} rounded-[1.25rem] flex items-center justify-center`}>
 <span className="material-symbols-outlined text-[30px]">{isIssue ? 'storefront' : 'person'}</span>
 </div>
 <div className="flex flex-col">
 <p className="text-[16px] font-black text-slate-900 leading-none mb-2">{finalCust.name}</p>
 <div className="flex items-center gap-2">
 <span className={`text-[10px] font-black ${isIssue ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100'} px-2.5 py-1 rounded-lg uppercase border`}>CV: {finalCust.cv}</span>
 {finalCust.province && <span className="text-[10px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg uppercase">{finalCust.province}</span>}
 </div>
 </div>
 </div>
 <button onClick={() => {
 const query = (finalCust.lat && String(finalCust.lat).trim() && finalCust.lng && String(finalCust.lng).trim())
 ?`${finalCust.lat},${finalCust.lng}`
 : encodeURIComponent(`${finalCust.name} ${finalCust.address} ${finalCust.subdistrict} ${finalCust.district} ${finalCust.province}`);
 window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
 }} className="h-12 px-6 bg-slate-900 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest flex items-center gap-2">
 <span className="material-symbols-outlined text-[18px]">directions</span>
 MAP
 </button>
 </div>
 <div className="space-y-3 pl-1 border-t border-slate-50 pt-5 relative z-10">
 <div className="flex items-center gap-3 text-slate-600">
 <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
 <span className="material-symbols-outlined text-[18px]">call</span>
 </div>
 <p className="text-[13px] font-bold">{finalCust.phone || '-'}</p>
 </div>
 <div className="flex items-start gap-3 text-slate-400">
 <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 shrink-0">
 <span className="material-symbols-outlined text-[18px]">location_on</span>
 </div>
 <p className="text-[12px] font-bold leading-relaxed">{finalCust.address} {finalCust.subdistrict} {finalCust.district} {finalCust.province}</p>
 </div>
 </div>
 </div>
 );
 })()}

 {/* 📍 Transaction Geofencing Info */}
 {group.some(t => t.lat && t.lng) && (
 <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 mobile-row flex items-center justify-between">
 <div className="space-y-1">
 <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-2">พิกัดขณะทำรายการ (Secure GPS)</p>
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1.5 text-white/90">
 <span className="material-symbols-outlined text-[16px] text-emerald-400">gps_fixed</span>
 <span className="text-[13px] font-black tracking-tight font-mono">{firstTx.lat}, {firstTx.lng}</span>
 </div>
 {group.find(t => t.distance_warning)?.distance_warning && (
 <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-1 rounded-lg uppercase tracking-wider border border-rose-400/50">
 {group.find(t => t.distance_warning)?.distance_warning}
 </span>
 )}
 </div>
 </div>
 <button 
 onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${firstTx.lat},${firstTx.lng}`, '_blank')}
 className="h-11 px-5 bg-white/5 text-white rounded-2xl border border-white/10 text-[11px] font-black uppercase flex items-center gap-2 shrink-0"
 >
 <span className="material-symbols-outlined text-[20px]">map</span> แผนที่
 </button>
 </div>
 )}

 <div className="grid grid-cols-2 gap-3">
 <div className={`p-4 rounded-xl border ${isIssue ? 'bg-amber-50 border-amber-100/50' : 'bg-blue-50/50 border-blue-100/50'}`}>
 <p className={`text-[9px] font-black ${isIssue ? 'text-amber-400' : 'text-blue-400'} uppercase tracking-[0.2em] leading-none mb-2`}>เขต / สถานที่</p>
 <p className={`text-[14px] font-black ${isIssue ? 'text-amber-900' : 'text-blue-900'} truncate`}>{firstTx.เขตการทำงาน || firstTx.CV || '-'}</p>
 </div>
 <div className={`p-4 rounded-xl border ${isIssue ? 'bg-amber-50 border-amber-100/50' : 'bg-purple-50/50 border-purple-100/50'}`}>
 <p className={`text-[9px] font-black ${isIssue ? 'text-amber-400' : 'text-purple-400'} uppercase tracking-[0.2em] leading-none mb-2`}>ผู้รับผิดชอบ</p>
 <p className={`text-[14px] font-black ${isIssue ? 'text-amber-900' : 'text-purple-900'} truncate`}>{firstTx.จัดส่งโดย || '-'}</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
 {isReturn && (
 <div className="bg-[#fff1f2] p-4 rounded-2xl border border-rose-100/50">
 <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1.5">สาเหตุการคืน</p>
 <p className="text-[14px] font-black text-rose-700 leading-tight">{firstTx['สาเหตุการคืน'] || '-'}</p>
 </div>
 )}
 <div className={`${isIssue ? 'bg-amber-50 border-amber-100/30' : 'bg-[#f0fdf4] border-emerald-100/50'} p-4 rounded-2xl border`}>
 <p className={`text-[10px] font-black ${isIssue ? 'text-amber-400' : 'text-emerald-400'} uppercase tracking-widest leading-none mb-1.5`}>{isIssue ? 'วันกำหนดส่ง' : 'สภาพตู้ / อุปกรณ์'}</p>
 <p className={`text-[14px] font-black ${isIssue ? 'text-amber-800' : 'text-emerald-800'}`}>
 {isIssue ? (firstTx.กำหนดส่ง || '-') : (firstTx['สภาพตู้'] || '-')}
 </p>
 </div>
 </div>

 {firstTx.หมายเหตุ && (
 <div className="bg-[#fffbeb] p-4 rounded-3xl border border-amber-100/50">
 <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1.5">หมายเหตุเพิ่มเติม</p>
 <p className="text-[13px] font-bold text-amber-800 italic leading-relaxed">"{firstTx.หมายเหตุ}"</p>
 </div>
 )}

 {/* Evidence Photos */}
 {firstTx["รูปภาพประกอบ"] && (
 <div className="pt-4 border-t border-slate-100">
 <div className="flex items-center gap-2 mb-4 text-slate-400">
 <span className="material-symbols-outlined text-[18px]">collections</span>
 <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">รูปภาพประกอบใบงาน</p>
 </div>
 <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
 {String(firstTx["รูปภาพประกอบ"]).split('\n').map(u => u.trim()).filter(Boolean).map((url, i) => (
 <button 
 key={url} 
 className="btn no-animation relative w-24 h-24 rounded-2xl border-4 border-white cursor-pointer bg-slate-100 overflow-hidden shrink-0 outline-none"
 onClick={() => setSelectedImage(url)}
 >
 <img 
 src={getDriveDirectLink(url)} 
 alt={`Evidence ${i+1}`}
 className="w-full h-full object-cover"
 onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Error'; }}
 />
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 ) : (
 /* Standard Receive Info */
 <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
 <div className="space-y-0.5">
 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ผู้ทำรายการ</p>
 <p className="text-[13px] font-bold text-slate-800 truncate">{firstTx['ผู้ทำรายการ'] || '-'}</p>
 </div>
 <div className="space-y-0.5 text-right">
 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ประเภทงาน</p>
 <p className="text-[13px] font-bold text-emerald-600 truncate">{status}</p>
 </div>
 {firstTx.หมายเหตุ && (
 <div className="col-span-2 pt-2 border-t border-white mt-1">
 <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">หมายเหตุ</p>
 <p className="text-[12px] font-medium text-slate-600 italic">"{firstTx.หมายเหตุ}"</p>
 </div>
 )}
 </div>
 )}

 {/* Cancelled Info */}
 {isCancelled && (
 <div className="bg-rose-50/50 p-4 rounded-3xl border border-rose-100/30 space-y-2.5">
 <div className="flex items-center gap-2 text-rose-500">
 <span className="material-symbols-outlined text-[16px]">cancel</span>
 <p className="text-[10px] font-black uppercase tracking-[0.1em]">รายการนี้ถูกยกเลิกแล้ว</p>
 </div>
 <div className="grid grid-cols-2 gap-3 border-t border-rose-100/50 pt-2.5">
 <div>
 <p className="text-[8px] font-black text-rose-300 uppercase mb-0.5">สาเหตุที่ยกเลิก</p>
 <p className="text-[12px] font-black text-rose-800 leading-tight">{firstTx['เหตุผลการยกเลิก'] || '-'}</p>
 </div>
 <div className="text-right">
 <p className="text-[8px] font-black text-rose-300 uppercase mb-0.5">ยกเลิกโดย</p>
 <p className="text-[12px] font-black text-rose-800 truncate">{firstTx['ยกเลิกโดย'] || '-'}</p>
 </div>
 </div>
 </div>
 )}

 {/* Cancel Button */}
 {!isCancelled && onVoid && (
 <div className="pt-1">
 <button
 onClick={(e) => {
 e.stopPropagation();
 onVoid(String(txnNo));
 }}
 className="w-full py-3.5 rounded-2xl bg-white border border-rose-100 text-rose-500 text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
 >
 <span className="material-symbols-outlined text-[18px]">block</span>
 ยกเลิกรายการนี้
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>

 {/* Pagination Footer */}
 <div className="mobile-row flex items-center justify-between py-6 px-8 bg-white border-t border-slate-100 shrink-0">
 <div className="flex items-center gap-4">
 <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">แสดงผล:</span>
 <div className="relative group">
 <select title="Rows selection" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="appearance-none h-10 pl-4 pr-10 bg-slate-50 border border-slate-100 rounded-xl text-[12px] font-black text-slate-900 outline-none cursor-pointer">
 {[10, 30, 50, 100].map(v => <option key={v} value={v}>{v} แถว</option>)}
 </select>
 <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">unfold_more</span>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="w-12 h-12 rounded-2xl border border-slate-100 bg-white flex items-center justify-center disabled:opacity-30"><span className="material-symbols-outlined text-[24px] text-slate-600">chevron_left</span></button>
 <div className="px-5 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
 <span className="text-[14px] font-black text-white tracking-widest">{currentPage} <span className="text-white/30 mx-1 text-[10px]">/</span> {totalPages}</span>
 </div>
 <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="w-12 h-12 rounded-2xl border border-slate-100 bg-white flex items-center justify-center disabled:opacity-30"><span className="material-symbols-outlined text-[24px] text-slate-600">chevron_right</span></button>
 </div>
 </div>

 <ImageLightbox 
 isOpen={!!selectedImage} 
 imageUrl={selectedImage ? getDriveDirectLink(selectedImage).replace('sz=w256-h256', 'sz=w1280-h1280') : ''} 
 onClose={() => setSelectedImage(null)} 
 />
 </div>
 );
}
