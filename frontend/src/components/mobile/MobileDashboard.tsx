import React, { useState, useMemo } from 'react';
import { 
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
 AreaChart, Area
} from 'recharts';
import { 
 ArrowDownCircle, 
 ArrowUpCircle, 
 RotateCcw, 
 XCircle, 
 TrendingUp,
 Activity
} from 'lucide-react';
import { 
 subDays, subMonths, format 
} from 'date-fns';
import { th } from 'date-fns/locale/th';
import { safeParseDate } from '../../utils/dateTimeUtils';
import type { Transaction, MaterialItem } from '../../types';

interface MobileDashboardProps {
 items: MaterialItem[];
 transactions: Transaction[];
 user: any;
 onRefresh?: () => void;
}

export default function MobileDashboard({ transactions, items, user }: MobileDashboardProps) {
 const now = new Date();
 const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('day');
 
 const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];

 // 1. Calculate Summary Metrics
 const stats = useMemo(() => {
 const n = new Date();
 const getRangeInterval = () => {
 switch (timeRange) {
 case 'day': return { start: new Date(n.setHours(0,0,0,0)), end: new Date(n.setHours(23,59,59,999)) };
 case 'week': return { start: subDays(n, 6), end: n };
 case 'month': return { start: subDays(n, 29), end: n };
 case 'year': return { start: subMonths(n, 11), end: n };
 default: return { start: n, end: n };
 }
 };
 const interval = getRangeInterval();
 const filteredTxns = transactions.filter(t => {
 const d = safeParseDate(t['วัน-เวลา']);
 return d >= interval.start && d <= interval.end;
 });

 return {
 receive: filteredTxns.filter(t => t.สถานะ === 'รับเข้า').length,
 issue: filteredTxns.filter(t => t.สถานะ === 'เบิกออก').length,
 return: filteredTxns.filter(t => t.สถานะ === 'รับคืน').length,
 void: filteredTxns.filter(t => (t.สถานะ || '').includes('ยกเลิก')).length,
 };
 }, [transactions, timeRange]);

 // 2. Prepare Chart Data (Simplified for Mobile)
 const chartData = useMemo(() => {
 const data = [];
 const getCounts = (txns: any[]) => ({
 'รับเข้า': txns.filter(t => t.สถานะ === 'รับเข้า').length,
 'เบิกออก': txns.filter(t => t.สถานะ === 'เบิกออก').length,
 });

 if (timeRange === 'day') {
 const todayStr = format(now, 'yyyy-MM-dd');
 for (let i = 0; i < 24; i+=2) { // Every 2 hours to save space
 const hour = i.toString().padStart(2, '0');
 const hourTxns = transactions.filter(t => t['วัน-เวลา']?.startsWith(`${todayStr}T${hour}`));
 data.push({ name:`${hour}:00`, ...getCounts(hourTxns) });
 }
 } else if (timeRange === 'week' || timeRange === 'month') {
 const days = timeRange === 'week' ? 7 : 30;
 const step = timeRange === 'week' ? 1 : 5;
 for (let i = days - 1; i >= 0; i -= step) {
 const date = subDays(now, i);
 const dateStr = format(date, 'yyyy-MM-dd');
 data.push({ name: format(date, 'd MMM', { locale: th }), ...getCounts(transactions.filter(t => t['วัน-เวลา']?.startsWith(dateStr))) });
 }
 } else {
 for (let i = 11; i >= 0; i--) {
 const date = subMonths(now, i);
 const mStr = format(date, 'yyyy-MM');
 data.push({ name: format(date, 'MMM', { locale: th }), ...getCounts(transactions.filter(t => t['วัน-เวลา']?.startsWith(mStr))) });
 }
 }
 return data;
 }, [transactions, timeRange]);

 return (
 <div className="mobile-page-frame space-y-4">
 <div className="mobile-form-hero">
 <div className="flex flex-col gap-1">
 <h2 className="mobile-form-hero-title">แดชบอร์ดภาพรวม</h2>
 <p className="mobile-form-hero-subtitle">สรุปภาพรวมการเคลื่อนไหวของพัสดุ</p>
 </div>
 </div>

 {/* Quick Filters */}
 <div className="mobile-toolbar-card flex items-center gap-1 overflow-x-auto no-scrollbar">
 {[
 {id: 'day', label: 'วันนี้'},
 {id: 'week', label: 'สัปดาห์'},
 {id: 'month', label: 'เดือนนี้'},
 {id: 'year', label: 'ปีนี้'}
 ].map((btn) => (
 <button
 key={btn.id}
 onClick={() => setTimeRange(btn.id as any)}
 className={`flex-1 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-tight whitespace-nowrap ${
 timeRange === btn.id 
 ? 'bg-slate-900 text-white' 
 : 'text-slate-500'
 }`}
 >
 {btn.label}
 </button>
 ))}
 </div>

 {/* KPI Cards (Compact) */}
 <div className="grid grid-cols-2 gap-3">
 {[
 { label: 'รับเข้า', val: stats.receive, icon: ArrowDownCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
 { label: 'เบิกออก', val: stats.issue, icon: ArrowUpCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
 { label: 'รับคืน', val: stats.return, icon: RotateCcw, color: 'text-purple-600', bg: 'bg-purple-50' },
 { label: 'ยกเลิก', val: stats.void, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' }
 ].map((kpi, i) => (
 <div key={i} className="bg-white p-4 rounded-3xl border border-slate-100">
 <div className={`w-8 h-8 ${kpi.bg} ${kpi.color} rounded-xl flex items-center justify-center mb-3`}>
 <kpi.icon size={18} />
 </div>
 <p className="text-xl font-black text-slate-900 leading-none">{kpi.val.toLocaleString()}</p>
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{kpi.label}</p>
 </div>
 ))}
 </div>

 {/* Main Graph (Responsive) */}
 <div className="bg-white p-5 rounded-xl border border-slate-100 space-y-4">
 <div className="mobile-row flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
 <TrendingUp size={16} />
 </div>
 <h3 className="text-sm font-bold text-slate-800">แนวโน้มช่วงนี้</h3>
 </div>
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1.5">
 <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
 <span className="text-[10px] font-bold text-slate-400 uppercase">รับ</span>
 </div>
 <div className="flex items-center gap-1.5">
 <div className="w-2 h-2 rounded-full bg-amber-500"></div>
 <span className="text-[10px] font-bold text-slate-400 uppercase">เบิก</span>
 </div>
 </div>
 </div>

 <div className="h-[200px] w-full">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={chartData}>
 <defs>
 <linearGradient id="colorMobileIn" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
 <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
 </linearGradient>
 <linearGradient id="colorMobileOut" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
 <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 'bold'}} />
 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 'bold'}} width={25} />
 <Tooltip />
 <Area type="monotone" dataKey="รับเข้า" stroke="#10b981" strokeWidth={3} fill="url(#colorMobileIn)" isAnimationActive={false} />
 <Area type="monotone" dataKey="เบิกออก" stroke="#f59e0b" strokeWidth={3} fill="url(#colorMobileOut)" isAnimationActive={false} />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div className="bg-slate-900 p-5 rounded-xl text-white space-y-1">
 <p className="text-[10px] font-semibold tracking-tight text-slate-500">ภาพรวมพัสดุ</p>
 <h4 className="text-lg font-bold truncate">พัสดุทั้งหมด</h4>
 <p className="text-3xl font-black text-emerald-400">{items.length.toLocaleString()}</p>
 </div>
 <div className="bg-white p-5 rounded-xl border border-slate-100 space-y-1">
 <p className="text-[10px] font-semibold tracking-tight text-slate-500">สต็อกเฝ้าระวัง</p>
 <h4 className="text-lg font-bold text-slate-800">ของเหลือน้อย</h4>
 <p className="text-3xl font-black text-rose-500">{items.filter(i => (i.จำนวน || 0) <= 5).length}</p>
 </div>
 </div>
 </div>
 );
}
