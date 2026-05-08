import React, { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';

interface WelcomeProps {
  user: any;
  stats: {
    todayCount: number;
    allIn: number;
    allOut: number;
    allVoid: number;
    allRepair: number;
    allScrap: number;
    allLost: number;
    allTransit: number;
    allQuarantine: number;
  };
  latestVersion: string;
  currentVersion: string;
  announcement: string;
  onLogout: () => void;
  setActiveTab: (tab: any) => void;
  permissions?: any;
  settings?: Record<string, string>;
}

const Welcome: React.FC<WelcomeProps> = ({ user, stats, latestVersion, currentVersion, announcement, onLogout, setActiveTab, permissions, settings }) => {
  const roleDisplay = useMemo(() => {
    const role = (user.role || '').toLowerCase();
    if (role === 'admin') return 'ผู้ดูแลระบบ';
    if (role === 'staff') return 'พนักงาน';
    if (role === 'user') return 'ผู้ใช้งาน';
    return user.role || 'ผู้ใช้งาน';
  }, [user.role]);

  const perms = user.permissions || permissions || {};
  const canManageSettings = user.role === 'admin' || perms.settings;
  const needsUpdate = latestVersion && currentVersion && latestVersion !== currentVersion;
  const appName = settings?.APP_NAME || 'ETE DC';

  const quickStats = [
    { id: 'history', label: 'รายการวันนี้', val: stats.todayCount, color: 'indigo' },
    { id: 'logistics', label: 'กำลังขนส่ง', val: stats.allTransit, color: 'amber' },
    { id: 'repair', label: 'รอตรวจ', val: stats.allQuarantine, color: 'rose' },
    { id: 'receive', label: 'รับเข้า', val: stats.allIn, color: 'emerald' },
    { id: 'issue', label: 'เบิกออก', val: stats.allOut, color: 'amber' },
    { id: 'return', label: 'รับคืน', val: stats.allVoid, color: 'purple' },
  ];

  const mainMenu = [
    { id: 'receive', label: 'รับพัสดุเข้า', sub: 'บันทึกรับเข้าและตรวจข้อมูล', icon: 'input', visible: perms.btn_receive || perms.receive },
    { id: 'issue', label: 'เบิกพัสดุออก', sub: 'เลือกสินค้าและยืนยันเบิก', icon: 'output', visible: perms.btn_issue || perms.issue },
    { id: 'return', label: 'รับพัสดุคืน', sub: 'บันทึกรับคืนจากลูกค้า', icon: 'assignment_return', visible: perms.btn_return || perms.return },
    { id: 'job-request', label: 'แจ้งงาน', sub: 'สร้างงานส่งของ / รับคืน', icon: 'assignment', visible: perms.btn_job_request || perms.job_request },
    { id: 'logistics', label: 'งานขนส่ง', sub: 'ติดตามและอัปเดตงานหน้างาน', icon: 'local_shipping', visible: perms.btn_logistics || perms.logistics_manage || perms.logistics_view },
    { id: 'transfer', label: 'ย้ายพัสดุ', sub: 'ย้ายระหว่างคลัง', icon: 'swap_horiz', visible: perms.btn_transfer || perms.transfer },
    { id: 'dashboard', label: 'ดูสต็อก', sub: 'ภาพรวมคลังและสถานะสินค้า', icon: 'inventory_2', visible: perms.btn_inventory || perms.inventory_view },
    { id: 'history', label: 'ประวัติรายการ', sub: 'ค้นหาและตรวจย้อนหลัง', icon: 'history', visible: perms.btn_history || perms.history_view || perms.history_view_all },
    { id: 'reports', label: 'รายงาน', sub: 'สรุปผลและส่งออกข้อมูล', icon: 'analytics', visible: perms.btn_reports || perms.reports_view },
    { id: 'survey', label: 'สำรวจลูกค้า', sub: 'เก็บข้อมูลหน้างาน', icon: 'person_search', visible: perms.customers_view || perms.customers_edit },
    { id: 'repair', label: 'จัดการรับคืน', sub: 'ตรวจสอบพัสดุที่รอจัดการ', icon: 'engineering', visible: perms.btn_repair || perms.repair_view || perms.repair_manage },
    { id: 'settings', label: 'ตั้งค่าระบบ', sub: 'จัดการผู้ใช้และข้อมูลหลัก', icon: 'settings', visible: canManageSettings },
    { id: 'audit', label: 'บันทึกระบบ', sub: 'ตรวจสอบการใช้งานย้อนหลัง', icon: 'admin_panel_settings', visible: perms.audit_view }
  ].filter(i => {
    const r = (user.role || '').toUpperCase();
    if (r === 'ADMIN' || r === 'SUPER_ADMIN' || r === 'ผู้ดูแลระบบ' || r === 'ผู้ดูแลสูงสุด') return true;
    return i.visible;
  });

  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };

  const dotMap: Record<string, string> = {
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    emerald: 'bg-emerald-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 pb-6">
      {/* User Profile Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white text-xl font-black shadow-sm">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">สวัสดี, {appName}</p>
              <h2 className="text-[18px] font-black text-slate-900 leading-tight">{user.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  {roleDisplay}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  v{currentVersion}
                </span>
              </div>
            </div>
          </div>
        </div>
        {announcement && (
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] font-bold text-amber-700">
            {announcement}
          </div>
        )}
      </section>

      {/* Update banner */}
      {needsUpdate && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-black text-indigo-700">มีเวอร์ชันใหม่พร้อมใช้งาน</p>
            <p className="text-[11px] font-bold text-indigo-500 mt-0.5">{currentVersion} → {latestVersion}</p>
          </div>
          <button onClick={() => window.location.reload()} className="h-11 px-5 rounded-xl bg-indigo-600 text-white text-[12px] font-black uppercase tracking-widest">
            อัปเดต
          </button>
        </section>
      )}

      {/* Quick Stats */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-[16px] font-black text-slate-900">ภาพรวมงาน</h3>
          <p className="text-[11px] text-slate-500 font-bold mt-0.5">กดเพื่อเข้าไปทำงานต่อได้ทันที</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {quickStats.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveTab(s.id as any)}
              className={`rounded-xl border p-3 text-left transition-colors ${colorMap[s.color] || 'bg-slate-50 text-slate-600 border-slate-100'} hover:shadow-sm`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`h-2 w-2 rounded-full ${dotMap[s.color] || 'bg-slate-400'}`}></span>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{s.label}</p>
              </div>
              <p className="text-[18px] font-black">{s.val}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Repair alert */}
      {(perms.btn_repair || perms.repair_view || perms.repair_manage || user.role === 'admin' || user.role === 'super_admin' || user.role === 'ผู้ดูแลระบบ') && (stats.allQuarantine > 0 || stats.allScrap > 0 || stats.allLost > 0) && (
        <button onClick={() => setActiveTab('repair')} className="rounded-2xl border border-rose-100 bg-rose-50 p-4 flex items-center justify-between gap-3 text-left hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-rose-600 flex items-center justify-center border border-rose-100">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-[14px] font-black text-slate-900">รายการที่ต้องตรวจสอบ</p>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                รอตรวจ {stats.allQuarantine} • Scrap {stats.allScrap} • สูญหาย {stats.allLost}
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
        </button>
      )}

      {/* Main Menu */}
      <section>
        <div className="mb-3">
          <h3 className="text-[16px] font-black text-slate-900">เมนูทั้งหมด</h3>
          <p className="text-[11px] text-slate-500 font-bold mt-0.5">ดีไซน์และปุ่มหลักใช้แนวเดียวกันทั้งแอป</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {mainMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-indigo-200 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              </div>
              <span className="block text-[13px] font-black text-slate-800">{item.label}</span>
              <span className="mt-1 block text-[11px] font-bold text-slate-400 leading-5">{item.sub}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Bottom actions */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            if (window.confirm('คุณต้องการรีเซ็ตข้อมูลแคชและดึงข้อมูลใหม่จากระบบใช่หรือไม่?')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          className="h-12 rounded-xl border border-slate-200 bg-white text-slate-600 text-[13px] font-bold flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px] text-indigo-500">sync</span>
          รีโหลดข้อมูล
        </button>
        <button onClick={onLogout} className="h-12 rounded-xl border border-rose-200 bg-white text-rose-500 text-[13px] font-bold flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[18px]">logout</span>
          ออกจากระบบ
        </button>
      </section>
    </div>
  );
};

export default Welcome;
