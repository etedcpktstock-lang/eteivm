import React from 'react';
import { Clock3, ShieldAlert, Siren, Activity, ArrowDownCircle, ArrowUpCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatThaiDate, formatThaiTime } from '../../utils/dateTimeUtils';
import type { DashboardAlertTone, DashboardAlert, KpiCard, OperationsCard, ComparisonStripItem, RankEntry, RecentTxn } from './DesktopDashboard.types';
import { DashboardSparkline } from './DesktopDashboardSparkline';
import './dashboard-tokens.css';

const ALERT_TONE_STYLES: Record<DashboardAlertTone, { bg: string; border: string; text: string; badgeBg: string }> = {
  danger: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', badgeBg: '#fee2e2' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#b45309', badgeBg: '#fef3c7' },
  info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', badgeBg: '#dbeafe' },
  success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badgeBg: '#dcfce7' },
};

export function DashboardKpiGrid({ items, onNavigate }: { items: KpiCard[]; onNavigate: (tab?: any) => void }) {
  return (
    <div className="plain-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {items.map((kpi, idx) => (
        <div
          key={`${kpi.id}-${idx}`}
          className="plain-kpi"
          onClick={() => onNavigate(kpi.id)}
          style={{ cursor: 'pointer', padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120 }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div className="plain-kpi-label" style={{ fontSize: 12, color: '#64748b' }}>{kpi.label}</div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: kpi.tone,
                  background: `${kpi.tone}14`,
                  borderRadius: 999,
                  padding: '2px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {kpi.deltaLabel}
              </span>
            </div>
            <div className="plain-kpi-val" style={{ fontSize: 24, fontWeight: 800 }}>{Number(kpi.value || 0).toLocaleString()}</div>
          </div>

          <div style={{ marginTop: 12 }}>
            {kpi.sparkline && <DashboardSparkline data={kpi.sparkline} color={kpi.tone} />}
            <div className="dash-hint" style={{ marginTop: 6, fontSize: 10 }}>{kpi.footnote}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardAlertsPanel({ items }: { items: DashboardAlert[] }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Siren size={16} style={{ color: '#dc2626' }} />
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Alerts / สิ่งที่ควรดู</div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((alert) => {
          const tone = ALERT_TONE_STYLES[alert.tone];
          return (
            <div
              key={alert.key}
              style={{
                background: tone.bg,
                border: `1px solid ${tone.border}`,
                borderRadius: 12,
                padding: '12px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>{alert.title}</div>
                  <div className="dash-hint" style={{ lineHeight: 1.45 }}>{alert.detail}</div>
                </div>
                {typeof alert.value === 'number' && (
                  <span className="dash-pill" style={{ background: tone.badgeBg, color: tone.text, padding: '4px 9px', fontSize: 11 }}>
                    {alert.value.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardOperationsPanel({ items, onNavigate, note }: { items: OperationsCard[]; onNavigate: (tab?: any) => void; note: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Clock3 size={16} style={{ color: '#334155' }} />
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Operations Snapshot</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {items.map((card, idx) => (
          <div
            key={`${card.label}-${idx}`}
            onClick={() => onNavigate(card.label === 'รายการยกเลิก' ? 'history' : card.label === 'CV เคลื่อนไหว' ? 'reports' : 'history')}
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div className="dash-label">{card.label}</div>
              <card.icon size={15} style={{ color: card.color }} />
            </div>
            <div className="dash-val-lg">{card.value.toLocaleString()}</div>
            <div className="dash-hint" style={{ lineHeight: 1.45, marginTop: 6 }}>{card.hint}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <ShieldAlert size={14} style={{ color: '#475569' }} />
          <div style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>หมายเหตุ phase ปัจจุบัน</div>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{note}</div>
      </div>
    </div>
  );
}

export function DashboardComparisonStrip({ items, onNavigate, formatDelta }: { items: ComparisonStripItem[]; onNavigate: (tab?: any) => void; formatDelta: (value: number) => string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
      {items.map((item) => (
        <div
          key={item.label}
          onClick={() => onNavigate(item.targetTab)}
          style={{ background: '#fff', border: `1px solid ${item.color}33`, borderRadius: 14, padding: '12px 14px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
            <span className="dash-pill" style={{ color: item.color, background: `${item.color}14` }}>
              {formatDelta(item.delta)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div className="dash-val-lg" style={{ fontSize: 22 }}>{item.current.toLocaleString()}</div>
            <div className="dash-subtle">ก่อนหน้า {item.previous.toLocaleString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardTopMoversCard({ items, onNavigate }: { items: RankEntry[]; onNavigate: (tab?: any) => void }) {
  return (
    <div className="plain-card" style={{ marginBottom: 0 }}>
      <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>Top Movers</span>
        <button className="plain-btn-sm" onClick={() => onNavigate('reports')} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>ดูรายงานต่อ</button>
      </div>
      <div style={{ padding: '8px 16px 16px 16px' }}>
        {items.length > 0 ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item, index) => (
              <div key={`${item.label}-${index}`} onClick={() => onNavigate('history')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div className="dash-rank-badge">{index + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                    <div className="dash-hint">{item.count.toLocaleString()} transactions</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="dash-val">{item.qty.toLocaleString()}</div>
                  <div className="dash-hint">จำนวนรวม</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-empty">ยังไม่มี movement ในช่วงเวลาที่เลือก</div>
        )}
      </div>
    </div>
  );
}

export function DashboardTopEntitiesCard({ topActiveCustomers, topActiveZones, onNavigate }: { topActiveCustomers: RankEntry[]; topActiveZones: RankEntry[]; onNavigate: (tab?: any) => void }) {
  return (
    <div className="plain-card" style={{ marginBottom: 0 }}>
      <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>Top Active Customers / Zones</span>
        <button className="plain-btn-sm" onClick={() => onNavigate('reports')} style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>เปิด reports</button>
      </div>
      <div style={{ padding: '8px 16px 16px 16px', display: 'grid', gap: 14 }}>
        <div>
          <div className="dash-label" style={{ marginBottom: 8 }}>CV ที่ active สูงสุด</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {topActiveCustomers.length > 0 ? topActiveCustomers.map((entry, index) => (
              <div key={`${entry.label}-${index}`} onClick={() => onNavigate('reports')} className="dash-surface dash-surface-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.label}</div>
                  <div className="dash-hint">{entry.count.toLocaleString()} รายการ</div>
                </div>
                <div className="dash-val-sm" style={{ color: '#1d4ed8' }}>{entry.qty.toLocaleString()}</div>
              </div>
            )) : <div style={{ fontSize: 12, color: '#64748b' }}>ไม่มีข้อมูลลูกค้าในช่วงนี้</div>}
          </div>
        </div>
        <div>
          <div className="dash-label" style={{ marginBottom: 8 }}>โซนที่ active สูงสุด</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {topActiveZones.length > 0 ? topActiveZones.map((entry, index) => (
              <div key={`${entry.label}-${index}`} onClick={() => onNavigate('reports')} className="dash-surface dash-surface-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.label}</div>
                  <div className="dash-hint">{entry.count.toLocaleString()} movements</div>
                </div>
                <div className="dash-val-sm" style={{ color: '#7c3aed' }}>{entry.qty.toLocaleString()}</div>
              </div>
            )) : <div style={{ fontSize: 12, color: '#64748b' }}>ไม่มีข้อมูลโซนในช่วงนี้</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardRecentActivityCard({ items, onNavigate }: { items: RecentTxn[]; onNavigate: (tab?: any) => void }) {
  const getActionStyles = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('เบิก') || s.includes('ส่งมอบ')) return { color: '#f59e0b', bg: '#fef3c7', icon: ArrowUpCircle, sign: '-' };
    if (s.includes('รับ')) return { color: '#10b981', bg: '#dcfce7', icon: ArrowDownCircle, sign: '+' };
    if (s.includes('ซ่อม')) return { color: '#8b5cf6', bg: '#f3e8ff', icon: RefreshCw, sign: '' };
    return { color: '#64748b', bg: '#f1f5f9', icon: Activity, sign: '' };
  };

  return (
    <div className="plain-card" style={{ marginBottom: 0 }}>
      <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>กิจกรรมล่าสุด</span>
        <button className="plain-btn-sm" onClick={() => onNavigate('history')} style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>ประวัติทั้งหมด</button>
      </div>
      <div style={{ padding: '8px 16px 16px 16px', display: 'grid', gap: 0 }}>
        {items.length > 0 ? items.map((txn, i) => {
          const styles = getActionStyles(txn.สถานะ || '');
          return (
            <div
              key={i}
              onClick={() => onNavigate('history')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 0',
                borderBottom: i === items.length - 1 ? 'none' : '1px solid #f1f5f9',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: styles.bg, color: styles.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <styles.icon size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{txn.รายการ || '-'}</div>
                  <div className="dash-hint" style={{ fontSize: 11 }}>{formatThaiTime(txn['วัน-เวลา'])} • {formatThaiDate(txn['วัน-เวลา'])}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>
                  {styles.sign}{txn.จำนวน?.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: styles.color, textTransform: 'uppercase' }}>{txn.สถานะ}</div>
              </div>
            </div>
          );
        }) : (
          <div className="dash-empty">ยังไม่มีกิจกรรมล่าสุด</div>
        )}
      </div>
    </div>
  );
}
export function DashboardLowStockCard({ items, onNavigate }: { items: any[]; onNavigate: (tab?: any) => void }) {
  return (
    <div className="plain-card" style={{ marginBottom: 0 }}>
      <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={18} style={{ color: '#ef4444' }} />
          <span>สินค้าเหลือน้อย (&lt; 5)</span>
        </div>
        <button className="plain-btn-sm" onClick={() => onNavigate('inventory')} style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>ดูสต็อก</button>
      </div>
      <div style={{ padding: '8px 16px 16px 16px' }}>
        {items.length > 0 ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((item, index) => (
              <div 
                key={`${item.id}-${index}`} 
                onClick={() => onNavigate('inventory')} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  gap: 12, 
                  background: '#fff', 
                  border: '1px solid #fee2e2', 
                  borderRadius: 12, 
                  padding: '10px 12px', 
                  cursor: 'pointer' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.รายการ || item.ประเภท}
                    </div>
                    <div className="dash-hint" style={{ fontSize: 10 }}>{item.ยี่ห้อหรือรูปแบบ || item.ประเภท}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#b91c1c' }}>{item.จำนวน?.toLocaleString()}</div>
                  <div className="dash-hint" style={{ fontSize: 9 }}>คงเหลือ</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-empty" style={{ color: '#10b981' }}>ยอดเยี่ยม! ไม่มีสินค้าเหลือน้อย</div>
        )}
      </div>
    </div>
  );
}
