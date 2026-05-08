import React, { useState, useEffect, useMemo } from 'react';
import { getPermissions, savePermissions, saveUser } from '../../api';

interface SettingsPermissionsProps {
 users: any[];
 onRefresh?: () => void;
 onBack?: () => void;
}

const PERMISSION_KEYS = [
 { group: 'หน้าแรก (HOME BUTTONS)', items: [
 { key: 'btn_inventory', label: 'ปุ่มจัดการพัสดุ (สต็อก)' },
 { key: 'btn_receive', label: 'ปุ่มลัดรับเข้า' },
 { key: 'btn_issue', label: 'ปุ่มลัดเบิกพัสดุ' },
 { key: 'btn_return', label: 'ปุ่มลัดรับคืน' },
 { key: 'btn_job_request', label: 'ปุ่มแจ้งงาน / คืน' },
 { key: 'btn_history', label: 'ปุ่มประวัติรายการ' },
 { key: 'btn_repair', label: 'ปุ่มจัดการพัสดุรับคืน' },
 { key: 'btn_settings', label: 'ปุ่มตั้งค่าระบบ' }
 ]},
 { group: 'เมนูด้านล่าง (BOTTOM NAV)', items: [
 { key: 'nav_home', label: 'เมนูหน้าแรก' }
 ]},
 { group: 'ตั้งค่าประวัติรายการ (History Permissions)', items: [
 { key: 'history_view_all', label: 'มองเห็นประวัติพนักงานคนอื่น (View All)' },
 { key: 'history_show_receive', label: 'แสดงรายการรับเข้า (Receive)' },
 { key: 'history_show_issue', label: 'แสดงรายการเบิกจ่าย (Issue)' },
 { key: 'history_show_return', label: 'แสดงรายการรับคืน (Return)' },
 { key: 'history_show_void', label: 'แสดงรายการยกเลิก (Void)' }
 ]},
 { group: 'เมนูในการตั้งค่า (Settings Tabs)', items: [
 { key: 'set_items', label: 'ตั้งค่าพัสดุหลัก' },
 { key: 'set_zones', label: 'จัดการเขตงาน' },
 { key: 'set_customers', label: 'จัดการลูกค้า / CV' },
 { key: 'set_users', label: 'จัดการพนักงาน / สิทธิ์' },
 { key: 'set_notifications', label: 'ตั้งค่าแจ้งเตือน' },
 { key: 'set_ota', label: 'ระบบ / ตั้งค่า OTA' }
 ]}
];

const SettingsPermissions: React.FC<SettingsPermissionsProps> = ({ users, onRefresh, onBack }) => {
 const [permissions, setPermissions] = useState<Record<string, any>>({});
 const [selectedRole, setSelectedRole] = useState<string>('');
 const [loading, setLoading] = useState(false);
 const [success, setSuccess] = useState(false);

 const [newRoles, setNewRoles] = useState<string[]>([]);

 const uniqueRoles = useMemo(() => {
 const fromUsers = Array.from(new Set(users.map(u => u.role))).filter(Boolean);
 const combinedWithNew = Array.from(new Set([...fromUsers, ...newRoles])).filter(Boolean);
 
 return combinedWithNew.filter(role => {
 const r = String(role).toLowerCase();
 return r !== 'admin' && r !== 'ผู้ดูแลระบบ';
 });
 }, [users, newRoles]);

 useEffect(() => {
 loadPermissions();
 }, []);

 useEffect(() => {
 if (uniqueRoles.length > 0 && !selectedRole) {
 setSelectedRole(uniqueRoles[0]);
 }
 }, [uniqueRoles]);

 const [showAddRoleInput, setShowAddRoleInput] = useState(false);
 const [newRoleName, setNewRoleName] = useState('');

 const handleCreateRole = () => {
 if (newRoleName && newRoleName.trim()) {
 const cleanName = newRoleName.trim();
 if (!uniqueRoles.includes(cleanName)) {
 setNewRoles(prev => [...prev, cleanName]);
 setSelectedRole(cleanName);
 setNewRoleName('');
 setShowAddRoleInput(false);
 }
 }
 };

 const loadPermissions = async () => {
 setLoading(true);
 try {
 const data = await getPermissions();
 setPermissions(data);
 } catch (e) {
 console.error(e);
 } finally {
 setLoading(false);
 }
 };

 const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

 const handleDeleteRole = async (roleName: string) => {
 if (roleToDelete !== roleName) {
 setRoleToDelete(roleName);
 setTimeout(() => setRoleToDelete(null), 3000);
 return;
 }
 
 setLoading(true);
 setRoleToDelete(null);
 try {
 const usersToDemote = users.filter(u => String(u.role || '').toLowerCase() === roleName.toLowerCase());
 for (const u of usersToDemote) {
 await saveUser({ ...u, role: 'staff' });
 }
 const newPerms = { ...permissions };
 delete newPerms[roleName];
 await savePermissions(newPerms);
 if (onRefresh) onRefresh();
 setNewRoles(prev => prev.filter(r => r !== roleName));
 const remainingRoles = uniqueRoles.filter(r => r !== roleName);
 if (remainingRoles.length > 0) {
 setSelectedRole(remainingRoles[0]);
 } else {
 setSelectedRole('');
 }
 } catch (e) {
 alert('Error deleting role');
 } finally {
 setLoading(false);
 }
 };

 const handleToggle = (key: string) => {
 if (!selectedRole) return;
 const current = permissions[selectedRole] || {};
 setPermissions({
 ...permissions,
 [selectedRole]: {
 ...current,
 [key]: !current[key]
 }
 });
 };

 const handleSave = async () => {
 setLoading(true);
 try {
 await savePermissions(permissions);
 if (onRefresh) onRefresh();
 setSuccess(true);
 setTimeout(() => setSuccess(false), 3000);
 } catch (e) {
 alert('Error saving permissions');
 } finally {
 setLoading(false);
 }
 };

 const currentPerms = selectedRole ? (permissions[selectedRole] || {}) : {};

 return (
 <div className="p-4 md:p-8 space-y-4 text-left">
 <div className="mobile-toolbar-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none rotate-12">
 <span className="material-symbols-outlined text-[100px] text-primary">security</span>
 </div>
 
 <div className="flex items-center gap-4 relative z-10">
 {onBack && (
 <button title="Back" onClick={onBack} className="btn no-animation w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center">
 <span className="material-symbols-outlined text-[20px]">arrow_back</span>
 </button>
 )}
 <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight leading-none">สิทธิ์เข้าถึงพนักงาน</h2>
            <p className="text-[11px] text-slate-500 font-medium mt-1 leading-none">Access Level & Roles System</p>
 </div>
 </div>

 <div className="flex flex-wrap gap-2.5 relative z-10 w-full md:w-auto items-center overflow-x-auto scrollbar-hide pb-1">
 {uniqueRoles.map(role => {
  const isDefault = ['super_admin', 'staff'].includes(role.toLowerCase());
 return (
 <div key={role} className="relative flex-shrink-0">
 <button
 onClick={() => setSelectedRole(role)}
 className={`h-11 px-6 rounded-xl text-[12px] font-black uppercase tracking-widest ${selectedRole === role ? 'bg-primary text-white scale-100 border-primary' : 'bg-white text-slate-300 border border-slate-100'}`}
 >
 {role}
 </button>
 
 {!isDefault && (
 <button 
 title="Delete Role"
 onClick={(e) => { e.stopPropagation(); handleDeleteRole(role); }}
 className={`absolute -top-2 -right-2 h-6 flex items-center justify-center rounded-lg border-2 border-white z-[30] px-2 ${ roleToDelete === role ? 'bg-orange-500 w-auto min-w-[60px]' : 'bg-rose-500 w-6' }`}
 >
 {roleToDelete === role ? (
 <span className="text-[8px] text-white font-black uppercase whitespace-nowrap">ยืนยัน?</span>
 ) : (
 <span className="material-symbols-outlined text-[14px] text-white font-black">close</span>
 )}
 </button>
 )}
 </div>
 );
 })}

 {showAddRoleInput ? (
 <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 grow md:grow-0">
 <input 
 title="New Role Name"
 autoFocus
 type="text" 
 value={newRoleName}
 onChange={(e) => setNewRoleName(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleCreateRole()}
 placeholder="ระบุตำแหน่งใหม่..."
 className="h-9 px-4 bg-transparent text-[13px] font-extrabold outline-none w-32 md:w-44 placeholder:text-slate-300"
 />
 <button title="Confim" onClick={handleCreateRole} className="btn no-animation h-9 w-9 bg-primary text-white rounded-xl flex items-center justify-center">
 <span className="material-symbols-outlined text-[18px]">check</span>
 </button>
 <button title="Cancel" onClick={() => setShowAddRoleInput(false)} className="h-9 w-9 bg-white text-slate-400 rounded-xl flex items-center justify-center border border-slate-100">
 <span className="material-symbols-outlined text-[18px]">close</span>
 </button>
 </div>
 ) : (
 <button 
 title="Add New Role"
 onClick={() => setShowAddRoleInput(true)}
 className="h-11 w-11 rounded-xl bg-white text-primary border border-dashed border-primary/40 flex items-center justify-center grow-0 shrink-0"
 >
 <span className="material-symbols-outlined text-[24px]">add_task</span>
 </button>
 )}
 </div>
 </div>

 <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 md:p-6 space-y-10 relative overflow-hidden min-h-[400px]">
 {loading && (
 <div className="absolute inset-0 bg-white/70 z-50 flex flex-col items-center justify-center">
 <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full"></div>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">กำลังประมวลผลข้อมูล</p>
 </div>
 )}

 {selectedRole ? (
 <div className="space-y-10">
 {PERMISSION_KEYS.map(group => (
 <div key={group.group} className="space-y-4">
 <div className="flex items-center gap-3">
 <div className="w-1.5 h-5 bg-primary rounded-full"></div>
 <h5 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">{group.group}</h5>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {group.items.map(item => (
 <button 
 key={item.key}
 onClick={() => handleToggle(item.key)}
 className={`mobile-row flex items-center justify-between p-5 rounded-xl border-2 group select-none text-left ${currentPerms[item.key] ? 'bg-primary border-primary' : 'bg-slate-50 border-transparent'}`}
 >
 <span className={`text-[14px] font-black ${currentPerms[item.key] ? 'text-white' : 'text-slate-400 font-bold'}`}>
 {item.label}
 </span>
 <div className={`w-10 h-6 rounded-full relative ${currentPerms[item.key] ? 'bg-white/30' : 'bg-slate-200'}`}>
 <div className={`absolute top-1 w-4 h-4 rounded-full ${currentPerms[item.key] ? 'left-5 bg-white' : 'left-1 bg-white/70'}`}></div>
 </div>
 </button>
 ))}
 </div>
 </div>
 ))}

 <div className="pt-10 border-t border-slate-50 flex flex-col md:flex-row items-center gap-4">
 <button 
 onClick={handleSave}
 disabled={loading}
 className={`btn no-animation w-full md:w-auto h-16 px-6 rounded-[2.2rem] font-black flex items-center justify-center gap-3 text-[15px] uppercase tracking-widest ${success ? 'bg-emerald-600 text-white' : 'bg-primary text-white'}`}
 >
 <span className="material-symbols-outlined text-[24px]">
 {success ? 'verified' : 'save_as'}
 </span>
 {success ? 'อัปเดตเรียบร้อย' : 'บันทึกการตั้งสิทธิ์'}
 </button>
 <div className="flex-1 text-center md:text-left space-y-1">
 <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest leading-loose italic">
 * ระบบจะอัปเดตสิทธิ์ความปลอดภัยทันทีที่ผู้ใช้โหลดหน้าเว็บใหม่
 </p>
 </div>
 </div>
 </div>
 ) : (
 <div className="py-32 flex flex-col items-center justify-center text-center opacity-30">
 <span className="material-symbols-outlined text-[60px]">lock_person</span>
 <p className="text-[12px] font-black uppercase tracking-[0.4em] mt-4">กรุณาเลือกตำแหน่งด้านบน</p>
 </div>
 )}
 </div>
 </div>
 );
};

export default React.memo(SettingsPermissions);
