import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, CalendarRange, FileSpreadsheet, FileText, Filter, Search } from 'lucide-react';
import type { Transaction } from '../../types';
import { exportAoaToExcel } from '../../utils/excel';

interface DesktopReportsProps {
  transactions: Transaction[];
}

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';
type FlowFilter = 'all' | 'in' | 'out' | 'void' | 'transfer';

const classifyFlow = (statusRaw: string) => {
  const status = String(statusRaw || '');
  const isVoid = status.includes('ยกเลิก');
  const isTransfer = status.includes('ย้ายพัสดุ');
  const isOut = ['เบิกออก', 'กำลังเดินทาง', 'ส่งมอบเรียบร้อย', 'สำเร็จ', 'แจ้งส่ง'].some((k) => status.includes(k));
  const isIn = ['รับเข้า', 'รอตรวจ', 'รอตรวจสอบ', 'รับคืน', 'แจ้งคืน', 'คลังกักกัน', 'ตรวจสอบแล้ว'].some((k) => status.includes(k));
  return { isVoid, isTransfer, isOut, isIn };
};

const normalizeText = (value: any) => String(value ?? '').toLowerCase();

const flowLabelMap: Record<FlowFilter, string> = {
  all: 'ทุกสถานะ',
  in: 'รับเข้า',
  out: 'เบิกออก',
  void: 'ยกเลิก',
  transfer: 'ย้ายพัสดุ',
};

const periodLabelMap: Record<Period, string> = {
  daily: 'รายวัน',
  weekly: 'รายสัปดาห์',
  monthly: 'รายเดือน',
  yearly: 'รายปี',
};

const DesktopReports: React.FC<DesktopReportsProps> = ({ transactions }) => {
  const [period, setPeriod] = useState<Period>('monthly');
  const [flowFilter, setFlowFilter] = useState<FlowFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const filteredTransactions = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return transactions.filter((t) => {
      const d = new Date(t['วัน-เวลา']);
      if (Number.isNaN(d.getTime())) return false;

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
        const hay = Object.values(t).map((v) => String(v ?? '').toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, flowFilter, keyword, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const daily: Record<string, { in: number; out: number; void: number }> = {};
    const weekly: Record<string, { in: number; out: number; void: number }> = {};
    const monthly: Record<string, { in: number; out: number; void: number }> = {};
    const yearly: Record<string, { in: number; out: number; void: number }> = {};

    filteredTransactions.forEach((t) => {
      const date = new Date(t['วัน-เวลา']);
      if (Number.isNaN(date.getTime())) return;
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const firstDayOfYear = new Date(y, 0, 1);
      const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
      const w = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      const dayKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const weekKey = `${y}-W${String(w).padStart(2, '0')}`;
      const monthKey = `${y}-${String(m).padStart(2, '0')}`;
      const yearKey = `${y}`;
      const amt = Math.abs(Number(t.จำนวน || 0));
      const { isVoid, isTransfer, isOut, isIn } = classifyFlow(t.สถานะ || '');

      [[daily, dayKey], [weekly, weekKey], [monthly, monthKey], [yearly, yearKey]].forEach(([map, key]: any) => {
        if (!map[key]) map[key] = { in: 0, out: 0, void: 0 };
        if (isVoid) map[key].void += 1;
        else if (isTransfer) {
          // transfer ไม่นับเป็น IN/OUT สุทธิ
        } else if (isOut) map[key].out += amt;
        else if (isIn) map[key].in += amt;
      });
    });

    return { daily, weekly, monthly, yearly };
  }, [filteredTransactions]);

  const currentStats = useMemo(
    () => Object.entries(stats[period]).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12),
    [stats, period]
  );

  const totals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    Object.values(stats[period]).forEach((v) => {
      totalIn += v.in;
      totalOut += v.out;
    });
    return { totalIn, totalOut };
  }, [stats, period]);

  const advancedStats = useMemo(() => {
    const zoneCount: Record<string, number> = {};
    const catCount: Record<string, number> = {};
    const hourCount: Record<string, number> = {};
    const operatorIn: Record<string, number> = {};
    const operatorOut: Record<string, number> = {};
    const operatorVoid: Record<string, number> = {};
    const itemCount: Record<string, number> = {};

    filteredTransactions.forEach((t) => {
      const zone = String(t['เขตการทำงาน'] || t['CV'] || 'Hub');
      const category = String(t.ประเภท || 'ทั่วไป');
      const hour = new Date(t['วัน-เวลา']).getHours();
      const operator = String(t['ผู้ทำรายการ'] || 'Unknown');
      const item = String(t.รายการ || 'Unknown');
      const amt = Math.abs(Number(t.จำนวน || 1));
      const { isVoid, isTransfer, isOut, isIn } = classifyFlow(t.สถานะ || '');

      if (!isVoid) itemCount[item] = (itemCount[item] || 0) + amt;
      zoneCount[zone] = (zoneCount[zone] || 0) + 1;
      catCount[category] = (catCount[category] || 0) + amt;
      hourCount[String(hour)] = (hourCount[String(hour)] || 0) + 1;

      if (isIn) operatorIn[operator] = (operatorIn[operator] || 0) + amt;
      else if (isOut) operatorOut[operator] = (operatorOut[operator] || 0) + amt;
      else if (isVoid) operatorVoid[operator] = (operatorVoid[operator] || 0) + 1;
      else if (isTransfer) {
        // no-op
      }
    });

    const getTopList = (obj: Record<string, number>, limit = 3) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, val]) => ({ name, val }));

    const getTop = (obj: Record<string, number>) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      topZone: getTop(zoneCount),
      topCat: getTop(catCount),
      peakHour: getTop(hourCount) !== 'N/A' ? `${getTop(hourCount)}:00` : 'N/A',
      topInList: getTopList(operatorIn),
      topOutList: getTopList(operatorOut),
      topVoidList: getTopList(operatorVoid),
      topItemList: getTopList(itemCount, 5),
    };
  }, [filteredTransactions]);

  const chartData = useMemo(
    () => [...currentStats].reverse().map(([key, val]) => ({ name: key, in: val.in, out: Math.abs(val.out), void: val.void })),
    [currentStats]
  );

  const detailedFeed = useMemo(
    () => [...filteredTransactions].sort((a, b) => new Date(b['วัน-เวลา']).getTime() - new Date(a['วัน-เวลา']).getTime()).slice(0, 40),
    [filteredTransactions]
  );

  const summaryRows = useMemo(
    () => [
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
        .map(([k, v]) => [k, v.in, v.out, v.in + v.out]),
    ],
    [period, flowFilter, keyword, dateFrom, dateTo, filteredTransactions.length, stats]
  );

  const makeDetailRows = (data: Transaction[]) => [
    ['เลขที่รายการ', 'วัน-เวลา', 'ผู้ทำรายการ', 'รายการพัสดุ', 'S/N', 'Asset Tag', 'สถานะ', 'จำนวน', 'ที่ไหน/CV'],
    ...data.map((t) => [
      t['เลขที่รายการ'] || '-',
      t['วัน-เวลา'] || '-',
      t['ผู้ทำรายการ'] || '-',
      t.รายการ || '-',
      t.serial_number || '-',
      t.asset_tag || t.assetTag || '-',
      t.สถานะ || '-',
      t.จำนวน || 0,
      t['เขตการทำงาน'] || t['CV'] || 'Hub',
    ]),
  ];

  const exportStyledExcel = async () => {
    const inRows = filteredTransactions.filter((t) => classifyFlow(t.สถานะ || '').isIn);
    const outRows = filteredTransactions.filter((t) => classifyFlow(t.สถานะ || '').isOut);
    const voidRows = filteredTransactions.filter((t) => classifyFlow(t.สถานะ || '').isVoid);
    const transferRows = filteredTransactions.filter((t) => classifyFlow(t.สถานะ || '').isTransfer);

    await exportAoaToExcel(
      [
        { name: 'สรุปภาพรวม', rows: summaryRows },
        { name: 'รายการรับเข้า', rows: makeDetailRows(inRows) },
        { name: 'รายการเบิกออก', rows: makeDetailRows(outRows) },
        { name: 'รายการยกเลิก', rows: makeDetailRows(voidRows) },
        { name: 'รายการย้ายพัสดุ', rows: makeDetailRows(transferRows) },
        { name: 'รายการทั้งหมด(ตามตัวกรอง)', rows: makeDetailRows(filteredTransactions) },
      ],
      `Desktop_Report_Filtered_${Date.now()}.xlsx`
    );
  };

  const exportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const doc = new jsPDF('l', 'mm', 'a4');
      doc.setFontSize(14);
      doc.text('รายงานพัสดุ (ตามตัวกรอง)', 14, 12);
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
        Math.abs(Number(t.จำนวน || 0)),
        t['เขตการทำงาน'] || t['CV'] || 'Hub',
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['#', 'เลขที่รายการ', 'วัน-เวลา', 'ผู้ทำรายการ', 'รายการ', 'S/N', 'Asset Tag', 'สถานะ', 'จำนวน', 'ที่ไหน/CV']],
        body,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255 },
      });

      doc.save(`Desktop_Report_Filtered_${Date.now()}.pdf`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const resetFilters = () => {
    setKeyword('');
    setDateFrom('');
    setDateTo('');
    setFlowFilter('all');
    setPeriod('monthly');
  };

  return (
    <div className="desktop-page">
      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">รายงานและส่งออก</h2>
          <p className="plain-subtitle">Reports center สำหรับกรองข้อมูล, วิเคราะห์ flow, trace S/N / Asset Tag และส่งออกตามตัวกรองแบบ desktop-first</p>
        </div>
      </div>

      <div className="plain-card">
        <div className="plain-card-header">
          <div className="desktop-toolbar">
            <div className="desktop-toolbar-grow" style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
              <input
                className="plain-search"
                style={{ width: '100%' }}
                placeholder="ค้นหา: เลขที่รายการ / ผู้ทำรายการ / CV / รายการ / S/N / Asset Tag"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <select className="plain-logout" style={{ width: 140 }} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              <option value="daily">รายวัน</option>
              <option value="weekly">รายสัปดาห์</option>
              <option value="monthly">รายเดือน</option>
              <option value="yearly">รายปี</option>
            </select>
            <select className="plain-logout" style={{ width: 140 }} value={flowFilter} onChange={(e) => setFlowFilter(e.target.value as FlowFilter)}>
              <option value="all">ทุกสถานะ</option>
              <option value="in">รับเข้า</option>
              <option value="out">เบิกออก</option>
              <option value="void">ยกเลิก</option>
              <option value="transfer">ย้ายพัสดุ</option>
            </select>
            <input className="plain-logout" style={{ width: 150 }} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input className="plain-logout" style={{ width: 150 }} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <button className="plain-logout" style={{ width: 72 }} onClick={resetFilters}>ล้าง</button>
            <span className="text-slate-200 mx-1">|</span>
            <button
              className="plain-logout"
              style={{ width: 'auto', padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', fontWeight: 700 }}
              onClick={exportStyledExcel}
            >
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button
              className="plain-logout"
              style={{ width: 'auto', padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b', fontWeight: 700 }}
              onClick={exportPdf} disabled={isExportingPdf}
            >
              <FileText size={15} /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="desktop-stat-grid">
        <div className="plain-kpi">
          <div className="plain-kpi-label">พัสดุรับเข้า</div>
          <div className="plain-kpi-value">{totals.totalIn.toLocaleString()}</div>
        </div>
        <div className="plain-kpi">
          <div className="plain-kpi-label">พัสดุเบิกออก</div>
          <div className="plain-kpi-value">{totals.totalOut.toLocaleString()}</div>
        </div>
        <div className="plain-kpi">
          <div className="plain-kpi-label">ปริมาณรวม</div>
          <div className="plain-kpi-value">{(totals.totalIn + totals.totalOut).toLocaleString()}</div>
        </div>
        <div className="plain-kpi">
          <div className="plain-kpi-label">ธุรกรรมตามตัวกรอง</div>
          <div className="plain-kpi-value">{filteredTransactions.length.toLocaleString()}</div>
        </div>
      </div>

      <div className="desktop-split-grid desktop-split-grid--wide-right">
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={15} /> แนวโน้ม {periodLabelMap[period]}
            </div>
            <div className="desktop-panel-body" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Area type="monotone" dataKey="in" stackId="1" stroke="#0f766e" fill="#ccfbf1" name="รับเข้า" />
                  <Area type="monotone" dataKey="out" stackId="1" stroke="#1d4ed8" fill="#dbeafe" name="เบิกออก" />
                  <Area type="monotone" dataKey="void" stackId="1" stroke="#6b7280" fill="#e5e7eb" name="ยกเลิก" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={15} /> Insight จากข้อมูลที่กรองแล้ว
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
              <div><strong>โซน/ปลายทางที่พบมากสุด:</strong> {advancedStats.topZone}</div>
              <div><strong>ประเภทพัสดุหลัก:</strong> {advancedStats.topCat}</div>
              <div><strong>ช่วงเวลาพีค:</strong> {advancedStats.peakHour}</div>
              <div>
                <strong>Top เบิกเข้า:</strong> {advancedStats.topInList.map((x) => `${x.name} (${x.val})`).join(', ') || '-'}
              </div>
              <div>
                <strong>Top เบิกออก:</strong> {advancedStats.topOutList.map((x) => `${x.name} (${x.val})`).join(', ') || '-'}
              </div>
              <div>
                <strong>Top ยกเลิก:</strong> {advancedStats.topVoidList.map((x) => `${x.name} (${x.val})`).join(', ') || '-'}
              </div>
              <div>
                <strong>Top รายการพัสดุ:</strong> {advancedStats.topItemList.map((x) => `${x.name} (${x.val})`).join(', ') || '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="plain-card">
          <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarRange size={15} /> Transaction feed ตามตัวกรอง
            </div>
            <span className="plain-badge">{flowLabelMap[flowFilter]}</span>
          </div>
          <div className="desktop-scroll desktop-scroll--tall">
            <table className="plain-table">
              <thead>
                <tr>
                  <th>เลขที่ / เวลา</th>
                  <th>ผู้ทำรายการ / ปลายทาง</th>
                  <th>รายละเอียดพัสดุ</th>
                  <th>Identifier</th>
                  <th>สถานะ</th>
                  <th>จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {detailedFeed.map((t, i) => {
                  const identifier = t.serial_number || t.asset_tag || t.assetTag || '-';
                  return (
                    <tr key={`${t['เลขที่รายการ'] || 'TX'}-${i}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t['เลขที่รายการ'] || '-'}</div>
                        <div className="plain-subtitle">{t['วัน-เวลา'] || '-'}</div>
                      </td>
                      <td>
                        <div>{t['ผู้ทำรายการ'] || '-'}</div>
                        <div className="plain-subtitle">{t['เขตการทำงาน'] || t['CV'] || 'Hub'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.รายการ || '-'}</div>
                        <div className="plain-subtitle">{normalizeText(t['ยี่ห้อหรือรูปแบบ']) ? `${t['ยี่ห้อหรือรูปแบบ']} • ` : ''}{t.ประเภท || '-'}</div>
                      </td>
                      <td>
                        <span className="plain-badge">{identifier}</span>
                      </td>
                      <td>{t.สถานะ || '-'}</td>
                      <td style={{ fontWeight: 700 }}>{Math.abs(Number(t.จำนวน || 0)).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {detailedFeed.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>ไม่พบข้อมูลตามตัวกรอง</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="plain-subtitle">
        ตัวกรองปัจจุบัน: {flowLabelMap[flowFilter]} • {periodLabelMap[period]} • คำค้น {keyword || '-'} • วันที่ {dateFrom || '-'} ถึง {dateTo || '-'}
      </p>
    </div>
  );
};

export default DesktopReports;
