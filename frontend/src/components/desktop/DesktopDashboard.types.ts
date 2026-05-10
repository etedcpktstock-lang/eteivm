import type { Transaction, MaterialItem } from '../../types';

// ---- shared tone / alert ----
export type DashboardAlertTone = 'danger' | 'warning' | 'info' | 'success';

export type DashboardAlert = {
  key: string;
  tone: DashboardAlertTone;
  title: string;
  detail: string;
  value?: number;
};

// ---- dashboard props ----
export interface DesktopDashboardProps {
  items: MaterialItem[];
  transactions: Transaction[];
  warehouses?: any[];
  user: any;
  onRefresh?: () => void;
  loading?: boolean;
  setActiveTab?: (tab: any) => void;
  allRepair?: number;
  allScrap?: number;
  allLost?: number;
}

// ---- date range ----
export type RangePreset = '7d' | '30d' | 'month' | 'custom';

// ---- KPI grid ----
export type KpiCard = {
  id: string;
  label: string;
  value: number;
  footnote: string;
  deltaLabel: string;
  tone: string;
  sparkline?: { value: number }[];
};

// ---- operations ----
export type OperationsCard = {
  label: string;
  value: number;
  hint: string;
  icon: any;
  color: string;
};

// ---- comparison strip ----
export type ComparisonStripItem = {
  label: string;
  current: number;
  previous: number;
  delta: number;
  color: string;
  targetTab?: any;
};

// ---- top / active entities ----
export type RankEntry = {
  label: string;
  count: number;
  qty: number;
};

// ---- recent activity ----
export type RecentTxn = {
  [key: string]: any;
  สถานะ?: string;
  รายการ?: string;
  ผู้ทำรายการ?: string;
  เขตการทำงาน?: string;
  CV?: string;
  ประเภท?: string;
  'วัน-เวลา'?: string;
  'ยี่ห้อ/รายการ'?: string;
  ยี่ห้อหรือรูปแบบ?: string;
};

// ---- charts ----
export type CompositionEntry = {
  name: string;
  value: number;
};

export type ComparisonData = {
  title: string;
  subtitle: string;
  data: { label: string; value: number }[];
};
