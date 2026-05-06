import React, { useState, useEffect, useMemo } from 'react';
import { getPermissions, savePermissions } from '../../api';

interface Props {
  onRefresh?: () => void;
}

const ACCESS_LEVELS: Record<string, { level: number; label: string; color: string; bg: string }> = {
  SUPER_ADMIN: { level: 4, label: 'ผู้ดูแลสูงสุด', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
  ADMIN:      { level: 3, label: 'ผู้ดูแลระบบ',   color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  OFFICER:    { level: 2, label: 'จนท.ปฏิบัติการ', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  STAFF:      { level: 1, label: 'พนักงาน',       color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-200' },
};

const PERMISSION_GROUPS = [
  {
    group: 'ภาพรวม & แดชบอร์ด',
    icon: 'dashboard',
    items: [
      { key: 'dashboard_view', label: 'ดูแดชบอร์ด' },
    ]
  },
  {
    group: 'พัสดุ & คลัง',
    icon: 'inventory_2',
    items: [
      { key: 'inventory_view', label: 'ดูรายการพัสดุ' },
      { key: 'inventory_edit', label: 'แก้ไขพัสดุ' },
    ]
  },
  {
    group: 'ธุรกรรม (รับ/เบิก/คืน/ย้าย)',
    icon: 'swap_horiz',
    items: [
      { key: 'receive', label: 'รับเข้า' },
      { key: 'issue', label: 'เบิกออก' },
      { key: 'return', label: 'รับคืน' },
      { key: 'transfer', label: 'ย้ายคลัง' },
      { key: 'void_transaction', label: 'ยกเลิกรายการ' },
    ]
  },
  {
    group: 'ใบงาน & โลจิสติกส์',
    icon: 'local_shipping',
    items: [
      { key: 'job_request', label: 'แจ้งงาน/ขอเบิก' },
      { key: 'logistics_view', label: 'ดูงานขนส่ง' },
      { key: 'logistics_manage', label: 'จัดการงานขนส่ง' },
    ]
  },
  {
    group: 'ประวัติ & ตรวจสอบ',
    icon: 'history',
    items: [
      { key: 'history_view', label: 'ดูประวัติตนเอง' },
      { key: 'history_view_all', label: 'ดูประวัติทั้งหมด' },
      { key: 'audit_view', label: 'ดูบันทึกระบบ' },
      { key: 'history_show_receive', label: 'แสดงรายการรับเข้า' },
      { key: 'history_show_issue', label: 'แสดงรายการเบิก' },
      { key: 'history_show_return', label: 'แสดงรายการรับคืน' },
      { key: 'history_show_void', label: 'แสดงรายการยกเลิก' },
    ]
  },
  {
    group: 'รายงาน & ส่งออก',
    icon: 'assessment',
    items: [
      { key: 'reports_view', label: 'ดูรายงาน' },
      { key: 'reports_export', label: 'ส่งออก Excel/PDF' },
    ]
  },
  {
    group: 'ลูกค้า & ซ่อมบำรุง',
    icon: 'people',
    items: [
      { key: 'customers_view', label: 'ดูข้อมูลลูกค้า' },
      { key: 'customers_edit', label: 'แก้ไขลูกค้า' },
      { key: 'repair_view', label: 'ดูงานซ่อม' },
      { key: 'repair_manage', label: 'จัดการซ่อม' },
    ]
  },
  {
    group: 'ตั้งค่าระบบ',
    icon: 'settings',
    items: [
      { key: 'settings_view', label: 'ดูตั้งค่าระบบ' },
      { key: 'settings_edit', label: 'แก้ไขตั้งค่าระบบ' },
    ]
  },
  {
    group: 'ผู้ใช้ & สิทธิ์ (SUPER_ADMIN เท่านั้น)',
    icon: 'admin_panel_settings',
    items: [
      { key: 'users_manage', label: 'จัดการผู้ใช้' },
      { key: 'permissions_manage', label: 'จัดการสิทธิ์' },
    ]
  },
];

const DesktopSettingsPermissions: React.FC<Props> = ({ onRefresh }) => {
  const [permissions, setPermissions] = useState<Record<string, any>>({});
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleLevel, setNewRoleLevel] = useState(2);

  const roles = useMemo(() => {
    const all = Object.keys(permissions).filter(r => r && r !== 'undefined');
    // Sort by access level descending
    return all.sort((a, b) => {
      const la = ACCESS_LEVELS[a]?.level ?? 0;
      const lb = ACCESS_LEVELS[b]?.level ?? 0;
      return lb - la;
    });
  }, [permissions]);

  useEffect(() => {
    loadPermissions();
  }, []);

  useEffect(() => {
    if (roles.length > 0 && !selectedRole) {
      setSelectedRole(roles[0]);
    }
  }, [roles]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await getPermissions();
      setPermissions(data || {});
    } catch (e) {
      console.error('loadPermissions:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: string) => {
    if (!selectedRole) return;
    const current = permissions[selectedRole] || {};
    setPermissions({
      ...permissions,
      [selectedRole]: { ...current, [key]: !current[key] }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePermissions(permissions);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert('Error saving permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = () => {
    const name = newRoleName.trim().toUpperCase().replace(/\s+/g, '_');
    if (!name || roles.includes(name)) return;
    setPermissions(prev => ({ ...prev, [name]: {} }));
    setSelectedRole(name);
    setNewRoleName('');
    setShowNewRole(false);
  };

  const handleDeleteRole = (role: string) => {
    const level = ACCESS_LEVELS[role]?.level ?? 0;
    if (level >= 4) {
      alert('ไม่สามารถลบ SUPER_ADMIN ได้');
      return;
    }
    if (!confirm(`ลบบทบาท "${role}"? ผู้ใช้ที่ใช้บทบาทนี้จะต้องถูกเปลี่ยนบทบาทก่อน`)) return;
    const { [role]: _, ...rest } = permissions;
    setPermissions(rest);
    if (selectedRole === role) {
      const remaining = Object.keys(rest);
      setSelectedRole(remaining[0] || '');
    }
  };

  const currentPerms = selectedRole ? (permissions[selectedRole] || {}) : {};
  const levelInfo = ACCESS_LEVELS[selectedRole];
  const enabledCount = Object.values(currentPerms).filter(Boolean).length;
  const totalKeys = PERMISSION_GROUPS.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="desktop-page h-full flex flex-col">
      {/* Toolbar */}
      <div className="desktop-toolbar">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
          </div>
          <div>
            <h2 className="text-[16px] font-black text-slate-900 leading-none">สิทธิ์เข้าถึงพนักงาน</h2>
            <p className="text-[11px] text-slate-500 font-bold mt-1">Access Level & Roles System</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400 font-bold">
            {roles.length} บทบาท
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`h-11 px-6 rounded-xl text-[12px] font-black uppercase tracking-widest flex items-center gap-2 ${
              success
                ? 'bg-emerald-600 text-white'
                : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {success ? 'verified' : 'save'}
            </span>
            {success ? 'บันทึกแล้ว' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* Body — split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Role list */}
        <div className="w-64 shrink-0 border-r border-slate-100 bg-white overflow-y-auto p-4 space-y-2">
          {roles.map(role => {
            const info = ACCESS_LEVELS[role];
            const permCount = Object.values(permissions[role] || {}).filter(Boolean).length;
            const isSelected = selectedRole === role;
            return (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-violet-50 border-violet-200 shadow-sm'
                    : 'bg-white border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[13px] font-black ${isSelected ? 'text-violet-700' : 'text-slate-700'}`}>
                    {role}
                  </span>
                  {info && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${info.bg} ${info.color}`}>
                      Lv.{info.level}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold">
                    {permCount}/{totalKeys} สิทธิ์
                  </span>
                  {info && (
                    <span className="text-[10px] text-slate-400">{info.label}</span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Add new role */}
          {showNewRole ? (
            <div className="p-3 rounded-xl border-2 border-dashed border-violet-200 space-y-2">
              <input
                autoFocus
                type="text"
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateRole()}
                placeholder="ชื่อบทบาท (อังกฤษ)..."
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[12px] font-bold outline-none focus:border-violet-400"
              />
              <select
                value={newRoleLevel}
                onChange={e => setNewRoleLevel(Number(e.target.value))}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[12px] font-bold bg-white"
              >
                <option value={1}>ระดับ 1 — STAFF (พื้นฐาน)</option>
                <option value={2}>ระดับ 2 — OFFICER (ปฏิบัติการ)</option>
                <option value={3}>ระดับ 3 — ADMIN (ดูแลระบบ)</option>
              </select>
              <div className="flex gap-2">
                <button onClick={handleCreateRole} className="flex-1 h-9 bg-violet-600 text-white rounded-lg text-[11px] font-black uppercase">
                  สร้าง
                </button>
                <button onClick={() => setShowNewRole(false)} className="flex-1 h-9 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-bold">
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewRole(true)}
              className="w-full p-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-violet-300 hover:text-violet-500 flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span className="text-[11px] font-black uppercase">เพิ่มบทบาท</span>
            </button>
          )}
        </div>

        {/* Right: Permission detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : selectedRole ? (
            <div className="max-w-3xl space-y-8">
              {/* Role header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-[18px] font-black text-slate-900">{selectedRole}</h3>
                  {levelInfo && (
                    <span className={`text-[11px] font-black px-3 py-1 rounded-lg border ${levelInfo.bg} ${levelInfo.color}`}>
                      ระดับ {levelInfo.level} — {levelInfo.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 font-bold">
                    {enabledCount}/{totalKeys} เปิดใช้งาน
                  </span>
                  {ACCESS_LEVELS[selectedRole]?.level < 4 && (
                    <button
                      onClick={() => handleDeleteRole(selectedRole)}
                      className="h-9 px-3 rounded-lg bg-rose-50 text-rose-500 border border-rose-200 text-[11px] font-bold hover:bg-rose-100"
                    >
                      ลบบทบาท
                    </button>
                  )}
                </div>
              </div>

              {/* Select all / deselect all */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const all: Record<string, boolean> = {};
                    PERMISSION_GROUPS.forEach(g => g.items.forEach(i => all[i.key] = true));
                    setPermissions({ ...permissions, [selectedRole]: all });
                  }}
                  className="h-9 px-4 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200"
                >
                  เลือกทั้งหมด
                </button>
                <button
                  onClick={() => {
                    setPermissions({ ...permissions, [selectedRole]: {} });
                  }}
                  className="h-9 px-4 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200"
                >
                  ยกเลิกทั้งหมด
                </button>
              </div>

              {/* Permission groups */}
              {PERMISSION_GROUPS.map(group => (
                <div key={group.group} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">{group.icon}</span>
                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{group.group}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(item => {
                      const enabled = currentPerms[item.key] === true;
                      return (
                        <button
                          key={item.key}
                          onClick={() => handleToggle(item.key)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                            enabled
                              ? 'bg-violet-50 border-violet-300'
                              : 'bg-white border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <span className={`text-[12px] font-bold ${enabled ? 'text-violet-700' : 'text-slate-400'}`}>
                            {item.label}
                          </span>
                          <div className={`w-8 h-5 rounded-full relative transition-colors ${enabled ? 'bg-violet-500' : 'bg-slate-200'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-3.5' : 'left-0.5'}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300">
              <span className="material-symbols-outlined text-[64px]">lock_person</span>
              <p className="text-[14px] font-black mt-4">เลือกบทบาทด้านซ้ายเพื่อแก้ไขสิทธิ์</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesktopSettingsPermissions;
