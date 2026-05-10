import React, { useEffect, useMemo, useState } from 'react';
import { Search, Printer, Trash2, RefreshCw, ScanSearch, UserRound, ClipboardList, Filter } from 'lucide-react';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SARABUN_REGULAR, SARABUN_BOLD } from '../../utils/pdfFonts';

interface DesktopHistoryProps {
  transactions: any[];
  user: any;
  customers: any[];
  onRefresh: () => void;
  onVoid: (txnNo: string) => void;
}

const normalizeText = (value: any) => String(value || '').trim().toLowerCase();

const getTxnNo = (txn: any) => String(txn?.เลขที่รายการ || txn?.txn_no || txn?.TxnNo || txn?.id || '');

const getCustomerName = (txn: any, customers: any[]) => {
  const cv = String(txn?.CV || txn?.cv || '').trim();
  if (!cv) return '-';
  const customer = customers.find((c) => String(c.cv || c.CV || '').trim() === cv);
  return customer?.name || customer?.shop_name || cv;
};

const getTxnSearchText = (txn: any, customerName: string) =>
  [
    txn?.เลขที่รายการ,
    txn?.รายการ,
    txn?.ผู้ทำรายการ,
    txn?.CV,
    customerName,
    txn?.สถานะ,
    txn?.serial_number,
    txn?.serialNumber,
    txn?.asset_tag,
    txn?.assetTag,
    txn?.['เลขงาน'],
    txn?.['ยี่ห้อหรือรูปแบบ'],
    txn?.ขนาด,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const DesktopHistory: React.FC<DesktopHistoryProps> = ({ transactions, user, customers, onRefresh, onVoid }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
  const [operatorFilter, setOperatorFilter] = useState('ทั้งหมด');
  const [selectedTxnNo, setSelectedTxnNo] = useState<string | null>(null);

  const statusOptions = useMemo(
    () => ['ทั้งหมด', ...Array.from(new Set(transactions.map((t) => String(t.สถานะ || '').trim()).filter(Boolean))).sort()],
    [transactions]
  );

  const operatorOptions = useMemo(
    () => ['ทั้งหมด', ...Array.from(new Set(transactions.map((t) => String(t.ผู้ทำรายการ || '').trim()).filter(Boolean))).sort()],
    [transactions]
  );

  const groupedTransactions = useMemo(() => {
    const q = normalizeText(searchTerm);
    const groups: Map<string, any[]> = new Map();

    transactions.forEach((txn) => {
      const customerName = getCustomerName(txn, customers);
      const matchesSearch = !q || getTxnSearchText(txn, customerName).includes(q);
      const matchesStatus = statusFilter === 'ทั้งหมด' || String(txn.สถานะ || '').trim() === statusFilter;
      const matchesOperator = operatorFilter === 'ทั้งหมด' || String(txn.ผู้ทำรายการ || '').trim() === operatorFilter;

      if (!matchesSearch || !matchesStatus || !matchesOperator) return;

      const key = getTxnNo(txn) || `UNTITLED-${txn.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(txn);
    });

    return Array.from(groups.entries())
      .map(([txnNo, rows]) => {
        const sortedRows = [...rows].sort(
          (a, b) => new Date(b['วัน-เวลา'] || b.created_at || 0).getTime() - new Date(a['วัน-เวลา'] || a.created_at || 0).getTime()
        );
        const first = sortedRows[0];
        const identifiers = Array.from(
          new Set(
            sortedRows.flatMap((row) =>
              [row.serial_number, row.serialNumber, row.asset_tag, row.assetTag]
                .map((v) => String(v || '').trim())
                .filter(Boolean)
            )
          )
        );
        const totalQty = sortedRows.reduce((sum, row) => sum + Math.abs(Number(row.จำนวน || row.quantity || 0)), 0);

        return {
          txnNo,
          rows: sortedRows,
          first,
          identifiers,
          totalQty,
          itemCount: sortedRows.length,
          customerName: getCustomerName(first, customers),
          operatorName: first?.ผู้ทำรายการ || '-',
          status: first?.สถานะ || '-',
          jobNo: first?.['เลขงาน'] || first?.job_id || '-',
          date: first?.['วัน-เวลา'] || first?.created_at || '-',
        };
      })
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [transactions, customers, searchTerm, statusFilter, operatorFilter]);

  useEffect(() => {
    if (!groupedTransactions.length) {
      setSelectedTxnNo(null);
      return;
    }
    if (!selectedTxnNo || !groupedTransactions.some((group) => group.txnNo === selectedTxnNo)) {
      setSelectedTxnNo(groupedTransactions[0].txnNo);
    }
  }, [groupedTransactions, selectedTxnNo]);

  const selectedGroup = useMemo(
    () => groupedTransactions.find((group) => group.txnNo === selectedTxnNo) || null,
    [groupedTransactions, selectedTxnNo]
  );

  const selectedRows = selectedGroup?.rows || [];
  const firstTx = selectedGroup?.first || null;
  const customerDetail = useMemo(
    () => (firstTx?.CV ? customers.find((c) => String(c.cv || c.CV) === String(firstTx.CV)) : null),
    [customers, firstTx]
  );

  const historyStats = useMemo(() => {
    const totalRows = groupedTransactions.reduce((sum, group) => sum + group.itemCount, 0);
    const totalQty = groupedTransactions.reduce((sum, group) => sum + group.totalQty, 0);
    const voidCount = groupedTransactions.filter((group) => String(group.status || '').includes('ยกเลิก')).length;
    const withIdentifier = groupedTransactions.filter((group) => group.identifiers.length > 0).length;

    return {
      groups: groupedTransactions.length,
      rows: totalRows,
      qty: totalQty,
      voidCount,
      withIdentifier,
    };
  }, [groupedTransactions]);

  const exportPDF = () => {
    if (!selectedRows.length || !firstTx) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Add Thai Fonts
    doc.addFileToVFS('Sarabun-Regular.ttf', SARABUN_REGULAR);
    doc.addFileToVFS('Sarabun-Bold.ttf', SARABUN_BOLD);
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
    
    doc.setFont('Sarabun', 'bold');
    doc.setFontSize(16);
    doc.text('ETE DC PHUKET - TRANSACTION SLIP', 14, 18);
    doc.setFont('Sarabun', 'normal');
    doc.setFontSize(10);
    doc.text(`เลขที่รายการ: ${getTxnNo(firstTx) || '-'}`, 14, 26);
    doc.text(`วันเวลา: ${formatThaiDateTime(firstTx['วัน-เวลา'])}`, 14, 31);
    doc.text(`ลูกค้า: ${customerDetail?.name || firstTx.CV || '-'}`, 14, 36);
    doc.text(`ผู้ทำรายการ: ${firstTx.ผู้ทำรายการ || '-'}`, 14, 41);
    if (firstTx['เลขงาน']) doc.text(`เลขงาน: ${firstTx['เลขงาน']}`, 14, 46);

    autoTable(doc, {
      startY: firstTx['เลขงาน'] ? 51 : 46,
      head: [['รายการ', 'Serial', 'Asset Tag', 'จำนวน', 'สถานะ']],
      body: selectedRows.map((t: any) => [
        `${t.รายการ || '-'} ${t.ขนาด || ''}`,
        t.serial_number || t.serialNumber || '-',
        t.asset_tag || t.assetTag || '-',
        `${Math.abs(Number(t.จำนวน || t.quantity || 0))} ${t.หน่วย || ''}`,
        t.สถานะ || '-',
      ]),
      theme: 'grid',
      styles: { font: 'Sarabun', fontSize: 8 },
    });

    doc.save(`Receipt_${getTxnNo(firstTx) || 'NO-ID'}.pdf`);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ทั้งหมด');
    setOperatorFilter('ทั้งหมด');
  };

  return (
    <div className="desktop-page">
      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">ประวัติรายการ</h2>
          <p className="plain-subtitle">History center สำหรับค้นย้อนหลัง, trace เลขที่รายการ, เช็ก S/N / Asset Tag และเปิดดูรายละเอียดแบบ side-by-side</p>
        </div>
      </div>

      <div className="desktop-stat-grid">
        <div className="plain-kpi">
          <div className="plain-kpi-label">ชุดรายการ</div>
          <div className="plain-kpi-value">{historyStats.groups.toLocaleString()}</div>
        </div>
        <div className="plain-kpi">
          <div className="plain-kpi-label">บรรทัดธุรกรรม</div>
          <div className="plain-kpi-value">{historyStats.rows.toLocaleString()}</div>
        </div>
        <div className="plain-kpi">
          <div className="plain-kpi-label">รวมจำนวน</div>
          <div className="plain-kpi-value">{historyStats.qty.toLocaleString()}</div>
        </div>
        <div className="plain-kpi">
          <div className="plain-kpi-label">มี S/N / Asset</div>
          <div className="plain-kpi-value">{historyStats.withIdentifier.toLocaleString()}</div>
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
                placeholder="ค้นหาเลขที่รายการ / ลูกค้า / CV / ผู้ทำรายการ / S/N / Asset Tag / เลขงาน"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select className="plain-logout" style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select className="plain-logout" style={{ width: 170 }} value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)}>
              {operatorOptions.map((operator) => (
                <option key={operator} value={operator}>{operator}</option>
              ))}
            </select>

            <button className="plain-logout" style={{ width: 72 }} onClick={resetFilters}>ล้าง</button>
            <button className="plain-logout" style={{ width: 40 }} onClick={onRefresh}><RefreshCw size={14} /></button>
          </div>
        </div>
      </div>

      <div className="desktop-split-grid desktop-split-grid--wide-right">
        <div className="plain-card">
          <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={15} /> รายการธุรกรรม ({groupedTransactions.length})
          </div>

          <div className="desktop-scroll desktop-scroll--tall" style={{ borderTop: '1px solid #e5e7eb' }}>
            {groupedTransactions.map((group) => {
              const active = selectedTxnNo === group.txnNo;
              return (
                <button
                  key={group.txnNo}
                  onClick={() => setSelectedTxnNo(group.txnNo)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 12,
                    border: 'none',
                    borderBottom: '1px solid #f1f5f9',
                    background: active ? '#ecfdf5' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>#{group.txnNo || 'NO-ID'}</div>
                    <span className="plain-badge">{group.status || '-'}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{group.customerName}</div>
                  <div className="plain-subtitle" style={{ marginTop: 4 }}>{formatThaiDateTime(group.date)} • {group.operatorName}</div>
                  <div className="plain-subtitle" style={{ marginTop: 4 }}>
                    {group.first?.รายการ || '-'} • {group.itemCount} บรรทัด • รวม {group.totalQty.toLocaleString()}
                  </div>
                  {group.identifiers.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {group.identifiers.slice(0, 2).map((identifier) => (
                        <span key={identifier} className="plain-badge">{identifier}</span>
                      ))}
                      {group.identifiers.length > 2 && <span className="plain-badge">+{group.identifiers.length - 2}</span>}
                    </div>
                  )}
                </button>
              );
            })}
            {groupedTransactions.length === 0 && <div className="desktop-empty">ไม่พบข้อมูลตามตัวกรอง</div>}
          </div>
        </div>

        <div className="plain-card">
          {!selectedGroup && <div className="desktop-empty">เลือกรายการจากฝั่งซ้ายเพื่อดูรายละเอียด</div>}

          {selectedGroup && firstTx && (
            <div className="desktop-page" style={{ gap: 0 }}>
              <div className="plain-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>#{selectedGroup.txnNo}</div>
                  <div className="plain-subtitle">{formatThaiDateTime(selectedGroup.date)} • ผู้ทำรายการ {selectedGroup.operatorName}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="plain-logout" style={{ width: 40 }} onClick={exportPDF}><Printer size={14} /></button>
                  {user?.role?.toLowerCase().includes('admin') && !String(firstTx.สถานะ || '').includes('ยกเลิก') && (
                    <button className="plain-logout" style={{ width: 140 }} onClick={() => onVoid(selectedGroup.txnNo)}>
                      <Trash2 size={14} style={{ marginRight: 6 }} />ยกเลิกรายการ
                    </button>
                  )}
                </div>
              </div>

              <div className="desktop-panel-body" style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  <div className="plain-kpi" style={{ padding: 10 }}>
                    <div className="plain-kpi-label">ลูกค้า / CV</div>
                    <div style={{ fontWeight: 700 }}>{selectedGroup.customerName}</div>
                    <div className="plain-subtitle">{firstTx.CV || '-'}</div>
                  </div>
                  <div className="plain-kpi" style={{ padding: 10 }}>
                    <div className="plain-kpi-label">สถานะ / เลขงาน</div>
                    <div style={{ fontWeight: 700 }}>{selectedGroup.status || '-'}</div>
                    <div className="plain-subtitle">{selectedGroup.jobNo || '-'}</div>
                  </div>
                  <div className="plain-kpi" style={{ padding: 10 }}>
                    <div className="plain-kpi-label">จำนวนรวม / บรรทัด</div>
                    <div style={{ fontWeight: 700 }}>{selectedGroup.totalQty.toLocaleString()}</div>
                    <div className="plain-subtitle">{selectedGroup.itemCount} รายการย่อย</div>
                  </div>
                </div>

                <div className="plain-card" style={{ marginTop: 0 }}>
                  <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserRound size={15} /> ข้อมูลลูกค้าและบริบท
                  </div>
                  <div className="desktop-panel-body" style={{ fontSize: 13, display: 'grid', gap: 6 }}>
                    <div><strong>ชื่อลูกค้า:</strong> {customerDetail?.name || selectedGroup.customerName}</div>
                    <div><strong>CV:</strong> {firstTx.CV || '-'}</div>
                    <div><strong>ผู้ทำรายการ:</strong> {selectedGroup.operatorName}</div>
                    <div><strong>สถานะ:</strong> {selectedGroup.status || '-'}</div>
                    <div><strong>เลขงาน:</strong> {selectedGroup.jobNo || '-'}</div>
                  </div>
                </div>

                <div className="plain-card" style={{ marginTop: 0 }}>
                  <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ScanSearch size={15} /> S/N / Asset Tag ในรายการนี้
                  </div>
                  <div className="desktop-panel-body">
                    {selectedGroup.identifiers.length === 0 ? (
                      <div className="plain-subtitle">ไม่พบ S/N หรือ Asset Tag ในรายการนี้</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {selectedGroup.identifiers.map((identifier) => (
                          <span key={identifier} className="plain-badge">{identifier}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="plain-card" style={{ marginTop: 0 }}>
                  <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClipboardList size={15} /> รายละเอียดรายการย่อย
                  </div>
                  <div className="desktop-scroll">
                    <table className="plain-table">
                      <thead>
                        <tr>
                          <th>รายการ</th>
                          <th>แบรนด์/ขนาด</th>
                          <th>S/N</th>
                          <th>Asset Tag</th>
                          <th>จำนวน</th>
                          <th>สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRows.map((row: any, index: number) => (
                          <tr key={`${selectedGroup.txnNo}-${index}`}>
                            <td>{row.รายการ || '-'}</td>
                            <td>{row['ยี่ห้อหรือรูปแบบ'] || '-'} {row.ขนาด || ''}</td>
                            <td>{row.serial_number || row.serialNumber || '-'}</td>
                            <td>{row.asset_tag || row.assetTag || '-'}</td>
                            <td>{Math.abs(Number(row.จำนวน || row.quantity || 0)).toLocaleString()} {row.หน่วย || ''}</td>
                            <td>{row.สถานะ || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="plain-subtitle">
        ตัวกรองตอนนี้: สถานะ {statusFilter} • ผู้ทำรายการ {operatorFilter} • รายการยกเลิก {historyStats.voidCount.toLocaleString()} ชุด
      </p>
    </div>
  );
};

export default DesktopHistory;
