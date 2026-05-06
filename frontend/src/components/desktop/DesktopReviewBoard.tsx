import React, { useMemo } from 'react';
import { AlertTriangle, ClipboardCheck, PackageX, ShieldAlert, Wrench, History } from 'lucide-react';
import RepairManagement from '../mobile/RepairManagement';

interface DesktopReviewBoardProps {
  items: any[];
  transactions: any[];
  customers: any[];
  operatorName: string;
  onSuccess: () => void;
  loading?: boolean;
}

const normalize = (value: any) => String(value || '').toLowerCase();

const DesktopReviewBoard: React.FC<DesktopReviewBoardProps> = ({
  items,
  transactions,
  customers,
  operatorName,
  onSuccess,
  loading,
}) => {
  const stats = useMemo(() => {
    const quarantineQty = items.reduce((sum, item) => sum + Number(item.quarantine_qty || 0), 0);
    const repairQty = items.reduce((sum, item) => sum + Number(item.repair_qty || 0), 0);
    const scrapQty = items.reduce((sum, item) => sum + Number(item.scrap_qty || 0), 0);
    const lostQty = items.reduce((sum, item) => sum + Number(item.lost_qty || 0), 0);

    const pendingReviewTxns = transactions.filter((txn) => {
      const status = normalize(txn.action_type || txn.status || txn.สถานะ);
      return status.includes('รอตรวจ') || status.includes('quarantine');
    });

    const inspectedExceptionTxns = transactions.filter((txn) => {
      const status = normalize(txn.action_type || txn.status || txn.สถานะ);
      const cabinet = normalize(txn.cabinet_status || txn['สภาพตู้']);
      const isChecked = status.includes('ตรวจสอบแล้ว') || status.includes('checked') || status.includes('อนุมัติ');
      const isException = cabinet.includes('ซ่อม') || cabinet.includes('เสีย') || cabinet.includes('ซาก') || cabinet.includes('หาย');
      return isChecked && isException;
    });

    return {
      quarantineQty,
      repairQty,
      scrapQty,
      lostQty,
      pendingReviewCount: pendingReviewTxns.length,
      inspectedExceptionCount: inspectedExceptionTxns.length,
    };
  }, [items, transactions]);

  const recentExceptions = useMemo(() => {
    return [...transactions]
      .filter((txn) => {
        const status = normalize(txn.action_type || txn.status || txn.สถานะ);
        const cabinet = normalize(txn.cabinet_status || txn['สภาพตู้']);
        return status.includes('รอตรวจ') || status.includes('ตรวจสอบ') || cabinet.includes('ซ่อม') || cabinet.includes('ซาก') || cabinet.includes('หาย');
      })
      .sort((a, b) => new Date(b['วัน-เวลา'] || b.created_at || 0).getTime() - new Date(a['วัน-เวลา'] || a.created_at || 0).getTime())
      .slice(0, 8);
  }, [transactions]);

  return (
    <div className="desktop-page">
      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">Review / Exception Board</h2>
          <p className="plain-subtitle">พื้นที่ desktop สำหรับติดตามของรอตรวจ, รอซ่อม, ซาก, สูญหาย และรายการที่ต้อง review ต่อจาก logistics</p>
        </div>
      </div>

      <div className="desktop-stat-grid">
        <div className="plain-kpi">
          <div className="plain-kpi-label">รอตรวจ</div>
          <div className="plain-kpi-value">{stats.quarantineQty.toLocaleString()}</div>
        </div>
        <div className="plain-kpi">
          <div className="plain-kpi-label">รอซ่อม</div>
          <div className="plain-kpi-value">{stats.repairQty.toLocaleString()}</div>
        </div>
        <div className="plain-kpi">
          <div className="plain-kpi-label">ซาก / สูญหาย</div>
          <div className="plain-kpi-value">{(stats.scrapQty + stats.lostQty).toLocaleString()}</div>
        </div>
        <div className="plain-kpi">
          <div className="plain-kpi-label">รายการ pending review</div>
          <div className="plain-kpi-value">{stats.pendingReviewCount.toLocaleString()}</div>
        </div>
      </div>

      <div className="desktop-split-grid desktop-split-grid--wide-right">
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={15} /> สรุป exception ที่ต้องตามต่อ
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
              <div><strong>รอตรวจจากงานรับคืน:</strong> {stats.pendingReviewCount.toLocaleString()} รายการ</div>
              <div><strong>ตรวจแล้วและพบ exception:</strong> {stats.inspectedExceptionCount.toLocaleString()} รายการ</div>
              <div><strong>รอซ่อมสะสม:</strong> {stats.repairQty.toLocaleString()} ชิ้น</div>
              <div><strong>ซากสะสม:</strong> {stats.scrapQty.toLocaleString()} ชิ้น</div>
              <div><strong>สูญหายสะสม:</strong> {stats.lostQty.toLocaleString()} ชิ้น</div>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={15} /> รายการผิดปกติล่าสุด
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 8 }}>
              {recentExceptions.map((txn, index) => (
                <div key={`${txn.id || txn['เลขที่รายการ'] || index}-${index}`} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>{txn['เลขที่รายการ'] || txn.job_id || 'NO-ID'}</div>
                    <span className="plain-badge">{txn.สถานะ || txn.action_type || '-'}</span>
                  </div>
                  <div className="plain-subtitle" style={{ marginTop: 4 }}>{txn.รายการ || '-'} • {txn.CV || txn.cv || '-'}</div>
                  <div className="plain-subtitle">สภาพ: {txn.cabinet_status || txn['สภาพตู้'] || '-'} • เวลา: {txn['วัน-เวลา'] || txn.created_at || '-'}</div>
                </div>
              ))}
              {recentExceptions.length === 0 && <div className="plain-subtitle">ยังไม่พบรายการ exception ล่าสุด</div>}
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} /> แนวทางใช้งานบน desktop
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 8 }}>
              <div><ClipboardCheck size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> ใช้ฝั่งขวาเพื่อตรวจ/จัดการรายการเชิงลึก</div>
              <div><Wrench size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> เน้น review ก่อนค่อยลงมติ ซ่อม / ซาก / สูญหาย</div>
              <div><PackageX size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> ยังไม่แตะ logic หลักของ flow เดิม ใช้เป็น control layer เพิ่ม</div>
            </div>
          </div>
        </div>

        <div className="plain-card plain-page-frame plain-scope" style={{ marginTop: 0 }}>
          <RepairManagement
            items={items}
            transactions={transactions}
            customers={customers}
            operatorName={operatorName}
            onSuccess={onSuccess}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
};

export default DesktopReviewBoard;
