import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { CompositionEntry, ComparisonData } from './DesktopDashboard.types';
import './dashboard-tokens.css';

export const STOCK_STATUS_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#dc2626', '#f59e0b', '#b91c1c'];

export function DashboardStockCompositionCard({
  data,
  onNavigate,
}: {
  data: CompositionEntry[];
  onNavigate: (tab?: any) => void;
}) {
  return (
    <div className="plain-card" style={{ marginBottom: 0 }}>
      <div className="plain-card-header dash-card-header">
        <span>Stock Status Composition</span>
        <span className="dash-subtle">ภาพรวมสถานะปัจจุบัน</span>
      </div>
      <div className="dash-section-pad">
        {data.length > 0 ? (
          <>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={2}
                    isAnimationActive={false}
                    onClick={() => onNavigate('inventory')}
                  >
                    {data.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={STOCK_STATUS_COLORS[index % STOCK_STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 4 }}>
              {data.map((entry, index) => (
                <div key={entry.name} className="dash-surface dash-surface-pad">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span className="dash-legend-dot-round" style={{ background: STOCK_STATUS_COLORS[index % STOCK_STATUS_COLORS.length] }} />
                    <span className="dash-label">{entry.name}</span>
                  </div>
                  <div className="dash-val">{entry.value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="dash-empty">ยังไม่มีข้อมูลสถานะสำหรับแสดงผล</div>
        )}
      </div>
    </div>
  );
}

export function DashboardComparisonChartCard({
  data,
  onNavigate,
}: {
  data: ComparisonData;
  onNavigate: (tab?: any) => void;
}) {
  return (
    <div className="plain-card" style={{ marginBottom: 0 }}>
      <div className="plain-card-header dash-card-header">
        <span>{data.title}</span>
        <span className="dash-subtle">{data.subtitle}</span>
      </div>
      <div className="dash-section-pad">
        {data.data.length > 0 ? (
          <>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart
                  data={data.data}
                  layout="vertical"
                  margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                  onClick={() => onNavigate(data.title.includes('คลัง') ? 'inventory' : 'reports')}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={110} tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} />
                  <Tooltip formatter={(value: number) => value.toLocaleString()} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 8, 8, 0]} maxBarSize={26} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
              {data.data.slice(0, 3).map((entry, idx) => (
                <div key={`${entry.label}-${idx}`} className="dash-surface dash-surface-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="dash-label">{entry.label}</div>
                    <div className="dash-hint">{idx === 0 ? 'อันดับสูงสุด' : 'เปรียบเทียบภาพรวม'}</div>
                  </div>
                  <div className="dash-val">{entry.value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="dash-empty">ยังไม่มีข้อมูล comparison เพียงพอ</div>
        )}
      </div>
    </div>
  );
}
