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
  chartData: { name: string; [key: string]: any }[];
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
      <div className="plain-card-header dash-card-header" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={18} style={{ color: '#6366f1' }} />
          <span>แนวโน้มการเคลื่อนไหว</span>
        </div>
        <span className="dash-subtle">{rangeLabel}</span>
      </div>

      <div style={{ padding: '0 20px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {([
            { id: '7d' as RangePreset, label: '7 วัน' },
            { id: '30d' as RangePreset, label: '30 วัน' },
            { id: 'month' as RangePreset, label: 'เดือนนี้' },
          ]).map(p => (
            <button
              key={p.id}
              onClick={() => onRangePresetChange(p.id)}
              className="plain-btn-sm"
              style={{
                background: rangePreset === p.id ? '#1e293b' : '#f1f5f9',
                color: rangePreset === p.id ? '#fff' : '#475569',
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => onRangePresetChange('custom')}
            className="plain-btn-sm"
            style={{
              background: rangePreset === 'custom' ? '#1e293b' : '#f1f5f9',
              color: rangePreset === 'custom' ? '#fff' : '#475569',
            }}
          >
            <Calendar size={14} style={{ marginRight: 4 }} />
            กำหนดเอง
          </button>

          {rangePreset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
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

        <button
          type="button"
          className="plain-btn-sm"
          onClick={() => onRefresh?.()}
          disabled={loading}
          style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}
        >
          <Activity size={14} style={{ marginRight: 4 }} />
          {loading ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}
        </button>
      </div>

      <div style={{ padding: '12px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {rangeKpis.map((kpi, i) => (
            <div style={{
              background: '#f8fafc', borderRadius: 12, padding: '12px 16px',
              border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div className="dash-icon-box" style={{ background: kpi.color + '15', color: kpi.color }}>
                <kpi.icon size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <div className="dash-val-lg">{kpi.val.toLocaleString()}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: kpi.color }}>เทียบช่วงก่อน {formatDelta(kpi.val - kpi.prev)}</div>
                </div>
                <div className="dash-label-sm" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px 16px 20px', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 16, alignItems: 'stretch' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ padding: '0 0 8px 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="dash-legend-dot" style={{ background: '#10b981' }} />
              <span className="dash-label-sm">รับเข้า</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="dash-legend-dot" style={{ background: '#f59e0b' }} />
              <span className="dash-label-sm">เบิกออก</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="dash-legend-dot" style={{ background: '#8b5cf6' }} />
              <span className="dash-label-sm">รับคืน</span>
            </div>
          </div>

          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} barGap={2} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} width={30} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 12, fontWeight: 600 }}
                />
                <Bar dataKey="รับเข้า" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                <Bar dataKey="เบิกออก" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                <Bar dataKey="รับคืน" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <DashboardAlertsPanel items={alertItems} />

          <DashboardOperationsPanel
            items={operationsCards}
            onNavigate={onNavigate}
            note={phaseNote}
          />
        </div>
      </div>
    </div>
  );
}
