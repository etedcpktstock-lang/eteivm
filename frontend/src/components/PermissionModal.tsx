import React, { useState, useEffect } from 'react';
import { getPermissions, savePermissions } from '../api';

interface PermissionModalProps {
 isOpen: boolean;
 onClose: () => void;
 onRefresh?: () => void; // เพิ่ม callback เพื่อโหลดข้อมูลใหม่ทันที
 users: any[];
}

const PERMISSION_KEYS = [
 { group: 'หน้าแรก (Home Buttons)', items: [
 { key: 'btn_inventory', label: 'ปุ่มจัดการพัสดุ' },
 { key: 'btn_settings', label: 'ปุ่มตั้งค่าและจัดการพนักงาน' }
 ]},
 { group: 'เมนูด้านล่าง (Bottom Nav)', items: [
 { key: 'nav_home', label: 'เมนูหน้าแรก' },
 { key: 'nav_inventory', label: 'เมนูสต็อกพัสดุ' },
 { key: 'nav_receive', label: 'เมนูรับเข้า' },
 { key: 'nav_issue', label: 'เมนูเบิกจ่าย' },
 { key: 'nav_void', label: 'เมนูยกเลิก' },
 { key: 'nav_history', label: 'เมนูประวัติรายการ' },
 { key: 'nav_calendar', label: 'เมนูปฏิทิน' },
 { key: 'nav_settings', label: 'เมนูตั้งค่า' }
 ]},
 { group: 'เมนูในการตั้งค่า (Settings Tabs)', items: [
 { key: 'set_items', label: 'ตั้งค่าพัสดุหลัก' },
 { key: 'set_zones', label: 'จัดการเขตงาน' },
 { key: 'set_customers', label: 'จัดการลูกค้า / CV' },
 { key: 'set_users', label: 'จัดการพนักงาน / สิทธิ์' },
 { key: 'set_notifications', label: 'ตั้งค่าแจ้งเตือน' }
 ]}
];

const PermissionModal: React.FC<PermissionModalProps> = ({ isOpen, onClose, onRefresh, users }) => {
 const [permissions, setPermissions] = useState<Record<string, any>>({});
 const [selectedRole, setSelectedRole] = useState<string>('');
 const [loading, setLoading] = useState(false);

 const uniqueRoles = Array.from(new Set(users.map(u => u.role)))
 .filter(Boolean)
 .filter(role => {
 const r = String(role).toLowerCase();
 return !r.includes('manager') && !r.includes('จัดการ') && !r.includes('ผู้ดูแลระบบ') && r !== 'admin';
 });

 useEffect(() => {
 if (isOpen) {
 loadPermissions();
 if (uniqueRoles.length > 0 && !selectedRole) {
 setSelectedRole(uniqueRoles[0]);
 }
 }
 }, [isOpen]);

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
 alert('บันทึกสิทธิ์เรียบร้อยแล้ว');
 onClose();
 } catch (e) {
 alert('เกิดข้อผิดพลาดในการบันทึก');
 } finally {
 setLoading(false);
 }
 };

 if (!isOpen) return null;

 const currentPerms = selectedRole ? (permissions[selectedRole] || {}) : {};

 return (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 font-bold">
 <div className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden flex flex-col border border-white/20 max-h-[90vh]">
 
 {/* Header */}
 <div className="p-6 border-b border-slate-700 flex items-center justify-between text-white">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white ">
 <span className="material-symbols-outlined text-[24px]">admin_panel_settings</span>
 </div>
 <div>
 <h4 className="font-black leading-none uppercase tracking-tight">จัดการสิทธิ์การเข้าถึง</h4>
 <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Role-Based Access Control</p>
 </div>
 </div>
 <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
 <span className="material-symbols-outlined font-black">close</span>
 </button>
 </div>

 {/* Role Selector */}
 <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col gap-2">
 <label className="text-[11px] font-black text-secondary/40 uppercase tracking-widest ml-1">เลือกตำแหน่งที่ต้องการกำหนดสิทธิ์</label>
 <div className="flex flex-wrap gap-2">
 {uniqueRoles.map(role => (
 <button
 key={role}
 onClick={() => setSelectedRole(role)}
 className={`px-8 h-12 rounded-[1.2rem] text-[13px] font-black uppercase tracking-widest flex items-center justify-center ${
 selectedRole === role 
 ? 'bg-primary text-white border-2 border-primary' 
 : 'bg-white text-secondary/40 border-2 border-slate-100 '
 }`}
 >
 {role}
 </button>
 ))}
 </div>
 </div>

 {/* Permissions Groups */}
 <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white custom-scrollbar">
 {selectedRole && PERMISSION_KEYS.map(group => (
 <div key={group.group} className="space-y-4">
 <h5 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
 <div className="w-1 h-3 bg-primary rounded-full"></div>
 {group.group}
 </h5>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {group.items.map(item => (
 <label 
 key={item.key}
 className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer group select-none ${
 currentPerms[item.key] 
 ? 'bg-primary/5 border-primary ' 
 : 'bg-slate-50 border-transparent '
 }`}
 >
 <span className={`text-[13px] font-bold ${currentPerms[item.key] ? 'text-primary' : 'text-secondary/60'}`}>
 {item.label}
 </span>
 <div 
 onClick={(e) => { e.preventDefault(); handleToggle(item.key); }}
 className={`w-10 h-6 rounded-full relative ${
 currentPerms[item.key] ? 'bg-primary' : 'bg-slate-300'
 }`}
 >
 <div className={`absolute top-1 w-4 h-4 rounded-full bg-white ${
 currentPerms[item.key] ? 'left-5' : 'left-1'
 }`}></div>
 </div>
 <input 
 type="checkbox" 
 className="hidden" 
 checked={!!currentPerms[item.key]} 
 onChange={() => handleToggle(item.key)}
 />
 </label>
 ))}
 </div>
 </div>
 ))}
 {!selectedRole && (
 <div className="h-full flex flex-col items-center justify-center text-secondary/20 py-10 opacity-30">
 <span className="material-symbols-outlined text-[60px]">shield_person</span>
 <p className="font-black text-[12px] uppercase tracking-widest mt-4">เลือกตำแหน่งเพื่อเริ่มต้น</p>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-6 bg-slate-50 border-t border-slate-100">
 <button 
 onClick={handleSave}
 disabled={loading || !selectedRole}
 className="w-full py-4 bg-primary text-white font-black rounded-2xl text-sm uppercase tracking-widest flex items-center justify-center gap-2"
 >
 {loading ? 'กำลังบันทึก...' : <><span className="material-symbols-outlined text-[20px]">save</span> บันทึกสิทธิ์</>}
 </button>
 </div>
 </div>
 </div>
 );
};

export default PermissionModal;
