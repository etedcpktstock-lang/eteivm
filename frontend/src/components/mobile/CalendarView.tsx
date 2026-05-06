import { useState, useMemo, useEffect } from 'react';
import type { MaterialItem, Transaction } from '../../types';

interface CalendarViewProps {
 items: MaterialItem[];
 transactions: Transaction[];
}

const getFieldValue = (obj: any, keys: string[]): string => {
 for (const k of keys) {
 if (obj[k] !== undefined && obj[k] !== null) return String(obj[k]).trim();
 }
 return '';
};

export default function CalendarView({ items, transactions }: CalendarViewProps) {
 const [selectedMonth, setSelectedMonth] = useState<string>(() => {
 const d = new Date();
 return`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
 });

 const [searchTerm, setSearchTerm] = useState('');
 const [filterType, setFilterType] = useState('');
 const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

 useEffect(() => {
 const handleResize = () => setIsMobile(window.innerWidth < 1024);
 window.addEventListener('resize', handleResize);
 return () => window.removeEventListener('resize', handleResize);
 }, []);

 const parsedMonth = useMemo(() => {
 const [year, month] = selectedMonth.split('-');
 return { year: parseInt(year), month: parseInt(month) - 1 };
 }, [selectedMonth]);

 const daysInMonth = new Date(parsedMonth.year, parsedMonth.month + 1, 0).getDate();

 const mapItem = (item: any) => ({
 ประเภท: getFieldValue(item, ['ประเภท']),
 ยี่ห้อ: getFieldValue(item, ['ยี่ห้อหรือรูปแบบ', 'ยี่ห้อ/รายการ']),
 รายการ: getFieldValue(item, ['รายการ']),
 สภาพ: getFieldValue(item, ['สภาพ']),
 รายละเอียด: getFieldValue(item, ['รายละเอียด']),
 ขนาด: getFieldValue(item, ['ขนาด']),
 });

 const uniqueTypes = useMemo(() => {
 const types = items.map(i => mapItem(i).ประเภท).filter(Boolean);
 return Array.from(new Set(types)).sort();
 }, [items]);

 const calendarData = useMemo(() => {
 const map = new Map<string, any>();
 const makeKey = (row: any) =>`${row.ประเภท}|${row.ยี่ห้อ}|${row.รายการ}|${row.สภาพ}|${row.รายละเอียด}|${row.ขนาด}`;

 items.forEach(i => {
 const mapped = mapItem(i);
 const k = makeKey(mapped);
 const qty = parseFloat(String(i['จำนวน'] || '0')) || 0;
 if (!map.has(k)) {
 map.set(k, { ...mapped, currentStock: qty, startingStock: qty, receiveDays: Array(32).fill(0), issueDays: Array(32).fill(0) });
 } else {
 const row = map.get(k);
 row.currentStock += qty;
 row.startingStock += qty;
 }
 });

 const startOfMonth = new Date(parsedMonth.year, parsedMonth.month, 1);

 transactions.forEach(tx => {
 const mapped = mapItem(tx);
 const k = makeKey(mapped);
 const status = tx['สถานะ'] || '';
 const isReceive = status === 'รับเข้า';
 const isIssue = status === 'เบิกออก' || status === 'จ่ายออก';
 const qty = Math.abs(parseFloat(String(tx['จำนวน'] || '0')) || 0);
 if (qty === 0) return;

 const dateStr = String(tx['วัน-เวลา'] || '');
 if (!dateStr) return;
 const txDate = new Date(dateStr);
 if (isNaN(txDate.getTime())) return;
 
 if (!map.has(k)) {
 map.set(k, { ...mapped, currentStock: 0, startingStock: 0, receiveDays: Array(32).fill(0), issueDays: Array(32).fill(0) });
 }
 const row = map.get(k);
 
 if (txDate >= startOfMonth) {
 if (isReceive) row.startingStock -= qty;
 else if (isIssue) row.startingStock += qty;
 }
 
 if (txDate.getFullYear() === parsedMonth.year && txDate.getMonth() === parsedMonth.month) {
 const day = txDate.getDate();
 if (isReceive) row.receiveDays[day] += qty;
 else if (isIssue) row.issueDays[day] += qty;
 }
 });

 let rows = Array.from(map.values()).sort((a, b) => a.ประเภท.localeCompare(b.ประเภท));
 if (filterType) rows = rows.filter(r => r.ประเภท === filterType);
 if (searchTerm) {
 const term = searchTerm.toLowerCase();
 rows = rows.filter(r => r.รายการ.toLowerCase().includes(term) || r.ประเภท.toLowerCase().includes(term));
 }
 return rows;
 }, [items, transactions, parsedMonth, searchTerm, filterType]);

 const labelClass ="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1";
 const selectClass ="h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] font-bold text-slate-900 outline-none";

 return (
 <div className="space-y-4 pb-20 px-2 lg:px-0">
 <div className="flex flex-col md:flex-row justify-between items-end gap-4 pt-4">
 <div>
 <h1 className="text-2xl font-bold text-slate-900 tracking-tight">สรุปยอดประจำเดือน</h1>
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Inventory Calendar Summary</p>
 </div>

 <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-100">
 <div className="flex flex-col">
 <span className={labelClass}>หมวดหมู่</span>
 <select title="FilterType" value={filterType} onChange={e => setFilterType(e.target.value)} className={selectClass}>
 <option value="">ทั้งหมด</option>
 {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
 </select>
 </div>
 <div className="flex flex-col">
 <span className={labelClass}>รอบเดือน</span>
 <input title="SelectedMonth" type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className={selectClass} />
 </div>
 <div className="flex flex-col min-w-[150px]">
 <span className={labelClass}>ค้นหา</span>
 <input title="Search" type="text" placeholder="..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={selectClass} />
 </div>
 </div>
 </div>

 <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse text-[11px]">
 <thead className="bg-slate-900 text-white uppercase tracking-wider font-bold">
 <tr>
 <th rowSpan={2} className="p-4 border-r border-white/10 sticky left-0 z-10 bg-slate-900 min-w-[200px]">รายการพัสดุ</th>
 <th rowSpan={2} className="p-3 text-center border-r border-white/10 bg-slate-800">ยกมา</th>
 <th colSpan={daysInMonth} className="p-1 text-center border-b border-white/10 bg-emerald-500/20 text-emerald-300">รับเข้า (+)</th>
 <th colSpan={daysInMonth} className="p-1 text-center border-b border-white/10 bg-rose-500/20 text-rose-300">เบิกออก (-)</th>
 <th rowSpan={2} className="p-4 text-center sticky right-0 z-10 bg-slate-900">คงเหลือ</th>
 </tr>
 <tr className="bg-slate-800 text-[9px]">
 {Array.from({length: daysInMonth}, (_, i) => i + 1).map(d => (
 <th key={`rcv-h-${d}`} className="px-1 py-1 text-center border-r border-white/5 opacity-40">{d}</th>
 ))}
 {Array.from({length: daysInMonth}, (_, i) => i + 1).map(d => (
 <th key={`iss-h-${d}`} className="px-1 py-1 text-center border-r border-white/5 opacity-40">{d}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {calendarData.map((row, i) => {
 const totalRcv = row.receiveDays.reduce((a: number, b: number) => a + b, 0);
 const totalIss = row.issueDays.reduce((a: number, b: number) => a + b, 0);
 const balance = row.startingStock + totalRcv - totalIss;
 return (
 <tr key={i} className="">
 <td className="p-4 border-r border-slate-100 sticky left-0 z-10 bg-white">
 <span className="text-[9px] font-bold text-slate-400 block uppercase mb-0.5">{row.ประเภท}</span>
 <span className="text-[12px] font-bold text-slate-900 truncate max-w-[180px] block">{row.รายการ}</span>
 </td>
 <td className="p-3 text-center border-r border-slate-100 font-bold text-slate-400 bg-slate-50/50">{row.startingStock || '0'}</td>
 {Array.from({length: daysInMonth}, (_, idx) => idx + 1).map(d => (
 <td key={`rcv-${d}`} className="px-1 py-3 text-center border-r border-slate-50/50 text-emerald-600 font-bold">{row.receiveDays[d] || ''}</td>
 ))}
 {Array.from({length: daysInMonth}, (_, idx) => idx + 1).map(d => (
 <td key={`iss-${d}`} className="px-1 py-3 text-center border-r border-slate-50/50 text-rose-600 font-bold">{row.issueDays[d] || ''}</td>
 ))}
 <td className={`p-4 text-center font-black sticky right-0 z-10 ${balance <= 0 ? 'bg-rose-50 text-rose-600' : 'bg-white text-slate-900'}`}>
 {balance.toLocaleString()}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 
 {!isMobile && (
 <div className="flex justify-end pt-2">
 <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2 bg-slate-100 text-slate-500 rounded-lg font-bold text-[11px] uppercase tracking-widest">
 <span className="material-symbols-outlined text-[18px]">print</span>
 พิมพ์รายงาน
 </button>
 </div>
 )}
 </div>
 );
}
