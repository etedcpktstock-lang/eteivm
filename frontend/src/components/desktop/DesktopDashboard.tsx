import React, { useMemo, useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns';
import { th } from 'date-fns/locale/th';
import { safeParseDate } from '../../utils/dateTimeUtils';
import { ArrowDownCircle, ArrowUpCircle, XCircle, PackageCheck } from 'lucide-react';
import type { RangePreset, DesktopDashboardProps, DashboardAlert } from './DesktopDashboard.types';
import {
  DashboardComparisonStrip,
  DashboardKpiGrid,
  DashboardRecentActivityCard,
  DashboardTopEntitiesCard,
  DashboardTopMoversCard,
  DashboardAlertsPanel,
  DashboardOperationsPanel,
  DashboardLowStockCard,
} from './DesktopDashboardSections';
import {
  DashboardStockCompositionCard,
  DashboardComparisonChartCard,
} from './DesktopDashboardCharts';
import { DashboardTrendCard } from './DesktopDashboardTrendCard';


function toSafeNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDelta(value: number) {
  if (value > 0) return `+${value.toLocaleString()}`;
  if (value < 0) return `${value.toLocaleString()}`;
  return '0';
}

function formatDeltaPercent(current: number, previous: number) {
  if (!previous && !current) return '0%';
  if (!previous && current > 0) return 'ใหม่';
  const diff = ((current - previous) / previous) * 100;
  const rounded = Math.round(diff);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function getActionCategory(status: string): 'IN' | 'OUT' | 'RETURN' | 'VOID' | 'OTHER' {
  const s = (status || '').toLowerCase();
  if (s === 'รับเข้า' || s.includes('พร้อมใช้งาน') || s.includes('ซ่อมเสร็จ')) return 'IN';
  if (s === 'เบิกออก' || s.includes('ส่งมอบเรียบร้อย') || s.includes('กำลังเดินทาง') || s === 'แจ้งส่ง') return 'OUT';
  if (s === 'รับคืน' || s === 'แจ้งคืน' || s.includes('กำลังเดินทางกลับ') || s === 'รอตรวจสอบ') return 'RETURN';
  if (s.includes('ยกเลิก')) return 'VOID';
  return 'OTHER';
}

export default function DesktopDashboard({
  transactions,
  items,
  warehouses = [],
  user,
  onRefresh,
  loading,
  setActiveTab,
  allRepair,
  allScrap,
  allLost,
}: DesktopDashboardProps) {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const [rangePreset, setRangePreset] = useState<RangePreset>('7d');
  const [customStart, setCustomStart] = useState(format(subDays(now, 6), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(todayStr);

  const dateRange = useMemo(() => {
    switch (rangePreset) {
      case '7d': return { start: subDays(now, 6), end: now };
      case '30d': return { start: subDays(now, 29), end: now };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom': return { start: safeParseDate(customStart), end: safeParseDate(customEnd + 'T23:59:59') };
      default: return { start: subDays(now, 6), end: now };
    }
  }, [rangePreset, customStart, customEnd, now]);

  const rangeLabel = useMemo(() => {
    return `${format(dateRange.start, 'd MMM yy', { locale: th })} – ${format(dateRange.end, 'd MMM yy', { locale: th })}`;
  }, [dateRange]);

  const previousDateRange = useMemo(() => {
    const spanDays = Math.max(differenceInCalendarDays(dateRange.end, dateRange.start) + 1, 1);
    const previousEnd = subDays(dateRange.start, 1);
    const previousStart = subDays(previousEnd, spanDays - 1);
    return { start: previousStart, end: previousEnd };
  }, [dateRange]);

  const stats = useMemo(() => {
    const todayTx = transactions.filter((t) => String(t['วัน-เวลา'] || '').startsWith(todayStr));
    const totalQty = items.reduce((s, it) => s + toSafeNumber(it.จำนวน), 0);
    const transit = items.reduce((s, it) => s + toSafeNumber(it.transit_qty), 0);
    const quarantine = items.reduce((s, it) => s + toSafeNumber(it.quarantine_qty), 0);
    const repair = allRepair || items.reduce((s, it) => s + toSafeNumber(it.repair_qty), 0);
    const scrap = allScrap || items.reduce((s, it) => s + toSafeNumber(it.scrap_qty), 0);
    const lost = allLost || items.reduce((s, it) => s + toSafeNumber(it.lost_qty), 0);
    const available = Math.max(totalQty - transit - quarantine - repair - scrap - lost, 0);

    return {
      totalQty,
      available,
      transit,
      quarantine,
      receiveToday: todayTx.filter((t) => getActionCategory(t.สถานะ) === 'IN').length,
      issueToday: todayTx.filter((t) => getActionCategory(t.สถานะ) === 'OUT').length,
      repair,
      scrap,
      lost,
    };
  }, [transactions, items, allRepair, allScrap, allLost, todayStr]);

  const rangeTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const d = safeParseDate(t['วัน-เวลา']);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [transactions, dateRange]);

  const previousRangeTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const d = safeParseDate(t['วัน-เวลา']);
      return d >= previousDateRange.start && d <= previousDateRange.end;
    });
  }, [transactions, previousDateRange]);

  const rangeStats = useMemo(() => {
    return {
      receive: rangeTransactions.filter(t => getActionCategory(t.สถานะ) === 'IN').length,
      issue: rangeTransactions.filter(t => getActionCategory(t.สถานะ) === 'OUT').length,
      return: rangeTransactions.filter(t => getActionCategory(t.สถานะ) === 'RETURN').length,
      void: rangeTransactions.filter(t => getActionCategory(t.สถานะ) === 'VOID').length,
      totalQty: rangeTransactions.reduce((sum, t) => sum + toSafeNumber(t.จำนวน), 0),
      activeZones: new Set(rangeTransactions.map((t) => (t.เขตการทำงาน || '').trim()).filter(Boolean)).size,
      activeCustomers: new Set(rangeTransactions.map((t) => (t.CV || '').trim()).filter(Boolean)).size,
    };
  }, [rangeTransactions]);

  const previousRangeStats = useMemo(() => {
    return {
      receive: previousRangeTransactions.filter(t => getActionCategory(t.สถานะ) === 'IN').length,
      issue: previousRangeTransactions.filter(t => getActionCategory(t.สถานะ) === 'OUT').length,
      return: previousRangeTransactions.filter(t => getActionCategory(t.สถานะ) === 'RETURN').length,
      void: previousRangeTransactions.filter(t => getActionCategory(t.สถานะ) === 'VOID').length,
      activeZones: new Set(previousRangeTransactions.map((t) => (t.เขตการทำงาน || '').trim()).filter(Boolean)).size,
      activeCustomers: new Set(previousRangeTransactions.map((t) => (t.CV || '').trim()).filter(Boolean)).size,
    };
  }, [previousRangeTransactions]);

  const chartData = useMemo(() => {
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const data = [];
    const step = days <= 14 ? 1 : Math.ceil(days / 14);

    for (let i = 0; i < days; i += step) {
      const date = new Date(dateRange.start);
      date.setDate(dateRange.start.getDate() + i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayTxns = transactions.filter(t => String(t['วัน-เวลา'] || '').startsWith(dateStr));
      data.push({
        name: format(date, 'd MMM', { locale: th }),
        date: dateStr,
        'รับเข้า': dayTxns.filter(t => getActionCategory(t.สถานะ) === 'IN').length,
        'เบิกออก': dayTxns.filter(t => getActionCategory(t.สถานะ) === 'OUT').length,
        'รับคืน': dayTxns.filter(t => getActionCategory(t.สถานะ) === 'RETURN').length,
      });
    }
    return data;
  }, [transactions, dateRange]);

  const sparklineData = useMemo(() => {
    // Last 14 days for sparklines
    const days = 14;
    const data = [];
    for (let i = 0; i < days; i++) {
      const date = subDays(now, (days - 1) - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayTxns = transactions.filter(t => String(t['วัน-เวลา'] || '').startsWith(dateStr));
      data.push({
        date: dateStr,
        in: dayTxns.filter(t => getActionCategory(t.สถานะ) === 'IN').length,
        out: dayTxns.filter(t => getActionCategory(t.สถานะ) === 'OUT').length,
        ret: dayTxns.filter(t => getActionCategory(t.สถานะ) === 'RETURN').length,
      });
    }
    return data;
  }, [transactions, now]);


  const recentActivity = useMemo(() => {
    return [...transactions]
      .sort((a, b) => safeParseDate(b['วัน-เวลา']).getTime() - safeParseDate(a['วัน-เวลา']).getTime())
      .slice(0, 12);
  }, [transactions]);

  const executiveKpis = useMemo(() => {
    const receiveDelta = rangeStats.receive - previousRangeStats.receive;
    const issueDelta = rangeStats.issue - previousRangeStats.issue;
    const returnDelta = rangeStats.return - previousRangeStats.return;
    const zoneDelta = rangeStats.activeZones - previousRangeStats.activeZones;

    return [
      {
        id: 'inventory',
        label: 'พร้อมใช้งาน',
        value: stats.available,
        footnote: `จากทั้งหมด ${stats.totalQty.toLocaleString()} ชิ้น`,
        deltaLabel: 'stock พร้อมจ่าย',
        tone: '#0f766e',
        sparkline: sparklineData.map(d => ({ value: d.in + d.out })), // Mixed trend for stock
      },
      {
        id: 'logistics',
        label: 'พัสดุระหว่างส่ง',
        value: stats.transit,
        footnote: stats.transit > 0 ? 'ควรติดตามสถานะจัดส่ง' : 'ไม่มีค้างระหว่างส่ง',
        deltaLabel: 'กำลังเคลื่อนย้าย',
        tone: '#2563eb',
        sparkline: sparklineData.map(d => ({ value: d.out })),
      },
      {
        id: 'repair',
        label: 'Quarantine',
        value: stats.quarantine,
        footnote: 'รายการพักตรวจ/ยังไม่พร้อมใช้',
        deltaLabel: 'รอการตรวจสอบ',
        tone: '#7c3aed',
        sparkline: sparklineData.map(d => ({ value: d.ret })),
      },
      {
        id: 'repair',
        label: 'รอซ่อม',
        value: stats.repair,
        footnote: stats.repair > 0 ? 'มี backlog ต้องติดตาม' : 'ไม่มีรายการค้างซ่อม',
        deltaLabel: 'repair backlog',
        tone: '#dc2626',
        sparkline: sparklineData.map(d => ({ value: 0 })), // Fallback
      },
      {
        id: 'history',
        label: 'รับเข้าในช่วง',
        value: rangeStats.receive,
        footnote: `เทียบช่วงก่อน ${formatDelta(receiveDelta)}`,
        deltaLabel: formatDeltaPercent(rangeStats.receive, previousRangeStats.receive),
        tone: '#10b981',
        sparkline: sparklineData.map(d => ({ value: d.in })),
      },
      {
        id: 'history',
        label: 'เบิกออกในช่วง',
        value: rangeStats.issue,
        footnote: `เทียบช่วงก่อน ${formatDelta(issueDelta)}`,
        deltaLabel: formatDeltaPercent(rangeStats.issue, previousRangeStats.issue),
        tone: '#f59e0b',
        sparkline: sparklineData.map(d => ({ value: d.out })),
      },
      {
        id: 'history',
        label: 'รับคืนในช่วง',
        value: rangeStats.return,
        footnote: `เทียบช่วงก่อน ${formatDelta(returnDelta)}`,
        deltaLabel: formatDeltaPercent(rangeStats.return, previousRangeStats.return),
        tone: '#8b5cf6',
        sparkline: sparklineData.map(d => ({ value: d.ret })),
      },
      {
        id: 'reports',
        label: 'พื้นที่ active',
        value: rangeStats.activeZones,
        footnote: `${rangeStats.activeCustomers.toLocaleString()} CV เคลื่อนไหว`,
        deltaLabel: `Δ ${formatDelta(zoneDelta)}`,
        tone: '#334155',
        sparkline: sparklineData.map(d => ({ value: d.in + d.out + d.ret })), // overall activity
      },
    ];
  }, [stats, rangeStats, previousRangeStats, sparklineData]);

  const alertItems = useMemo<DashboardAlert[]>(() => {
    const alerts: DashboardAlert[] = [];

    if (stats.lost > 0) {
      alerts.push({
        key: 'lost',
        tone: 'danger',
        title: 'พบพัสดุสูญหาย',
        detail: 'ควรไล่ตรวจสอบรายการและเส้นทางที่เกี่ยวข้อง',
        value: stats.lost,
      });
    }

    if (stats.scrap > 0) {
      alerts.push({
        key: 'scrap',
        tone: 'warning',
        title: 'มีรายการรอจำหน่าย',
        detail: 'ตรวจคิวอนุมัติ/ตัดจ่ายเพื่อลดของค้าง',
        value: stats.scrap,
      });
    }

    if (stats.repair >= 5) {
      alerts.push({
        key: 'repair',
        tone: 'warning',
        title: 'คิวซ่อมเริ่มสูง',
        detail: 'backlog ฝั่ง repair ควรถูกติดตามใกล้ชิด',
        value: stats.repair,
      });
    }

    const lowStockCount = items.filter(it => toSafeNumber(it.จำนวน) > 0 && toSafeNumber(it.จำนวน) < 5).length;
    if (lowStockCount > 0) {
      alerts.push({
        key: 'low-stock',
        tone: 'danger',
        title: 'สินค้าเหลือน้อยกว่า 5 ชิ้น',
        detail: `มีทั้งหมด ${lowStockCount} รายการที่ใกล้หมดสต็อก`,
        value: lowStockCount,
      });
    }

    if (stats.transit >= 10) {
      alerts.push({
        key: 'transit',
        tone: 'info',
        title: 'พัสดุระหว่างส่งค่อนข้างมาก',
        detail: 'ตรวจคู่กับ logistics board เพื่อกันงานค้างส่ง',
        value: stats.transit,
      });
    }

    if (rangeStats.void > 0) {
      alerts.push({
        key: 'void',
        tone: 'info',
        title: 'มีรายการยกเลิกในช่วงที่เลือก',
        detail: 'ควรดูสาเหตุการยกเลิกว่ามาจาก stock, logistics หรือข้อมูลลูกค้า',
        value: rangeStats.void,
      });
    }

    if (rangeStats.return > rangeStats.issue && rangeStats.return > 0) {
      alerts.push({
        key: 'returns-high',
        tone: 'warning',
        title: 'รับคืนมากกว่าเบิกออก',
        detail: 'อาจมีงานคืน/ซ่อมสะสมผิดปกติในช่วงนี้',
        value: rangeStats.return,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        key: 'clear',
        tone: 'success',
        title: 'ภาพรวมอยู่ในเกณฑ์ปกติ',
        detail: 'ยังไม่พบ alert สำคัญจากกฎรอบแรกของ dashboard',
      });
    }

    return alerts.slice(0, 5);
  }, [stats, rangeStats]);

  const operationsCards = useMemo(() => {
    return [
      {
        label: 'รับเข้าวันนี้',
        value: stats.receiveToday,
        icon: ArrowDownCircle,
        color: '#10b981',
        hint: 'รายการที่ปิดรับแล้ววันนี้',
      },
      {
        label: 'เบิกออกวันนี้',
        value: stats.issueToday,
        icon: ArrowUpCircle,
        color: '#f59e0b',
        hint: 'รายการที่จ่ายออกวันนี้',
      },
      {
        label: 'CV เคลื่อนไหว',
        value: rangeStats.activeCustomers,
        icon: PackageCheck,
        color: '#2563eb',
        hint: 'ลูกค้าที่มี movement ในช่วงนี้',
      },
      {
        label: 'รายการยกเลิก',
        value: rangeStats.void,
        icon: XCircle,
        color: '#ef4444',
        hint: 'ควรเปิดดูเหตุผลและจุดติดขัด',
      },
    ];
  }, [stats, rangeStats]);

  const stockCompositionData = useMemo(() => {
    return [
      { name: 'พร้อมใช้งาน', value: stats.available },
      { name: 'ระหว่างส่ง', value: stats.transit },
      { name: 'Quarantine', value: stats.quarantine },
      { name: 'รอซ่อม', value: stats.repair },
      { name: 'รอจำหน่าย', value: stats.scrap },
      { name: 'สูญหาย', value: stats.lost },
    ].filter((entry) => entry.value > 0);
  }, [stats]);

  const comparisonData = useMemo(() => {
    const warehouseNameMap = new Map<number, string>();
    warehouses.forEach((warehouse: any) => {
      const id = Number(warehouse?.id);
      if (!Number.isFinite(id)) return;
      warehouseNameMap.set(id, String(warehouse?.name || warehouse?.warehouse_name || `คลัง #${id}`));
    });

    const warehouseMap = new Map<number, { name: string; total: number }>();

    items.forEach((item) => {
      item.warehouse_stocks?.forEach((ws) => {
        const warehouseId = Number(ws.warehouseId);
        if (!Number.isFinite(warehouseId)) return;
        const displayName = warehouseNameMap.get(warehouseId) || `คลัง #${warehouseId}`;
        const current = warehouseMap.get(warehouseId) || { name: displayName, total: 0 };
        current.total += toSafeNumber(ws.stock) + toSafeNumber(ws.transit) + toSafeNumber(ws.quarantine) + toSafeNumber(ws.repair);
        warehouseMap.set(warehouseId, current);
      });
    });

    const warehouseData = Array.from(warehouseMap.values())
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map((entry) => ({ label: entry.name, value: entry.total }));

    if (warehouseData.length >= 2) {
      return {
        title: 'เปรียบเทียบตามคลัง',
        subtitle: 'ใช้ยอดรวมจาก warehouse_stocks ที่มีอยู่ใน item data',
        data: warehouseData,
      };
    }

    const zoneMap = new Map<string, number>();
    rangeTransactions.forEach((tx) => {
      const zone = String(tx.เขตการทำงาน || 'ไม่ระบุโซน').trim() || 'ไม่ระบุโซน';
      zoneMap.set(zone, (zoneMap.get(zone) || 0) + 1);
    });

    const zoneData = Array.from(zoneMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return {
      title: 'โซนที่มี movement สูงสุด',
      subtitle: 'fallback จาก transaction ช่วงเวลาที่เลือก',
      data: zoneData,
    };
  }, [items, rangeTransactions, warehouses]);

  const topMovers = useMemo(() => {
    const itemMap = new Map<string, { label: string; count: number; qty: number }>();

    rangeTransactions.forEach((tx) => {
      const label = String(tx.รายการ || tx.ประเภท || 'ไม่ระบุรายการ').trim() || 'ไม่ระบุรายการ';
      const current = itemMap.get(label) || { label, count: 0, qty: 0 };
      current.count += 1;
      current.qty += toSafeNumber(tx.จำนวน);
      itemMap.set(label, current);
    });

    return Array.from(itemMap.values())
      .sort((a, b) => (b.qty - a.qty) || (b.count - a.count))
      .slice(0, 5);
  }, [rangeTransactions]);

  const topActiveCustomers = useMemo(() => {
    const customerMap = new Map<string, { label: string; count: number; qty: number }>();
    rangeTransactions.forEach((tx) => {
      const label = String(tx.CV || 'ไม่ระบุ CV').trim() || 'ไม่ระบุ CV';
      const current = customerMap.get(label) || { label, count: 0, qty: 0 };
      current.count += 1;
      current.qty += toSafeNumber(tx.จำนวน);
      customerMap.set(label, current);
    });
    return Array.from(customerMap.values())
      .sort((a, b) => (b.count - a.count) || (b.qty - a.qty))
      .slice(0, 5);
  }, [rangeTransactions]);

  const topActiveZones = useMemo(() => {
    const zoneMap = new Map<string, { label: string; count: number; qty: number }>();
    rangeTransactions.forEach((tx) => {
      const label = String(tx.เขตการทำงาน || 'ไม่ระบุโซน').trim() || 'ไม่ระบุโซน';
      const current = zoneMap.get(label) || { label, count: 0, qty: 0 };
      current.count += 1;
      current.qty += toSafeNumber(tx.จำนวน);
      zoneMap.set(label, current);
    });
    return Array.from(zoneMap.values())
      .sort((a, b) => (b.count - a.count) || (b.qty - a.qty))
      .slice(0, 5);
  }, [rangeTransactions]);

  const lowStockItems = useMemo(() => {
    return items
      .filter(item => toSafeNumber(item.จำนวน) < 5)
      .sort((a, b) => toSafeNumber(a.จำนวน) - toSafeNumber(b.จำนวน))
      .slice(0, 8);
  }, [items]);

  const comparisonStrip = useMemo(() => {
    return [
      {
        label: 'รับเข้า',
        current: rangeStats.receive,
        previous: previousRangeStats.receive,
        delta: rangeStats.receive - previousRangeStats.receive,
        targetTab: 'history',
        color: '#10b981',
      },
      {
        label: 'เบิกออก',
        current: rangeStats.issue,
        previous: previousRangeStats.issue,
        delta: rangeStats.issue - previousRangeStats.issue,
        targetTab: 'history',
        color: '#f59e0b',
      },
      {
        label: 'ลูกค้า active',
        current: rangeStats.activeCustomers,
        previous: previousRangeStats.activeCustomers,
        delta: rangeStats.activeCustomers - previousRangeStats.activeCustomers,
        targetTab: 'reports',
        color: '#2563eb',
      },
      {
        label: 'โซน active',
        current: rangeStats.activeZones,
        previous: previousRangeStats.activeZones,
        delta: rangeStats.activeZones - previousRangeStats.activeZones,
        targetTab: 'reports',
        color: '#7c3aed',
      },
    ];
  }, [rangeStats, previousRangeStats]);

  const rangeKpis = useMemo(() => [
    { label: 'รับเข้า', val: rangeStats.receive, prev: previousRangeStats.receive, icon: ({ size, style }: any) => <span style={{ ...style, fontSize: size }}>↓</span>, color: '#10b981' },
    { label: 'เบิกออก', val: rangeStats.issue, prev: previousRangeStats.issue, icon: ({ size, style }: any) => <span style={{ ...style, fontSize: size }}>↑</span>, color: '#f59e0b' },
    { label: 'รับคืน', val: rangeStats.return, prev: previousRangeStats.return, icon: ({ size, style }: any) => <span style={{ ...style, fontSize: size }}>↻</span>, color: '#8b5cf6' },
    { label: 'ยกเลิก', val: rangeStats.void, prev: previousRangeStats.void, icon: ({ size, style }: any) => <span style={{ ...style, fontSize: size }}>✕</span>, color: '#ef4444' },
  ], [rangeStats, previousRangeStats]);

  const navigateTo = (tab: any) => {
    if (tab) setActiveTab?.(tab);
  };

  return (
    <div className="desktop-page">
      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">แดชบอร์ดภาพรวม</h2>
          <p className="plain-subtitle">
            ยินดีต้อนรับกลับมา, คุณ {user.name} • {format(new Date(), "EEEE 'ที่' d MMMM yyyy", { locale: th })}
          </p>
        </div>
      </div>

      <DashboardKpiGrid items={executiveKpis} onNavigate={navigateTo} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(640px, 2.2fr)', gap: 20, marginBottom: 20 }}>
        <DashboardRecentActivityCard items={recentActivity} onNavigate={navigateTo} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DashboardTrendCard
            rangeLabel={rangeLabel}
            rangePreset={rangePreset}
            onRangePresetChange={setRangePreset}
            customStart={customStart}
            onCustomStartChange={setCustomStart}
            customEnd={customEnd}
            onCustomEndChange={setCustomEnd}
            rangeKpis={rangeKpis}
            chartData={chartData}
            alertItems={alertItems}
            operationsCards={operationsCards}
            onRefresh={onRefresh}
            loading={loading}
            formatDelta={formatDelta}
            onNavigate={navigateTo}
            phaseNote="ระบบแดชบอร์ดได้รับการอัปเกรดเป็นเวอร์ชันพรีเมียม พร้อมการแสดงผลแนวโน้มแบบใหม่และการกรองข้อมูลที่แม่นยำขึ้น"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <DashboardAlertsPanel items={alertItems} />
            <DashboardOperationsPanel items={operationsCards} onNavigate={navigateTo} note="เน้นการติดตามสถานะแบบ Real-time และการจัดการพัสดุระหว่างส่ง" />
          </div>
        </div>
      </div>

      <DashboardComparisonStrip items={comparisonStrip} onNavigate={navigateTo} formatDelta={formatDelta} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(420px, 1.35fr)', gap: 20, marginBottom: 20 }}>
        <DashboardStockCompositionCard data={stockCompositionData} onNavigate={navigateTo} />

        <DashboardComparisonChartCard data={comparisonData} onNavigate={navigateTo} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr) minmax(320px, 1fr)', gap: 20, marginBottom: 20 }}>
        <DashboardTopMoversCard items={topMovers} onNavigate={navigateTo} />

        <DashboardTopEntitiesCard topActiveCustomers={topActiveCustomers} topActiveZones={topActiveZones} onNavigate={navigateTo} />
        
        <DashboardLowStockCard items={lowStockItems} onNavigate={navigateTo} />
      </div>
    </div>
  );
}
