import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Transaction } from '../../types';
import { exportAoaToExcel } from '../../utils/excel';
import { SARABUN_REGULAR, SARABUN_BOLD } from '../../utils/pdfFonts';

interface ReportsProps {
 transactions: Transaction[];
}

const Reports: React.FC<ReportsProps> = ({ transactions }) => {
 const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
 const [flowFilter, setFlowFilter] = useState<'all' | 'in' | 'out' | 'void' | 'transfer'>('all');
 const [keyword, setKeyword] = useState('');
 const [dateFrom, setDateFrom] = useState('');
 const [dateTo, setDateTo] = useState('');
 const [isExportingPdf, setIsExportingPdf] = useState(false);

 const classifyFlow = (statusRaw: string) => {
 const status = String(statusRaw || '');
 const isVoid = status.includes('ยกเลิก');
 const isTransfer = status.includes('ย้ายพัสดุ');
 const isOut = ['เบิกออก', 'กำลังเดินทาง', 'ส่งมอบเรียบร้อย', 'สำเร็จ', 'แจ้งส่ง'].some(k => status.includes(k));
 const isIn = ['รับเข้า', 'รอตรวจ', 'รอตรวจสอบ', 'รับคืน', 'แจ้งคืน', 'คลังกักกัน', 'ตรวจสอบแล้ว'].some(k => status.includes(k));
 return { isVoid, isTransfer, isOut, isIn };
 };

 const filteredTransactions = useMemo(() => {
 const q = keyword.trim().toLowerCase();
 return transactions.filter((t) => {
 const d = new Date(t['วัน-เวลา']);
 if (isNaN(d.getTime())) return false;

 if (dateFrom) {
 const from = new Date(`${dateFrom}T00:00:00`);
 if (d < from) return false;
 }
 if (dateTo) {
 const to = new Date(`${dateTo}T23:59:59`);
 if (d > to) return false;
 }

 const flow = classifyFlow(t.สถานะ || '');
 if (flowFilter === 'in' && !flow.isIn) return false;
 if (flowFilter === 'out' && !flow.isOut) return false;
 if (flowFilter === 'void' && !flow.isVoid) return false;
 if (flowFilter === 'transfer' && !flow.isTransfer) return false;

 if (q) {
 const hay = Object.values(t).map(v => String(v ?? '').toLowerCase()).join(' ');
 if (!hay.includes(q)) return false;
 }
 return true;
 });
 }, [transactions, flowFilter, keyword, dateFrom, dateTo]);

 // Aggregation Logic
 const stats = useMemo(() => {
 const daily: Record<string, { in: number, out: number, void: number }> = {};
 const weekly: Record<string, { in: number, out: number, void: number }> = {};
 const monthly: Record<string, { in: number, out: number, void: number }> = {};
 const yearly: Record<string, { in: number, out: number, void: number }> = {};

 filteredTransactions.forEach(t => {
 const date = new Date(t['วัน-เวลา']);
 if (isNaN(date.getTime())) return;
 const y = date.getFullYear();
 const m = date.getMonth() + 1;
 const d = date.getDate();
 const firstDayOfYear = new Date(y, 0, 1);
 const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
 const w = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
 const dayKey =`${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
 const weekKey =`${y}-W${w.toString().padStart(2, '0')}`;
 const monthKey =`${y}-${m.toString().padStart(2, '0')}`;
 const yearKey =`${y}`;
 const amt = Math.abs(t.จำนวน || 0);
 const { isVoid, isTransfer, isOut, isIn } = classifyFlow(t.สถานะ || '');
 [[daily, dayKey], [weekly, weekKey], [monthly, monthKey], [yearly, yearKey]].forEach(([map, key]: any) => {
 if (!map[key]) map[key] = { in: 0, out: 0, void: 0 };
 if (isVoid) map[key].void += 1;
 else if (isTransfer) {
 // transfer ระหว่างคลังไม่ใช่ IN/OUT สุทธิ
 }
 else if (isOut) map[key].out += amt;
 else if (isIn) map[key].in += amt;
 });
 });
 return { daily, weekly, monthly, yearly };
 }, [filteredTransactions]);

 const currentStats = useMemo(() => {
 return Object.entries(stats[period]).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
 }, [stats, period]);

 const totals = useMemo(() => {
 let totalIn = 0, totalOut = 0;
 Object.values(stats[period]).forEach(v => { totalIn += v.in; totalOut += v.out; });
 return { totalIn, totalOut };
 }, [stats, period]);

 const advancedStats = useMemo(() => {
 const zoneCount:Record<string, number> = {};
 const catCount:Record<string, number> = {};
 const hourCount:Record<string, number> = {};
 const operatorIn: Record<string, number> = {};
 const operatorOut: Record<string, number> = {};
 const operatorVoid: Record<string, number> = {};
 const itemCount: Record<string, number> = {};
 
 filteredTransactions.forEach(t => {
 const z = t['เขตการทำงาน'] || t['CV'] || 'Hub';
 const c = t.ประเภท || 'ทั่วไป';
 const h = new Date(t['วัน-เวลา']).getHours();
 const operator = t['ผู้ทำรายการ'] || 'Unknown';
 const item = t.รายการ || 'Unknown';
 const status = t.สถานะ || '';
 const amt = Math.abs(t.จำนวน || 1);
 const { isVoid, isTransfer, isOut, isIn } = classifyFlow(status);
 
 if (!isVoid) {
 itemCount[item] = (itemCount[item] || 0) + amt;
 }
 
 zoneCount[z] = (zoneCount[z] || 0) + 1;
 catCount[c] = (catCount[c] || 0) + amt;
 hourCount[h] = (hourCount[h] || 0) + 1;

 if (isIn) operatorIn[operator] = (operatorIn[operator] || 0) + amt;
 else if (isOut) operatorOut[operator] = (operatorOut[operator] || 0) + amt;
 else if (isVoid) operatorVoid[operator] = (operatorVoid[operator] || 0) + 1; // Count by frequency for voids
 else if (isTransfer) {
 // no-op for transfer in IN/OUT KPI
 }
 });

 const getTopList = (obj: any, limit = 3) => {
 return Object.entries(obj)
 .sort((a:any,b:any) => b[1] - a[1])
 .slice(0, limit)
 .map((item: any) => ({ name: item[0], val: item[1] }));
 };

 const getTop = (obj: any) => Object.entries(obj).sort((a:any,b:any) => b[1] - a[1])[0]?.[0] || 'N/A';
 
 return {
 topZone: getTop(zoneCount),
 topCat: getTop(catCount),
 peakHour: getTop(hourCount) !== 'N/A' ?`${getTop(hourCount)}:00` : 'N/A',
 topInList: getTopList(operatorIn),
 topOutList: getTopList(operatorOut),
 topVoidList: getTopList(operatorVoid),
 topItemList: getTopList(itemCount, 5)
 };
 }, [filteredTransactions]);

 const chartData = useMemo(() => {
 return [...currentStats].reverse().map(([key, val]) => ({
 name: key,
 'รับเข้า (IN)': val.in,
 'เบิกออก (OUT)': Math.abs(val.out),
 'ยกเลิก (VOID)': val.void
 }));
 }, [currentStats]);

 // Who, What, Where, When Feed
 const detailedFeed = useMemo(() => {
 return [...filteredTransactions].sort((a, b) => new Date(b['วัน-เวลา']).getTime() - new Date(a['วัน-เวลา']).getTime()).slice(0, 30);
 }, [filteredTransactions]);

 const exportStyledExcel = async () => {
 const summaryRows = [
 ['รายงานสรุปความเคลื่อนไหว (ETE DC PHUKET)'],
 ['วันที่รายงาน:', new Date().toLocaleString('th-TH')],
 ['ช่วงเวลา:', period.toUpperCase()],
 ['ตัวกรองสถานะ:', flowFilter],
 ['คำค้นหา:', keyword || '-'],
 ['ช่วงวันที่:', `${dateFrom || '-'} ถึง ${dateTo || '-'}`],
 ['จำนวนธุรกรรมที่ตรงตัวกรอง:', filteredTransactions.length],
 [],
 ['ระยะเวลา', 'รับเข้า (IN)', 'เบิกออก (OUT)', 'รวมหมุนเวียน'],
 ...Object.entries(stats[period])
 .sort((a, b) => b[0].localeCompare(a[0]))
 .map(([k, v]) => [k, v.in, v.out, v.in + v.out])
 ];

 const makeDetailRows = (data: Transaction[]) => [
 ['เลขที่รายการ', 'วัน-เวลา', 'ผู้ทำรายการ', 'รายการพัสดุ', 'S/N', 'Asset Tag', 'สถานะ', 'จำนวน', 'ที่ไหน/CV'],
 ...data.map(t => [
 t['เลขที่รายการ'] || '-',
 t['วัน-เวลา'],
 t['ผู้ทำรายการ'],
 t.รายการ,
 t.serial_number || '-',
 t.asset_tag || t.assetTag || '-',
 t.สถานะ,
 t.จำนวน,
 t['เขตการทำงาน'] || t['CV'] || 'Hub'
 ])
 ];

 const inRows = filteredTransactions.filter(t => classifyFlow(t.สถานะ || '').isIn);
 const outRows = filteredTransactions.filter(t => classifyFlow(t.สถานะ || '').isOut);
 const voidRows = filteredTransactions.filter(t => classifyFlow(t.สถานะ || '').isVoid);
 const transferRows = filteredTransactions.filter(t => classifyFlow(t.สถานะ || '').isTransfer);

 await exportAoaToExcel([
 { name: 'สรุปภาพรวม', rows: summaryRows },
 { name: 'รายการรับเข้า', rows: makeDetailRows(inRows) },
 { name: 'รายการเบิกออก', rows: makeDetailRows(outRows) },
 { name: 'รายการยกเลิก', rows: makeDetailRows(voidRows) },
 { name: 'รายการย้ายพัสดุ', rows: makeDetailRows(transferRows) },
 { name: 'รายการทั้งหมด(ตามตัวกรอง)', rows: makeDetailRows(filteredTransactions) }
 ], `Report_Full_Categorized_${Date.now()}.xlsx`);
 };

 const exportPdf = async () => {
 setIsExportingPdf(true);
 try {
 const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
 import('jspdf'),
 import('jspdf-autotable')
 ]);
 const doc = new jsPDF('l', 'mm', 'a4');

 // Add Thai Fonts
 doc.addFileToVFS('Sarabun-Regular.ttf', SARABUN_REGULAR);
 doc.addFileToVFS('Sarabun-Bold.ttf', SARABUN_BOLD);
 doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
 doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');

 doc.setFont('Sarabun', 'bold');
 doc.setFontSize(14);
 doc.text('รายงานพัสดุ (ตามตัวกรอง)', 14, 12);
 doc.setFont('Sarabun', 'normal');
 doc.setFontSize(9);
 doc.text(`วันที่: ${new Date().toLocaleString('th-TH')}`, 14, 18);
 doc.text(`Filter: ${flowFilter} | คำค้น: ${keyword || '-'} | ช่วงวันที่: ${dateFrom || '-'} - ${dateTo || '-'}`, 14, 23);

 const body = filteredTransactions.slice(0, 1000).map((t, i) => [
 i + 1,
 t['เลขที่รายการ'] || '-',
 t['วัน-เวลา'] || '-',
 t['ผู้ทำรายการ'] || '-',
 t.รายการ || '-',
 t.serial_number || '-',
 t.asset_tag || t.assetTag || '-',
 t.สถานะ || '-',
 Math.abs(t.จำนวน || 0),
 t['เขตการทำงาน'] || t['CV'] || 'Hub'
 ]);

 autoTable(doc, {
 startY: 28,
 head: [['#', 'เลขที่รายการ', 'วัน-เวลา', 'ผู้ทำรายการ', 'รายการ', 'S/N', 'Asset Tag', 'สถานะ', 'จำนวน', 'ที่ไหน/CV']],
 body,
 theme: 'grid',
 styles: { font: 'Sarabun', fontSize: 8 },
 headStyles: { fillColor: [51, 65, 85], textColor: 255 }
 });

 doc.save(`Report_Filtered_${Date.now()}.pdf`);
 } finally {
 setIsExportingPdf(false);
 }
 };

 return (
 <div className="mobile-page-frame max-w-[1600px] space-y-4">
 
 <div className="mobile-toolbar-card flex flex-col md:flex-row justify-between items-center gap-4">
 <div className="space-y-2">
 <div className="flex items-center gap-3 flex-wrap">
 <div className="mobile-chip">
 <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
 ซิงค์ข้อมูลแล้ว
 </div>
 <span className="text-[12px] font-medium text-base-content/60 font-mono">{new Date().toLocaleString('th-TH')}</span>
 </div>
 <h1 className="mobile-form-hero-title">รายงานและการวิเคราะห์</h1>
 <p className="mobile-form-hero-subtitle">สรุปการเคลื่อนไหวพัสดุและข้อมูลโลจิสติกส์</p>
 </div>
 <div className="flex items-center gap-3 flex-wrap justify-end">
 <button onClick={exportStyledExcel} className="btn btn-primary no-animation rounded-xl font-semibold text-[13px] flex items-center gap-2">
 <span className="material-symbols-outlined text-[18px]">table_view</span>
 <span>ส่งออก Excel</span>
 </button>
 <button onClick={exportPdf} disabled={isExportingPdf} className="btn btn-outline no-animation rounded-xl font-semibold text-[13px] flex items-center gap-2">
 <span className="material-symbols-outlined text-[18px]">{isExportingPdf ? 'hourglass_top' : 'picture_as_pdf'}</span>
 <span>{isExportingPdf ? 'กำลังสร้าง PDF' : 'ส่งออก PDF'}</span>
 </button>
 </div>
 </div>

 <div className="mobile-toolbar-card grid grid-cols-1 md:grid-cols-5 gap-3">
 <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="ค้นหา: เลขที่รายการ/ผู้ทำรายการ/CV/รายการ/S-N/Asset Tag" className="input input-bordered w-full md:col-span-2" />
 <select value={flowFilter} onChange={(e) => setFlowFilter(e.target.value as any)} className="select select-bordered w-full">
 <option value="all">ทุกสถานะ</option>
 <option value="in">รับเข้า</option>
 <option value="out">เบิกออก</option>
 <option value="void">ยกเลิก</option>
 <option value="transfer">ย้ายพัสดุ</option>
 </select>
 <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input input-bordered w-full" />
 <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input input-bordered w-full" />
 </div>

 {/* Vibrant Premium KPI Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
{[
{ label: 'พัสดุรับเข้า (IN)', val: totals.totalIn, icon: 'input', bg: 'bg-slate-700', trend: '+12%' },
{ label: 'พัสดุเบิกออก (OUT)', val: totals.totalOut, icon: 'output', bg: 'bg-slate-600', trend: '-5%' },
{ label: 'ปริมาณรวม (FLOW)', val: totals.totalIn + totals.totalOut, icon: 'sync_alt', bg: 'bg-slate-500', trend: 'STABLE' },
{ label: 'ธุรกรรมสุทธิ (TRX)', val: filteredTransactions.length, icon: 'database', bg: 'bg-slate-800', trend: 'LIVE' }
].map((kpi, idx) => (
<div
key={idx}
className={`p-6 rounded-xl ${kpi.bg} text-white flex flex-col justify-between h-44 border border-white/20 relative overflow-hidden cursor-pointer`}
>
 <div className="flex justify-between items-start relative z-10">
 <div className="space-y-1">
 <h4 className="text-[12px] font-black text-white/70 uppercase tracking-widest">{kpi.label}</h4>
 <div className="px-2 py-0.5 bg-white/20 rounded-lg text-[9px] font-black inline-block">{kpi.trend}</div>
 </div>
 <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
 <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
 </div>
 </div>
 <div className="relative z-10">
 <h2 className="text-4xl font-black tracking-tighter leading-none origin-left">{kpi.val.toLocaleString()}</h2>
 <p className="text-[11px] font-bold text-white/60 mt-2 uppercase tracking-wide">Updated just now</p>
 </div>
 
 <div className="absolute -right-6 -bottom-8 opacity-15 w-32 h-32 text-[120px] material-symbols-outlined select-none rotate-12 mix-blend-overlay">
 {kpi.icon}
 </div>
 </div>
 ))}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 
 {/* Left Column: Deep Detail Feed (Flat & Clean) */}
 <div className="lg:col-span-2 space-y-4">
 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
 <div className="px-6 py-5 border-b border-slate-100 mobile-row flex items-center justify-between bg-slate-50/50">
 <div>
 <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">บันทึกการเคลื่อนไหว</h3>
 <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">ข้อมูลธุรกรรมแบบเรียลไทม์</p>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded cursor-pointer">ล่าสุด 30 รายการ</span>
 </div>
 </div>
 <div className="flex-1 overflow-auto bg-white">
 <table className="w-full text-left border-collapse">
 <thead className="bg-white sticky top-0 z-10 border-b border-slate-200">
 <tr>
 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">หมายเลขธุรกรรม / เวลา</th>
 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">การดำเนินการ / ปลายทาง</th>
 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">รายละเอียดพัสดุ</th>
 <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ปริมาณ(ชิ้น)</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100/80">
 {detailedFeed.map((t, i) => {
 const isOut = t.สถานะ?.includes('เบิกออก');
 const isVoid = t.สถานะ?.includes('ยกเลิก');
 const statusColor = isVoid ? 'text-slate-400 bg-slate-100' : isOut ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50';
 
 return (
 <tr key={i} className=" group">
 
 {/* TIME / IDENTIFIER */}
 <td className="px-6 py-4 align-top">
 <div className="flex flex-col space-y-1">
 <span className="text-[13px] font-black text-slate-900 tracking-tight">{t.เลขที่รายการ ||`TRX-${i}`}</span>
 <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 font-mono">
 <span className="material-symbols-outlined text-[14px]">schedule</span>
 {new Date(t['วัน-เวลา']).toLocaleString('th-TH', { 
 day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
 })}
 </div>
 </div>
 </td>

 {/* OPERATOR & LOCATION */}
 <td className="px-6 py-4 align-top">
 <div className="flex items-start gap-3">
 <div className="mt-1">
 <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.1em] border border-transparent ${statusColor}`}>
 {t.สถานะ}
 </span>
 </div>
 <div className="flex flex-col space-y-1">
 <span className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
 <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
 {t['ผู้ทำรายการ'] || 'Unknown'}
 </span>
 <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
 <span className="material-symbols-outlined text-[14px] text-slate-400">pin_drop</span>
 {t['เขตการทำงาน'] || t['CV'] || 'Central Hub'}
 </span>
 </div>
 </div>
 </td>

 {/* ASSET DETAILS */}
 <td className="px-6 py-4 align-top">
 <div className="flex flex-col space-y-1.5">
 <span className="text-[13px] font-black text-slate-700 truncate max-w-[250px]" title={t.รายการ}>{t.รายการ}</span>
 <div className="flex flex-wrap gap-1.5">
 {t.ประเภท && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 border border-slate-200 text-slate-500 rounded bg-white">{t.ประเภท}</span>}
 {t['ยี่ห้อหรือรูปแบบ'] && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 border border-slate-200 text-slate-500 rounded bg-white">{t['ยี่ห้อหรือรูปแบบ']}</span>}
 {t.สภาพ && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 border border-slate-200 text-slate-500 rounded bg-white">{t.สภาพ}</span>}
 {t.serial_number && <span className="text-[9px] font-black tracking-widest px-1.5 border border-slate-900 text-white rounded bg-slate-900">S/N {t.serial_number}</span>}
 {(t.asset_tag || t.assetTag) && <span className="text-[9px] font-black tracking-widest px-1.5 border border-indigo-600 text-indigo-700 rounded bg-indigo-50">TAG {t.asset_tag || t.assetTag}</span>}
 </div>
 </div>
 </td>

 {/* VOLUME */}
 <td className="px-6 py-4 text-right align-top">
 <div className="flex flex-col items-end">
 <span className={`text-[18px] font-black tracking-tighter ${isVoid ? 'text-slate-300 line-through' : isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
 {isOut ? '-' : '+'}{Math.abs(t.จำนวน || 0).toLocaleString()}
 </span>
 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Units</span>
 </div>
 </td>

 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 </div>

 {/* Right Column: AI Insights & Period Swapper */}
 <div className="space-y-4">
 
 {/* Top Moving Items Rankings */}
 {advancedStats.topItemList.length > 0 && (
 <div className="bg-white rounded-xl border border-slate-200 p-6">
 <div className="flex items-center gap-2 mb-4 text-slate-800">
 <span className="material-symbols-outlined text-[18px]">inventory_2</span>
 <h3 className="text-[12px] font-black uppercase tracking-[0.2em]">5 อันดับสินค้าขยับสูงสุด</h3>
 </div>
 <div className="grid grid-cols-1 gap-2">
 {advancedStats.topItemList.map((item: any, i: number) => (
 <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 group">
 <span className="text-[12px] font-bold text-slate-700 truncate pr-2 flex items-center gap-2">
 <span className="text-[10px] font-mono text-slate-400 bg-slate-200 w-5 h-5 flex items-center justify-center rounded-full">{i+1}</span>
 {item.name}
 </span>
 <span className="text-[14px] font-black text-slate-900 shrink-0">{item.val.toLocaleString()}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Top Performers Section */}
 <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
 <div className="flex items-center gap-2 mb-2 text-indigo-600">
 <span className="material-symbols-outlined text-[18px]">military_tech</span>
 <h3 className="text-[12px] font-black uppercase tracking-[0.2em]">ผู้ทำรายการสูงสุดตามประเภท</h3>
 </div>
 
 {advancedStats.topInList.length > 0 && (
 <div className="space-y-2">
 <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">รับเข้าสูงสุด</p>
 <div className="grid grid-cols-1 gap-1.5">
 {advancedStats.topInList.map((op: any, i: number) => (
 <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
 <span className="text-[11px] font-bold text-slate-600 flex items-center gap-2"><span className="text-[10px] text-slate-400 font-mono">{i+1}.</span>{op.name}</span>
 <span className="text-[11px] font-black text-emerald-600">{op.val.toLocaleString()}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {advancedStats.topOutList.length > 0 && (
 <div className="space-y-2">
 <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">เบิกออกสูงสุด</p>
 <div className="grid grid-cols-1 gap-1.5">
 {advancedStats.topOutList.map((op: any, i: number) => (
 <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
 <span className="text-[11px] font-bold text-slate-600 flex items-center gap-2"><span className="text-[10px] text-slate-400 font-mono">{i+1}.</span>{op.name}</span>
 <span className="text-[11px] font-black text-amber-600">{op.val.toLocaleString()}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {advancedStats.topVoidList.length > 0 && (
 <div className="space-y-2">
 <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">ยกเลิกสูงสุด</p>
 <div className="grid grid-cols-1 gap-1.5">
 {advancedStats.topVoidList.map((op: any, i: number) => (
 <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
 <span className="text-[11px] font-bold text-slate-600 flex items-center gap-2"><span className="text-[10px] text-slate-400 font-mono">{i+1}.</span>{op.name}</span>
 <span className="text-[11px] font-black text-slate-500">{op.val.toLocaleString()}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Trend Period Selector */}
 <div className="bg-white border border-slate-200 p-1.5 rounded-xl flex gap-1">
 {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
 <button key={p} onClick={() => setPeriod(p)} className={`flex-1 h-10 rounded-lg font-black text-[10px] uppercase tracking-[0.2em] border ${period === p ? 'bg-slate-900 text-white border-slate-900' : 'bg-transparent text-slate-400 border-transparent '}`}>
 {p === 'daily' ? 'วัน' : p === 'weekly' ? 'สัปดาห์' : p === 'monthly' ? 'เดือน' : 'ปี'}
 </button>
 ))}
 </div>

 {/* Premium Trend Insight Visualizer */}
 <div className="bg-white rounded-xl border border-slate-200/60 p-8 space-y-8 relative overflow-hidden group">
 <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
 
 <div className="mobile-row flex items-center justify-between relative z-10">
 <div className="space-y-1">
 <h3 className="text-[16px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
 <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
 <span className="material-symbols-outlined text-[20px] leading-none">analytics</span>
 </div>
 Productivity Matrix
 </h3>
 <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider ml-11">วิเคราะห์แนวโน้มราย {period === 'daily' ? 'วัน' : period === 'weekly' ? 'สัปดาห์' : period === 'monthly' ? 'เดือน' : 'ปี'}</p>
 </div>
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2">
 <span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span>
 <span className="text-[11px] font-black text-slate-500">INBOUND</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></span>
 <span className="text-[11px] font-black text-slate-500">OUTBOUND</span>
 </div>
 </div>
 </div>
 
 <div className="h-[360px] w-full mt-4 relative z-10">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
 <defs>
 <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
 </linearGradient>
 <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <XAxis 
 dataKey="name" 
 axisLine={false} 
 tickLine={false} 
 tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} 
 dy={15} 
 />
 <YAxis 
 axisLine={false} 
 tickLine={false} 
 tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} 
 />
 <Tooltip 
 cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '5 5' }}
 contentStyle={{ 
 borderRadius: '20px', 
 border: '1px solid rgba(226, 232, 240, 0.6)', 
 padding: '16px',
 background: 'rgba(255, 255, 255, 0.9)'
 }}
 itemStyle={{ fontWeight: '800', fontSize: '13px', paddingTop: '4px' }}
 labelStyle={{ fontWeight: '900', color: '#0f172a', marginBottom: '8px', fontSize: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}
 />
 <Area 
 type="monotone" 
 dataKey="รับเข้า (IN)" 
 stroke="#f43f5e" 
 strokeWidth={4} 
 fillOpacity={1} 
 fill="url(#colorIn)" 
 animationDuration={1500}
 />
 <Area 
 type="monotone" 
 dataKey="เบิกออก (OUT)" 
 stroke="#4f46e5" 
 strokeWidth={4} 
 fillOpacity={1} 
 fill="url(#colorOut)" 
 animationDuration={2000}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
 </div>

 </div>

 </div>
 );
};

export default Reports;
