import React, { useState, useEffect, useMemo, useCallback, Suspense, Fragment, lazy } from 'react';
import { 
 getUsers, saveUser, deleteUser, 
 getSettings, saveSettings,
 getItems, saveMasterItem, deleteMasterItem,
 clearTransactions,
 getZones, saveZone,
 getCustomers, getNextCustomerCv, deleteCustomer,
 getWarehouses,
 testTelegram, relinkTelegram,
 testEmail,
} from '../../api';
import { API_URL } from '../../api';
import type { MaterialItem, Zone, Customer } from '../../types';
import ConfirmationModal from './ConfirmationModal';
import { LoadingOverlay } from '../shared/CommonUI';


import SettingsUsers from './SettingsUsers';
import SettingsMaster from './SettingsMaster';
import DesktopSettingsMaster from '../desktop/DesktopSettingsMaster';
import SettingsNotify from '../shared/SettingsNotify';
import SettingsCustomers from '../shared/SettingsCustomers';
import SettingsWarehouses from '../shared/SettingsWarehouses';
import CustomerQuickEdit from '../shared/CustomerQuickEdit';
import SettingsPermissions from './SettingsPermissions';

interface SettingsProps {
 onRefresh?: () => void;
 user?: any;
 FULL_ADDRESS_LIST?: any[];
 FILTERED_ADDRESS_LIST?: any[];
 permissions?: any;
 clientVersion: string;
 transactions: any[];
 logisticsJobs: any[];
 isDesktop?: boolean;
}

export default function Settings({ onRefresh, user, FULL_ADDRESS_LIST, FILTERED_ADDRESS_LIST, permissions, clientVersion ="2.1.1", transactions = [], logisticsJobs = [], isDesktop = false }: SettingsProps) {
 const userRoleRaw = user?.role?.toLowerCase() || '';
 // Fix: Exclude 'office' from being treated as Super Admin even if it contains 'admin'
 const isAdministrator = (userRoleRaw.includes('admin') || userRoleRaw.includes('manager')) && !userRoleRaw.includes('office');
 const isManager = userRoleRaw === 'manager' || userRoleRaw.includes('ผู้จัดการ');

 const [activeTab, setActiveTab] = useState<'users' | 'master' | 'notify' | 'system' | 'zones' | 'customers' | 'permissions' | 'warehouses'>(() => {
 const saved = localStorage.getItem('settings_active_tab');
 if (isAdministrator && !isManager) {
 if (saved === 'notify' || saved === 'system' || saved === 'users' || saved === 'customers' || saved === 'permissions') return 'master'; 
 }
 return (saved as any) || 'users';
 });

 const [users, setUsers] = useState<any[]>([]);
 const [settings, setSettings] = useState<any>({ 
 LINE_ACCESS_TOKEN: '', NOTIFY_PRIORITY: 'LINE'
 });
 const [channels, setChannels] = useState<any[]>([]);
 const [tokens, setTokens] = useState<string[]>(['']);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [successMsg, setSuccessMsg] = useState('');

 // Form states
 const [showUserForm, setShowUserForm] = useState(false);
 const [editUser, setEditUser] = useState<any>({ username: '', password: '', name: '', role: 'staff' });
 const [showPermissions, setShowPermissions] = useState(false);
 
 const [editItem, setEditItem] = useState<MaterialItem>({
 ประเภท: '', 'ยี่ห้อหรือรูปแบบ': '', รายการ: '', สภาพ: '', รายละเอียด: '', ขนาด: '', จำนวน: 0,
 repair_qty: 0, quarantine_qty: 0,
 warehouseId: null
 } as any);

 const [masterItems, setMasterItems] = useState<MaterialItem[]>([]);
 const [zones, setZones] = useState<Zone[]>([]);
 const [showZoneForm, setShowZoneForm] = useState(false);
 const [editZone, setEditZone] = useState<Zone | null>(null);

 const [customers, setCustomers] = useState<Customer[]>([]);
 const [showCustomerForm, setShowCustomerForm] = useState(false);
 const [editCustomer, setEditCustomer] = useState<Customer>({ cv: '', name: '', phone: '', address: '', subdistrict: '', district: '', province: '', zipcode: '', lat: '', lng: '' });

 const [warehouses, setWarehouses] = useState<any[]>([]);

 const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, rowIndex: any, itemName: string, type: 'item' | 'user' | 'customer'}>({ show: false, rowIndex: null, itemName: '', type: 'item' });
 const [showItemForm, setShowItemForm] = useState(false);
 const [clearHistoryConfirm, setClearHistoryConfirm] = useState(false);
 const [keepFormOpen, setKeepFormOpen] = useState(false);
 const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
 
 const toggleExpand = (id: string) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
 
 const loadData = useCallback(async () => {
 setLoading(true);
 setError('');
 try {
 const [uData, sData, iData, zData, cData, wData] = await Promise.all([
 getUsers(), getSettings(true), getItems(true), getZones(true), getCustomers(true), getWarehouses()
 ]);
 setUsers(uData || []);
 setMasterItems(iData || []);
 setZones(zData || []);
 setCustomers(cData || []);
 setWarehouses(wData || []);
 setSettings((prev: any) => {
 const ns = { ...prev, ...sData };
 const tList = (ns.LINE_ACCESS_TOKEN ||"").split(",").map((t: string) => t.trim()).filter(Boolean);
 setTokens(tList.length ? tList : ['']);
 return ns;
 });
 } catch (err: any) { setError(err.message || 'Error loading data'); } finally { setLoading(false); }
 }, []);

 const refreshItems = useCallback(async () => {
 setLoading(true);
 try {
 const iData = await getItems(true);
 setMasterItems(iData || []);
 } catch (err: any) { setError(err.message || 'Error refreshing items'); } finally { setLoading(false); }
 }, []);

 useEffect(() => { loadData(); }, [loadData]);
 
 const suggestions = useMemo(() => {
 const getUnique = (field: keyof MaterialItem) => 
 Array.from(new Set(masterItems.map(item => String(item[field] || '').trim()).filter(Boolean))).sort();
 
 return {
 types: getUnique('ประเภท'),
 brands: getUnique('ยี่ห้อหรือรูปแบบ'),
 items: getUnique('รายการ'),
 conditions: getUnique('สภาพ'),
 sizes: getUnique('ขนาด')
 };
 }, [masterItems]);

 const showSuccess = useCallback((msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); }, []);

 const handleSaveUser = async (e: React.FormEvent) => {
 e.preventDefault(); setLoading(true);
 try { await saveUser(editUser); setShowUserForm(false); showSuccess('บันทึกสำเร็จ'); await loadData(); } catch (err: any) { setError(err.message); } finally { setLoading(false); }
 };

 const handleSaveMasterItem = async (e: React.FormEvent) => {
 e.preventDefault(); setLoading(true);
 try { 
 await saveMasterItem(editItem); 
 showSuccess('บันทึกพัสดุสำเร็จ'); 
 await refreshItems(); 
 if (onRefresh) onRefresh();
 if (!editItem.rowIndex && keepFormOpen) {
 setEditItem(prev => ({ ...prev, รายการ: '', ขนาด: '', จำนวน: 0 }));
 } else {
 setShowItemForm(false); 
 }
 } catch (err: any) { setError(err.message); } 
 finally { setLoading(false); }
 };

 const handleSaveZone = async (e: React.FormEvent) => {
 if (e) e.preventDefault(); 
 if (!editZone) return; 
 setLoading(true);
 try { await saveZone(editZone); showSuccess('บันทึกเขตสำเร็จ'); setShowZoneForm(false); await loadData(); } catch (err: any) { alert(err.message); } finally { setLoading(false); }
 };

 const handleAddNewCustomer = async () => {
 setLoading(true);
 try {
 const nextCv = await getNextCustomerCv();
 setEditCustomer({ 
 cv: nextCv, name: '', phone: '', address: '', 
 subdistrict: '', district: '', province: '', zipcode: '', lat: '', lng: '' 
 });
 setShowCustomerForm(true);
 } catch (err: any) {
 const autoCV = 'A' + Date.now().toString().slice(-8);
 setEditCustomer({ cv: autoCV, name: '', phone: '', address: '', subdistrict: '', district: '', province: '', zipcode: '', lat: '', lng: '' });
 setShowCustomerForm(true);
 } finally {
 setLoading(false);
 }
 };

 const [isUrlVisible, setIsUrlVisible] = useState(false);
 const labelClass ="text-[11px] font-black text-secondary/40 uppercase tracking-widest ml-1";

 return (
 <div className="w-full max-w-none relative px-0 py-0 pb-24 text-left">
 {/* 🚀 Clean Flat Success Popup (Instant) */}
 {successMsg && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40">
 <div className="mobile-surface-card p-8 flex flex-col items-center text-center space-y-4 max-w-sm w-full">
 <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
 <span className="material-symbols-outlined text-[40px] font-black">check_circle</span>
 </div>
 <div>
 <h3 className="text-xl font-black text-slate-900 leading-tight">บันทึกข้อมูลเรียบร้อย</h3>
 <p className="text-[13px] font-bold text-slate-500 mt-1">{successMsg}</p>
 </div>
 </div>
 </div>
 )}

 {loading && <LoadingOverlay message="กำลังประมวลผลข้อมูลตั้งค่า..." />}

 <div className="flex overflow-x-auto pb-4 mb-4 scrollbar-hide gap-3 sticky top-0 z-20 bg-transparent px-0 pt-0">
 {[
 { id: 'users', label: 'พนักงาน', icon: 'person', perm: 'set_users' },
 { id: 'master', label: 'พัสดุหลัก', icon: 'database', perm: 'set_items' },
 { id: 'notify', label: 'แจ้งเตือน', icon: 'notifications', perm: 'set_notifications' },
 { id: 'zones', label: 'เขตงาน', icon: 'map', perm: 'set_zones' },
 { id: 'customers', label: 'ลูกค้า', icon: 'groups', perm: 'set_customers' },
 { id: 'warehouses', label: 'คลังย่อย', icon: 'warehouse', perm: 'set_warehouses' },
 { id: 'system', label: 'ระบบ', icon: 'settings', perm: 'set_system' },
 ].filter(tab => {
 if (isAdministrator) return true;
 const rolePerms = permissions?.[user?.role] || {};
 return rolePerms[tab.perm as string] === true;
 }).map((tab) => (
 <button
 key={tab.id}
 onClick={(e) => { 
 setActiveTab(tab.id as any); 
 localStorage.setItem('settings_active_tab', tab.id);
 setShowUserForm(false); setShowItemForm(false); setShowCustomerForm(false); setShowZoneForm(false); 
 (e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
 }}
              className={`relative flex-shrink-0 flex flex-col items-center justify-center min-w-[64px] h-[70px] rounded-xl border gap-0.5 transition-colors ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-50' }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>
                <span className="material-symbols-outlined text-[18px]">
                  {tab.icon}
                </span>
              </div>
              <span className="text-[11px] font-black tracking-tight leading-none uppercase">
                {tab.label}
              </span>
 {activeTab === tab.id && (
 <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full"></div>
 )}
 </button>
 ))}
 </div>

 <div className="mobile-surface-card min-h-[500px] overflow-hidden">
 {error && <div className="m-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 font-bold">{error}</div>}
 
 <div className="relative">
 {activeTab === 'users' && !showUserForm && (
 showPermissions ? (
 <SettingsPermissions 
 users={users} 
 onRefresh={onRefresh}
 onBack={() => setShowPermissions(false)}
 />
 ) : (
 <SettingsUsers 
 users={users} 
 onEditUser={(u) => { setEditUser(u); setShowUserForm(true); }}
 onDeleteUser={(u) => { setDeleteConfirm({ show: true, type: 'user', rowIndex: u.rowIndex, itemName: u.name || u.username }); }}
 onAddUser={() => { setEditUser({ username: '', password: '', name: '', role: 'Staff' }); setShowUserForm(true); }}
 onManagePermissions={() => setShowPermissions(true)}
 />
 )
 )}
{activeTab === 'master' && !showItemForm && (
 (isDesktop ? (
 <DesktopSettingsMaster 
 masterItems={masterItems} 
 warehouses={warehouses}
 settings={settings}
 onRefresh={loadData} 
 onAddItem={() => { 
 setEditItem({ 
 ประเภท: '', 
 'ยี่ห้อหรือรูปแบบ': '', 
 รายการ: '', 
 สภาพ: '', 
 รายละเอียด: '', 
 ขนาด: '', 
 จำนวน: 0,
 repair_qty: 0,
 quarantine_qty: 0,
 lost_qty: 0,
 scrap_qty: 0,
 transit_qty: 0,
 warehouseId: settings.MAIN_WAREHOUSE_ID ? parseInt(settings.MAIN_WAREHOUSE_ID) : (warehouses[0]?.id || null)
 } as any); 
 setShowItemForm(true); 
 }}
 onEditItem={it => { 
 setEditItem({
 ...it,
 repair_qty: it.repair_qty || 0,
 quarantine_qty: it.quarantine_qty || 0,
 lost_qty: it.lost_qty || 0,
 scrap_qty: it.scrap_qty || 0,
 transit_qty: it.transit_qty || 0,
 warehouseId: settings.MAIN_WAREHOUSE_ID ? parseInt(settings.MAIN_WAREHOUSE_ID) : (warehouses[0]?.id || null)
 }); 
 setShowItemForm(true); 
 }} 
 onDeleteItem={idx => { 
 const t = masterItems.find(it => it.rowIndex === Number(idx)); 
 setDeleteConfirm({ show: true, rowIndex: idx, itemName: t ? t.รายการ :"รายการนี้", type: 'item' }); 
 }} 
 showSuccess={showSuccess} 
 setError={setError} 
 setLoading={setLoading} 
 loading={loading} 
 />
 ) : (
 <SettingsMaster 
 masterItems={masterItems} 
 warehouses={warehouses}
 settings={settings}
 onRefresh={loadData} 
 onAddItem={() => { 
 setEditItem({ 
 ประเภท: '', 
 'ยี่ห้อหรือรูปแบบ': '', 
 รายการ: '', 
 สภาพ: '', 
 รายละเอียด: '', 
 ขนาด: '', 
 จำนวน: 0,
 repair_qty: 0,
 quarantine_qty: 0,
 lost_qty: 0,
 scrap_qty: 0,
 transit_qty: 0,
 warehouseId: settings.MAIN_WAREHOUSE_ID ? parseInt(settings.MAIN_WAREHOUSE_ID) : (warehouses[0]?.id || null)
 }); 
 setShowItemForm(true); 
 }} 
 onEditItem={it => { 
 setEditItem({
 ...it,
 repair_qty: it.repair_qty || 0,
 quarantine_qty: it.quarantine_qty || 0,
 lost_qty: it.lost_qty || 0,
 scrap_qty: it.scrap_qty || 0,
 transit_qty: it.transit_qty || 0,
 warehouseId: settings.MAIN_WAREHOUSE_ID ? parseInt(settings.MAIN_WAREHOUSE_ID) : (warehouses[0]?.id || null)
 }); 
 setShowItemForm(true); 
 }} 
 onDeleteItem={idx => { 
 const t = masterItems.find(it => it.rowIndex === Number(idx)); 
 setDeleteConfirm({ show: true, rowIndex: idx, itemName: t ? t.รายการ :"รายการนี้", type: 'item' }); 
 }} 
 showSuccess={showSuccess} 
 setError={setError} 
 setLoading={setLoading} 
 loading={loading} 
 />
 ))
 )}
 {activeTab === 'notify' && (
 <SettingsNotify 
 settings={settings} 
 setSettings={setSettings} 
 tokens={tokens} 
 setTokens={setTokens} 
 channels={channels} 
 setChannels={setChannels} 
 loading={loading} 
 setLoading={setLoading} 
 showSuccess={showSuccess} 
 setError={setError}
 testTelegram={testTelegram}
 relinkTelegram={relinkTelegram}
 testEmail={testEmail}
 onSave={async () => {
 setLoading(true);
 try {
 await saveSettings(settings);
 showSuccess('บันทึกการตั้งค่าแจ้งเตือนสำเร็จ');
 await loadData();
 } catch(e:any) { setError(e.message); }
 finally { setLoading(false); }
 }}
 />
 )}
 {activeTab === 'customers' && !showCustomerForm && (
 <SettingsCustomers 
 customers={customers} 
 transactions={transactions}
 logisticsJobs={logisticsJobs}
 items={masterItems}
 onAddCustomer={handleAddNewCustomer} 
 onEditCustomer={c => { setEditCustomer({...c}); setShowCustomerForm(true); }} 
 onDeleteCustomer={c => setDeleteConfirm({ show: true, rowIndex: c.rowIndex, itemName: c.name, type: 'customer' })} 
 onLoadCustomers={loadData}
 isLoadingCustomers={loading}
 thaiAddressData={FILTERED_ADDRESS_LIST || FULL_ADDRESS_LIST}
 />
 )}
 
 {activeTab === 'warehouses' && (
 <SettingsWarehouses 
 settings={settings} 
 setSettings={setSettings}
 onRefresh={loadData}
 />
 )}
 
 {activeTab === 'zones' && !showZoneForm && (
 <div className="p-4 md:p-8 space-y-4">
 <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
 <span className="material-symbols-outlined text-[24px]">location_on</span>
 </div>
 <div className="text-left">
 <h2 className="text-[16px] font-black text-slate-900 leading-none">เขตการทำงาน</h2>
 <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">Work Zone Management</p>
 </div>
 </div>
 <button 
 onClick={() => { setEditZone({ name: '', description: '' }); setShowZoneForm(true); }} 
 className="bg-primary text-white h-11 px-4 rounded-xl font-black flex items-center gap-2 text-[12px] uppercase tracking-widest"
 > 
 <span className="material-symbols-outlined text-[18px]">add_location_alt</span> เพิ่มเขต 
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
 {zones
 .filter(z => !String(z.name || '').includes('โซน 1/1'))
 .map((z, i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none rotate-12">
            <span className="material-symbols-outlined text-[60px] text-primary">distance</span>
            </div>
            <div className="relative z-10">
            <div className="flex justify-between items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">map</span>
              </div>
            <div className="flex-1 min-w-0">
            <h3 className="font-black text-[14px] text-secondary leading-tight">{z.name}</h3>
            {z.description && (
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-1">{z.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-md uppercase tracking-tight">#{z.rowIndex}</span>
            </div>
            </div>
 <div className="flex gap-1.5 shrink-0">
 <button 
 onClick={() => { setEditZone(z); setShowZoneForm(true); }} 
 className="w-7 h-7 flex items-center justify-center text-primary bg-primary/5 rounded-lg"
 title="แก้ไข"
 >
 <span className="material-symbols-outlined text-[16px]">edit</span>
 </button>
 <button 
 onClick={() => { if(confirm('ยืนยันลบเขตงานนี้?')) handleSaveZone(null as any); }} 
 className="w-7 h-7 flex items-center justify-center text-red-100 bg-red-50 rounded-lg"
 title="ลบ"
 >
 <span className="material-symbols-outlined text-[16px]">delete</span>
 </button>
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 {activeTab === 'system' && (
 <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-4 pb-32">

 {/* ═══════════════════════════════════════════ */}
 {/* การตั้งค่าแจ้งเตือน — ไปที่แท็บ แจ้งเตือน */}
 {/* ═══════════════════════════════════════════ */}
 <div className="bg-white rounded-xl border border-slate-100 overflow-hidden text-left p-6">
   <div className="flex items-center gap-4">
     <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
       <span className="material-symbols-outlined text-[24px]">notifications</span>
     </div>
     <div>
       <h2 className="text-[16px] font-black text-slate-900 leading-none">ตั้งค่าการแจ้งเตือน</h2>
       <p className="text-[11px] text-slate-500 font-bold mt-1 uppercase tracking-wider">
         ไปที่แท็บ <span className="text-indigo-600">แจ้งเตือน</span> เพื่อตั้งค่า Telegram Bot, ประเภทแจ้งเตือน, Email SMTP และรายงานประจำวัน
       </p>
     </div>
   </div>
 </div>

 {/* ============================================ */}
 {/* ตัวกรองพื้นที่ (จังหวัด) */}
 {/* ============================================ */}
 <div className="bg-white rounded-xl border border-slate-100 overflow-hidden text-left">
 <div className="p-6 border-b border-slate-50 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
 <span className="material-symbols-outlined text-[24px]">map_search</span>
 </div>
 <div>
<h2 className="text-[16px] font-black text-slate-900 leading-none">ตัวกรองข้อมูลพื้นที่</h2>
<p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">
{String(settings.ENABLE_AREA_FILTER) === 'true'
 ? `${(() => { const c = ['CENTRAL','NORTH','NORTHEAST','EAST','WEST','SOUTH'].filter(k => String(settings[`FILTER_REG_${k}`]) !== 'false').length; return `${c}/6 ภาคที่ใช้งาน`; })()}`
 : 'ปิดใช้งานอยู่'}
 </p>
 </div>
 </div>
 <button 
 title={String(settings.ENABLE_AREA_FILTER) === 'true' ? 'ปิดตัวกรองพื้นที่' : 'เปิดตัวกรองพื้นที่'}
 onClick={() => setSettings({...settings, ENABLE_AREA_FILTER: String(settings.ENABLE_AREA_FILTER) === 'true' ? 'false' : 'true'})}
 className={`flex items-center gap-2 h-9 px-4 rounded-full font-black text-[12px] uppercase tracking-widest transition-all ${String(settings.ENABLE_AREA_FILTER) === 'true' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'}`}
 >
 {String(settings.ENABLE_AREA_FILTER) === 'true' ? (
 <><span className="w-2 h-2 bg-white rounded-full"></span> เปิด</>
 ) : (
 <><span className="w-2 h-2 bg-slate-400 rounded-full"></span> ปิด</>
 )}
 </button>
 </div>

 <div className="p-6 space-y-3">
 <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
 * เลือกภูมิภาคที่จะแสดงในระบบ — มีผลกับการค้นหาที่อยู่ลูกค้า
 </p>

 <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
 {(() => {
 const regions: Record<string, { label: string, colorClass: string, colorDot: string }> = {
 CENTRAL: { label: 'ภาคกลาง', colorClass: 'border-blue-200 bg-blue-50 text-blue-700', colorDot: 'bg-blue-500' },
 NORTH: { label: 'ภาคเหนือ', colorClass: 'border-emerald-200 bg-emerald-50 text-emerald-700', colorDot: 'bg-emerald-500' },
 NORTHEAST: { label: 'ภาคอีสาน', colorClass: 'border-orange-200 bg-orange-50 text-orange-700', colorDot: 'bg-orange-500' },
 EAST: { label: 'ภาคตะวันออก', colorClass: 'border-cyan-200 bg-cyan-50 text-cyan-700', colorDot: 'bg-cyan-500' },
 WEST: { label: 'ภาคตะวันตก', colorClass: 'border-indigo-200 bg-indigo-50 text-indigo-700', colorDot: 'bg-indigo-500' },
 SOUTH: { label: 'ภาคใต้', colorClass: 'border-rose-200 bg-rose-50 text-rose-700', colorDot: 'bg-rose-500' },
 };
 return Object.entries(regions).map(([key, reg]) => {
 const regId = `FILTER_REG_${key}`;
 const isActive = String(settings[regId]) !== 'false';
 const enabled = String(settings.ENABLE_AREA_FILTER) === 'true';
 return (
 <button
 key={key}
 title={`Toggle ${reg.label}`}
 onClick={() => setSettings({...settings, [regId]: isActive ? 'false' : 'true'})}
 disabled={!enabled}
className={`flex items-center gap-3 p-3 rounded-2xl border font-bold text-[13px] text-left transition-all ${
 enabled && isActive
 ? `${reg.colorClass} border`
 : 'bg-slate-50 border-slate-200 text-slate-500'
} ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
 >
 <div className={`w-3 h-3 rounded-full shrink-0 ${enabled && isActive ? reg.colorDot : 'bg-slate-300'}`}></div>
 <span>{reg.label}</span>
 {enabled && isActive && (
 <span className="ml-auto text-[10px] font-black uppercase tracking-widest opacity-60">✓</span>
 )}
 </button>
 );
 });
 })()}
 </div>
 </div>
 </div>

 {/* ============================================ */}
 {/* Save Button */}
 {/* ============================================ */}
 <button
 title="บันทึกการตั้งค่าระบบ"
 onClick={async () => {
 setLoading(true);
 try { await saveSettings(settings); showSuccess('บันทึกสำเร็จ'); await loadData(); if(onRefresh) onRefresh(); }
 catch(e:any) { alert(e.message); } finally { setLoading(false); }
 }}
 className="w-full h-11 bg-indigo-600 text-white rounded-xl font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-2"
 >
 <span className="material-symbols-outlined text-[18px]">save</span> บันทึกการตั้งค่าระบบ
 </button>
 </div>
 )}
 </div>

 {/* FORMS Layer */}
 {showUserForm && activeTab === 'users' && (
 <div className="p-4 max-w-4xl mx-auto">
 <button onClick={() => setShowUserForm(false)} className="mb-6 text-secondary/40 font-black flex items-center gap-1.5 text-xs bg-white px-5 py-2.5 rounded-xl border border-slate-100 uppercase tracking-widest">
 <span className="material-symbols-outlined text-[18px]">arrow_back</span> กลับหน้ารายการ
 </button>

 <div className="bg-white p-8 md:p-6 rounded-[3rem] border border-secondary/5 overflow-hidden relative">
 <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-50 text-left">
 <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center">
 <span className="material-symbols-outlined text-[28px]">{editUser.rowIndex ? 'edit_note' : 'person_add'}</span>
 </div>
 <div>
 <h2 className="text-2xl font-black text-secondary tracking-tight">{editUser.rowIndex ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</h2>
 <p className="text-[10px] text-secondary/40 font-bold uppercase tracking-widest mt-0.5">User Account Management</p>
 </div>
 </div>

 <form onSubmit={handleSaveUser} className="space-y-4 text-left">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelClass}>Username (ใช้สำหรับ Login)</label>
 <input title="Username" required value={editUser.username} onChange={e => setEditUser({...editUser, username: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-secondary outline-none" placeholder="username" />
 </div>
 <div className="space-y-1.5">
 <label className={labelClass}>รหัสผ่าน {editUser.rowIndex && '(เว้นว่างหากไม่แก้)'}</label>
 <input title="Password" type="password" value={editUser.password || ''} onChange={e => setEditUser({...editUser, password: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-secondary outline-none font-mono" placeholder="••••••••" />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className={labelClass}>ชื่อ-นามสกุล / ชื่อเล่น</label>
 <input title="Name" required value={editUser.name} onChange={e => setEditUser({...editUser, name: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-secondary outline-none" placeholder="ชื่อพนักงาน..." />
 </div>
 <div className="space-y-1.5">
 <label className={labelClass}>ระดับสิทธิ์ (Role)</label>
 <select 
 title="เลือกระดับสิทธิ์"
 value={editUser.role} 
 onChange={e => setEditUser({...editUser, role: e.target.value})} 
 className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-secondary outline-none appearance-none"
 >
 {/* Dynamic Roles Generation */}
 {(() => {
 // Define standard names for mapping
 const labelMap: Record<string, string> = {
 'staff': 'Staff (เจ้าหน้าที่)',
 'office admin': 'Office Admin (แอดมินออฟฟิศ)',
 'admin': 'Admin (ผู้ดูแลระบบ)',
 'manager': 'Manager (ผู้จัดการสูงสุด)'
 };

 // Get all unique roles from: 
 // 1. Existing users 
 // 2. Standard roles
 // 3. Permissions table keys (This captures newly created roles)
 const userRoles = users.map(u => String(u.role || '').toLowerCase());
 const permRoles = Object.keys(permissions).map(r => r.toLowerCase());
 const standardRoles = ['staff', 'office admin', 'admin', 'manager'];
 
 // Combine and ensure we have a clean list
 const allRoles = Array.from(new Set([...standardRoles, ...userRoles, ...permRoles])).filter(Boolean);

 return allRoles.map(r => (
 <option key={r} value={r}>
 {labelMap[r] || r.charAt(0).toUpperCase() + r.slice(1)}
 </option>
 ));
 })()}
 </select>
 </div>
 </div>

 <div className="pt-6 flex gap-4">
 <button type="button" onClick={() => setShowUserForm(false)} className="flex-1 py-4 bg-slate-100 text-secondary font-black rounded-2xl uppercase tracking-widest text-xs">ยกเลิก</button>
 <button type="submit" className="btn no-animation flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest">
 {editUser.rowIndex ? 'บันทึกการแก้ไขข้อมูล' : 'บันทึกพนักงานใหม่'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 
 {showItemForm && activeTab === 'master' && (
 <div className="p-2 md:p-4 max-w-4xl mx-auto overflow-y-auto">
 <button onClick={() => setShowItemForm(false)} className="mb-4 text-secondary/40 font-black flex items-center gap-2 text-[12px] bg-white px-4 py-2.5 rounded-xl border border-slate-100 uppercase tracking-widest">
 <span className="material-symbols-outlined text-[18px]">arrow_back</span> ย้อนกลับ
 </button>
 
 <div className="bg-white p-6 md:p-6 rounded-[2.5rem] border border-slate-100 relative overflow-hidden text-left">
 <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
 <span className="material-symbols-outlined text-[120px] text-primary">history_edu</span>
 </div>

 <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-50">
 <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center">
 <span className="material-symbols-outlined text-[24px] font-black">{editItem.rowIndex ? 'edit_square' : 'add_circle'}</span>
 </div>
 <div>
 <h2 className="text-xl font-black text-secondary tracking-tight">{editItem.rowIndex ? 'แก้ไขข้อมูลพัสดุ' : 'เพิ่มพัสดุใหม่เข้าคลัง'}</h2>
 <p className="text-[10px] text-secondary/30 font-black uppercase tracking-[0.2em] mt-0.5">Inventory Intelligence Input</p>
 </div>
 </div>

 <form onSubmit={handleSaveMasterItem} className="space-y-4 relative z-10">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">category</span> ประเภทพัสดุ
 </label>
 <input title="Item Category" list="suggest-types" value={editItem.ประเภท || ''} onChange={e => setEditItem({...editItem, ประเภท: e.target.value})} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="เริ่มพิมพ์ประเภท..." />
 <datalist id="suggest-types">{suggestions.types.map(v => <option key={v} value={v} />)}</datalist>
 </div>
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">branding_watermark</span> ยี่ห้อหรือรูปแบบ
 </label>
 <input title="Item Brand" list="suggest-brands" value={editItem['ยี่ห้อหรือรูปแบบ']} onChange={e => setEditItem({...editItem, 'ยี่ห้อหรือรูปแบบ': e.target.value})} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="เริ่มพิมพ์ยี่ห้อ..." />
 <datalist id="suggest-brands">{suggestions.brands.map(v => <option key={v} value={v} />)}</datalist>
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">inventory</span> ชื่อรายการพัสดุ
 </label>
 <input title="Item Name" list="suggest-items" value={editItem.รายการ || ''} onChange={e => setEditItem({...editItem, รายการ: e.target.value})} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="เลือกชื่อรายการที่มีอยู่ หรือพิมพ์ใหม่..." />
 <datalist id="suggest-items">{suggestions.items.map(v => <option key={v} value={v} />)}</datalist>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">verified</span> สภาพ
 </label>
 <input title="Item Condition" list="suggest-conds" value={editItem.สภาพ} onChange={e => setEditItem({...editItem, สภาพ: e.target.value})} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="ใหม่ / มือสอง" />
 <datalist id="suggest-conds">{suggestions.conditions.map(v => <option key={v} value={v} />)}</datalist>
 </div>
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">straighten</span> ขนาด
 </label>
 <input title="Item Size" list="suggest-sizes" value={editItem.ขนาด} onChange={e => setEditItem({...editItem, ขนาด: e.target.value})} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="ระบุขนาด" />
 <datalist id="suggest-sizes">{suggestions.sizes.map(v => <option key={v} value={v} />)}</datalist>
 </div>
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-indigo-600 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">pin</span> จำนวนตั้งต้น
 </label>
 <input title="Item Quantity" type="number" value={editItem.จำนวน} onChange={e => setEditItem({...editItem, จำนวน: Number(e.target.value)})} className="w-full bg-slate-50/50 border border-indigo-200 rounded-2xl px-5 py-3.5 font-black text-indigo-600 focus:bg-white text-[16px]" placeholder="0" />
 </div>

 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-indigo-600 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">warehouse</span> คลังที่เก็บ
 </label>
 <select 
 title="เลือกคลังสินค้า"
 value={editItem.warehouseId || ''}
 onChange={e => setEditItem({...editItem, warehouseId: Number(e.target.value)})}
 className="w-full bg-slate-50/50 border border-indigo-200 rounded-2xl px-5 py-3.5 font-black text-indigo-600 focus:bg-white text-[14px] appearance-none"
 >
 {warehouses.map(wh => (
 <option key={wh.id} value={wh.id}>{wh.name} {wh.id === (settings.MAIN_WAREHOUSE_ID ? parseInt(settings.MAIN_WAREHOUSE_ID) : -1) ? '(หลัก)' : ''}</option>
 ))}
 </select>
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">notes</span> หมายเหตุ / รายละเอียด
 </label>
 <textarea title="Item Remark" rows={1} value={editItem.รายละเอียด} onChange={e => setEditItem({...editItem, รายละเอียด: e.target.value})} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white resize-none text-[14px]" placeholder="ระบุข้อมูลเพิ่มเติม..." />
 </div>

 {!editItem.rowIndex && (
 <div className="px-1 py-1">
 <label className="flex items-center gap-3 cursor-pointer group">
 <div className="relative flex items-center">
 <input 
 title="Keep Form Open Check"
 type="checkbox" 
 checked={keepFormOpen} 
 onChange={e => setKeepFormOpen(e.target.checked)}
 className="w-5 h-5 rounded-lg border-2 border-slate-200 text-primary cursor-pointer"
 />
 </div>
 <span className="text-[13px] font-black text-secondary/60 uppercase tracking-tight">บันทึกและเพิ่มรายการต่อไป (ไม่ปิดฟอร์ม)</span>
 </label>
 </div>
 )}

 <div className="pt-6 flex gap-4">
 <button disabled={loading} type="button" onClick={() => setShowItemForm(false)} className="flex-1 py-4 bg-slate-100 text-secondary/60 font-black rounded-2xl uppercase tracking-widest text-xs disabled:opacity-50">ยกเลิก</button>
 <button 
 type="submit" 
 disabled={loading}
 className="btn no-animation flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:bg-slate-400"
 >
 {loading ? (
 <>
 <span className="material-symbols-outlined text-[20px]">sync</span>
 กำลังบันทึกข้อมูล...
 </>
 ) : (
 <>
 <span className="material-symbols-outlined text-[20px]">save</span>
 {editItem.rowIndex ? 'บันทึกการแก้ไข' : 'ลงทะเบียนพัสดุ'}
 </>
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 <Suspense fallback={null}>
 <CustomerQuickEdit 
 isOpen={showCustomerForm && activeTab === 'customers'}
 onClose={() => setShowCustomerForm(false)}
 customer={editCustomer}
 onSave={loadData}
 thaiAddressData={FILTERED_ADDRESS_LIST || FULL_ADDRESS_LIST || []}
 customers={customers}
 />
 </Suspense>

 {showZoneForm && activeTab === 'zones' && (
 <div className="p-4 max-w-xl mx-auto">
 <button onClick={() => setShowZoneForm(false)} className="mb-4 text-secondary/40 font-black flex items-center gap-2 text-[12px] bg-white px-4 py-2.5 rounded-xl border border-slate-100 uppercase tracking-widest">
 <span className="material-symbols-outlined text-[18px]">arrow_back</span> ย้อนกลับ
 </button>
 <div className="bg-white p-8 md:p-6 rounded-[3rem] border border-slate-100 relative overflow-hidden text-left">
 <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
 <span className="material-symbols-outlined text-[100px] text-primary">add_location</span>
 </div>
 <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-50 relative z-10">
 <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center">
 <span className="material-symbols-outlined text-[24px] font-black">{editZone?.rowIndex ? 'edit_location' : 'share_location'}</span>
 </div>
 <div>
 <h2 className="text-xl font-black text-secondary tracking-tight">{editZone?.rowIndex ? 'แก้ไขเขตงาน' : 'เพิ่มเขตงานใหม่'}</h2>
 <p className="text-[10px] text-secondary/30 font-black uppercase tracking-[0.2em] mt-0.5">Work Zone Setup</p>
 </div>
 </div>

 <form onSubmit={handleSaveZone} className="space-y-4 relative z-10">
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">pin_drop</span> ชื่อเขตงาน / รหัสเขต
 </label>
 <input title="Zone Name Input" required value={editZone?.name || ''} onChange={e => setEditZone(p=>p?({...p, name: e.target.value}):null)} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="เช่น เขต 1, โซนเหนือ..." />
 </div>
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">description</span> รายละเอียดเพิ่มเติม
 </label>
 <textarea title="Zone Description" rows={2} value={editZone?.description || ''} onChange={e => setEditZone(p=>p?({...p, description: e.target.value}):null)} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white resize-none text-[14px]" placeholder="ระบุพื้นที่ครอบคลุม (ถ้ามี)..." />
 </div>
 <div className="pt-4 flex gap-3">
 <button type="button" onClick={() => setShowZoneForm(false)} className="flex-1 py-4 bg-slate-100 text-secondary/60 font-black rounded-2xl uppercase tracking-widest text-[11px]">ยกเลิก</button>
 <button type="submit" className="btn no-animation flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2">
 <span className="material-symbols-outlined text-[20px]">save</span> บันทึกเขตงาน
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>

 <ConfirmationModal isOpen={deleteConfirm.show} title="ยืนยันการลบ" message={`ยืนยันการลบ"${deleteConfirm.itemName}"?`} confirmText="ลบ" onConfirm={async () => { const {rowIndex, type} = deleteConfirm; if(!rowIndex) return; setDeleteConfirm(p=>({...p, show:false})); setLoading(true); try { if(type==='user') await deleteUser(Number(rowIndex)); else if(type==='customer') await deleteCustomer(String(rowIndex)); else await deleteMasterItem(Number(rowIndex)); showSuccess('ลบสำเร็จ'); await loadData(); if(onRefresh) onRefresh(); } catch(e:any){alert(e.message)} finally {setLoading(false)} }} onClose={() => setDeleteConfirm(p=>({...p, show:false}))} />
 <ConfirmationModal isOpen={clearHistoryConfirm} title="ล้างประวัติ" message="ยืนยันล้างประวัติทั้งหมด?" confirmText="ล้าง" onConfirm={async () => { setClearHistoryConfirm(false); setLoading(true); try { await clearTransactions(); showSuccess('ล้างประวัติแล้ว'); if(onRefresh) onRefresh(); } catch(e:any){alert(e.message)} finally {setLoading(false)} }} onClose={() => setClearHistoryConfirm(false)} />

 </div>
 );
}

