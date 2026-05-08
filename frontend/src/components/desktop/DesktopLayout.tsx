import React from 'react';
import {
  LayoutDashboard,
  Package,
  Box,
  Store,
  Building2,
  Truck,
  ShoppingBag,
  Archive,
  Container,
  ArrowDownCircle,
  ArrowUpCircle,
  RotateCcw,
  ArrowRightLeft,
  History,
  CalendarDays,
  Settings,
  LogOut,
  User as UserIcon,
  Bell,
  RefreshCw,
  ShieldCheck,
  ClipboardList,
  Search,
  Wrench,
} from 'lucide-react';

const BRAND_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  Package,
  Box,
  Store,
  Building2,
  Truck,
  ShoppingBag,
  Archive,
  Container,
};

interface DesktopLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  user: { name: string; role: string };
  onLogout: () => void;
  onRefresh: () => void;
  loading: boolean;
  onlineCount: number;
  latency: number | null;
  version: string;
  permissions?: any;
  settings?: Record<string, string>;
}

const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  user,
  onLogout,
  onRefresh,
  loading,
  onlineCount,
  latency,
  version,
  permissions,
  settings,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', subtitle: 'ภาพรวมระบบและงานค้าง', icon: LayoutDashboard },
    { id: 'inventory', label: 'สต็อกพัสดุ', subtitle: 'ดูคงเหลือและสถานะต่อคลัง', icon: Package },
    { id: 'receive', label: 'รับพัสดุเข้าคลัง', subtitle: 'บันทึกรับเข้าสินค้า/พัสดุ', icon: ArrowDownCircle },
    { id: 'job-request', label: 'แจ้งงาน / เบิกพัสดุ', subtitle: 'สร้างงานและผูกลูกค้า', icon: ClipboardList },
    { id: 'issue', label: 'เบิกพัสดุออกหน้างาน', subtitle: 'จ่ายของจากคลังไปหน้างาน', icon: ArrowUpCircle },
    { id: 'return', label: 'รับคืนพัสดุ', subtitle: 'รับคืนจากลูกค้า/หน้างาน', icon: RotateCcw },
    { id: 'transfer', label: 'ย้ายพัสดุข้ามคลัง', subtitle: 'โอนย้ายระหว่างคลัง/ศูนย์', icon: ArrowRightLeft },
    { id: 'history', label: 'ประวัติรายการ', subtitle: 'ค้นย้อนหลังและ trace รายการ', icon: History },
    { id: 'reports', label: 'รายงานและส่งออก', subtitle: 'รายงานพร้อมส่งออก', icon: Search },
    { id: 'audit', label: 'บันทึกระบบ (Admin Log)', subtitle: 'ตรวจสอบกิจกรรมในระบบ', icon: ShieldCheck },
    { id: 'survey', label: 'สำรวจลูกค้า', subtitle: 'ดูและบันทึกข้อมูลหน้างาน', icon: Search },
    { id: 'repair', label: 'จัดการรับคืน', subtitle: 'ตรวจสอบพัสดุรับคืน/ซ่อม', icon: Wrench },
    { id: 'calendar', label: 'ปฏิทินงาน', subtitle: 'ดูรายการตามวัน', icon: CalendarDays },
    { id: 'logistics', label: 'งานขนส่ง (Logistics)', subtitle: 'ติดตามงานส่งของ/รับคืน', icon: Truck },
    { id: 'settings', label: 'ตั้งค่าระบบ', subtitle: 'จัดการ master และสิทธิ์', icon: Settings },
  ];

  const filteredNav = navItems.filter((nav) => {
    const role = user.role || '';
    if (role.toLowerCase().includes('admin') || role.toLowerCase().includes('manager')) return true;

    const rolePerms = permissions?.[role] || {};
    const mapping: Record<string, string[]> = {
      dashboard: ['nav_home'],
      inventory: ['nav_inventory', 'inventory'],
      receive: ['nav_receive', 'receive'],
      'job-request': ['nav_job_request', 'job_request'],
      issue: ['nav_issue', 'issue'],
      return: ['nav_return', 'return'],
      transfer: ['nav_transfer', 'transfer'],
      history: ['nav_history', 'history'],
      reports: ['nav_history', 'history', 'nav_reports', 'reports'],
      audit: ['nav_audit', 'audit'],
      survey: ['customers_view', 'customers_edit'],
      repair: ['repair_view', 'repair_manage'],
      calendar: ['nav_calendar', 'calendar'],
      logistics: ['nav_logistics', 'logistics'],
      settings: ['nav_settings', 'settings'],
    };

    const permKeys = mapping[nav.id] || [];
    return permKeys.some((key: string) => rolePerms[key] === true) || nav.id === 'dashboard';
  });

  const activeNav = filteredNav.find((item) => item.id === activeTab) || filteredNav[0] || navItems[0];

  const brandName = settings?.APP_NAME || 'ETE DC';
  const brandSub = settings?.APP_SUBTITLE || 'Desktop Admin Workspace';
  const brandIconKey = settings?.APP_ICON || 'Package';
  const BrandIcon = BRAND_ICON_MAP[brandIconKey] || Package;

  return (
    <div className="plain-app">
      <aside className="plain-sidebar">
        <div className="plain-brand">
          <div className="plain-brand-icon">
            <BrandIcon size={20} />
          </div>
          <div className="plain-brand-text">
            <div className="plain-brand-title">{brandName}</div>
            <div className="plain-brand-sub">{brandSub}</div>
          </div>
        </div>

        <nav className="plain-nav">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`plain-nav-btn ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <Icon size={18} />
                <span className="plain-nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="plain-sidebar-footer">
          <div className="plain-user-card">
            <div className="plain-user-avatar">
              <UserIcon size={16} />
            </div>
            <div className="plain-user-meta">
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>{user.role}</div>
            </div>
          </div>

          <button className="plain-logout" onClick={onLogout}>
            <LogOut size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> ออกจากระบบ
          </button>

          <div className="plain-version" style={{ marginTop: 8, fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
            Version {version}
          </div>
        </div>
      </aside>

      <div className="plain-main">
        <header className="plain-topbar">
          <div className="plain-topbar-section">
            <div className="plain-topbar-title">{activeNav?.label || 'Desktop Admin'}</div>
            <div className="plain-topbar-subtitle">{activeNav?.subtitle || 'พื้นที่ทำงานสำหรับแอดมินบนคอมพิวเตอร์'}</div>
          </div>

          <div className="plain-topbar-actions">
            <span className="plain-status-pill">ออนไลน์ {onlineCount}</span>
            {latency !== null && <span className="plain-status-pill">{latency}ms</span>}
            <button onClick={onRefresh} disabled={loading} className="plain-icon-btn" title="รีเฟรชข้อมูล">
              <RefreshCw size={14} className={loading ? 'plain-spin' : ''} />
            </button>
            <button className="plain-icon-btn" title="การแจ้งเตือน">
              <Bell size={14} />
            </button>
          </div>
        </header>

        <main className="plain-content">{children}</main>
      </div>
    </div>
  );
};

export default DesktopLayout;
