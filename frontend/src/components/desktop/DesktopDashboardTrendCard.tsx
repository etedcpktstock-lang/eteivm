import React from 'react';
import { TrendingUp, ArrowDownCircle, ArrowUpCircle, RotateCcw, XCircle, Calendar, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { RangePreset, DashboardAlert, OperationsCard } from './DesktopDashboard.types';
import { DashboardAlertsPanel, DashboardOperationsPanel } from './DesktopDashboardSections';
import './dashboard-tokens.css';

type RangeKpi = {
  label: string;
  val: number;
  prev: number;
  icon: any;
  color: string;
};

type Props = {
  rangeLabel: string;
  rangePreset: RangePreset;
  onRangePresetChange: (preset: RangePreset) => void;
  customStart: string;
  onCustomStartChange: (v: string) => void;
  customEnd: string;
  onCustomEndChange: (v: string) => void;
  rangeKpis: RangeKpi[];
  chartData: { name: string;[key: string]: any }[];
  alertItems: DashboardAlert[];
  operationsCards: OperationsCard[];
  onRefresh?: () => void;
  loading?: boolean;
  formatDelta: (value: number) => string;
  onNavigate: (tab?: any) => void;
  phaseNote: string;
};

export function DashboardTrendCard({
  rangeLabel,
  rangePreset,
  onRangePresetChange,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange,
  rangeKpis,
  chartData,
  alertItems,
  operationsCards,
  onRefresh,
  loading,
  formatDelta,
  onNavigate,
  phaseNote,
}: Props) {
  return (
    <div className="plain-card">
      <div className="plain-card-header dash-card-header" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} style={{ color: '#6366f1' }} />
            <span style={{ fontSize: 16, fontWeight: 800 }}>แนวโน้มการเคลื่อนไหว</span>
          </div>
          <span className="dash-subtle" style={{ marginLeft: 26 }}>{rangeLabel}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
            {([
              { id: '7d' as RangePreset, label: 'Day' },
              { id: '30d' as RangePreset, label: 'Week' },
              { id: 'month' as RangePreset, label: 'Month' },
            ]).map(p => (
              <button
                key={p.id}
                onClick={() => onRangePresetChange(p.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: rangePreset === p.id ? '#fff' : 'transparent',
                  color: rangePreset === p.id ? '#0f172a' : '#64748b',
                  boxShadow: rangePreset === p.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="plain-btn-sm"
            onClick={() => onRefresh?.()}
            disabled={loading}
            style={{ background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 10, height: 36 }}
          >
            <Activity size={14} style={{ marginRight: 4 }} />
            {loading ? 'รีเฟรช...' : 'รีเฟรชข้อมูล'}
          </button>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px 24px' }}>
        <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#10b981' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>รับเข้า (IN)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#f59e0b' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>เบิกออก (OUT)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: '#8b5cf6' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>รับคืน (RETURN)</span>
          </div>
        </div>

        <div style={{ width: '100%', height: 380 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} barGap={4} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                width={40}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{
                  borderRadius: 12,
                  border: 'none',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '12px'
                }}
              />
              <Bar dataKey="รับเข้า" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={32} />
              <Bar dataKey="เบิกออก" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} maxBarSize={32} />
              <Bar dataKey="รับคืน" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {rangePreset === 'custom' && (
        <div style={{ padding: '0 24px 20px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16 }}>
          <Calendar size={16} style={{ color: '#64748b' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>ช่วงเวลาที่เลือก:</span>
          <input
            type="date"
            value={customStart}
            onChange={e => onCustomStartChange(e.target.value)}
            className="plain-input"
            style={{ width: 140, height: 32, fontSize: 12, padding: '4px 8px' }}
          />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>–</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => onCustomEndChange(e.target.value)}
            className="plain-input"
            style={{ width: 140, height: 32, fontSize: 12, padding: '4px 8px' }}
          />
        </div>
      )}
    </div>
  );
}
