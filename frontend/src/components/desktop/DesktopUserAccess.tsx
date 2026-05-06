import React, { useState } from 'react';
import DesktopSettingsUsers from './DesktopSettingsUsers';
import DesktopSettingsPermissions from './DesktopSettingsPermissions';
import DesktopSettingsMaster from './DesktopSettingsMaster';
import DesktopSettingsCustomers from './DesktopSettingsCustomers';
import DesktopSettingsNotify from './DesktopSettingsNotify';
import DesktopSettingsZones from './DesktopSettingsZones';
import DesktopSettingsWarehouses from './DesktopSettingsWarehouses';
import DesktopSettingsSystem from './DesktopSettingsSystem';
import { saveMasterItem, deleteMasterItem } from '../../api';
import type { MaterialItem } from '../../types';
import ConfirmationModal from '../mobile/ConfirmationModal';
import { Users, Shield, Package, Bell, MapPin, Building2, Warehouse, Settings } from 'lucide-react';

interface Props {
  onRefresh?: () => void;
  user?: any;
  transactions?: any[];
  logisticsJobs?: any[];
  FULL_ADDRESS_LIST?: any[];
  FILTERED_ADDRESS_LIST?: any[];
  permissions?: any;
  clientVersion?: string;
  items?: MaterialItem[];
  warehouses?: any[];
  settings?: any;
  setSettings?: (s: any) => void;
}

const TABS = [
  { id: 'users' as const,       Icon: Users,      label: 'พนักงาน',   desc: 'บัญชีผู้ใช้' },
  { id: 'permissions' as const, Icon: Shield,     label: 'สิทธิ์',     desc: 'บทบาท & สิทธิ์' },
  { id: 'master' as const,      Icon: Package,    label: 'พัสดุหลัก', desc: 'SKU & Stock' },
  { id: 'notify' as const,      Icon: Bell,       label: 'แจ้งเตือน', desc: 'Telegram / Gmail' },
  { id: 'zones' as const,       Icon: MapPin,     label: 'เขตงาน',    desc: 'พื้นที่ให้บริการ' },
  { id: 'customers' as const,   Icon: Building2,  label: 'ลูกค้า',     desc: 'ข้อมูลลูกค้า' },
  { id: 'warehouses' as const,  Icon: Warehouse,  label: 'คลังย่อย',   desc: 'ศูนย์กระจาย' },
  { id: 'system' as const,      Icon: Settings,   label: 'ระบบ',       desc: 'พื้นที่ & กฎระบบ' },
];

type TabId = typeof TABS[number]['id'];

const DesktopUserAccess: React.FC<Props> = ({
  onRefresh, user, transactions = [], logisticsJobs = [],
  FULL_ADDRESS_LIST = [], FILTERED_ADDRESS_LIST, permissions, clientVersion = '1.1.0',
  items: masterItems = [], warehouses: whList = [], settings: appSettings = {}, setSettings: onSettingsChange,
}) => {
  const [tab, setTab] = useState<TabId>('users');

  // ── Item management state ──
  const [editItem, setEditItem] = useState<MaterialItem | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; rowIndex?: number; itemName?: string; type?: string }>({ show: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleSaveItem = async () => {
    if (!editItem) return;
    setLoading(true);
    try {
      await saveMasterItem(editItem);
      showSuccess(editItem.rowIndex ? 'อัปเดตพัสดุเรียบร้อยแล้ว' : 'เพิ่มพัสดุใหม่เรียบร้อยแล้ว');
      setShowItemForm(false);
      setEditItem(null);
      onRefresh?.();
    } catch (err: any) {
      setError(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (deleteConfirm.rowIndex === undefined) return;
    setLoading(true);
    try {
      await deleteMasterItem(deleteConfirm.rowIndex);
      showSuccess('ลบพัสดุเรียบร้อยแล้ว');
      setDeleteConfirm({ show: false });
      onRefresh?.();
    } catch (err: any) {
      setError(err.message || 'ลบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar — Corporate Pill Style */}
      <div className="shrink-0 bg-white border-b border-slate-100">
        <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all duration-150 ${
                  active
                    ? 'bg-indigo-50/80 text-indigo-700 shadow-sm ring-1 ring-indigo-100/60'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <t.Icon size={16} strokeWidth={active ? 2.5 : 1.8} className={active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'} />
                <div className="text-left leading-tight">
                  <div className={active ? 'font-bold' : 'font-medium'}>{t.label}</div>
                  <div className={`text-[9px] font-medium ${active ? 'text-indigo-400' : 'text-slate-400'}`}>{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {tab === 'users' && (
          <DesktopSettingsUsers
            onRefresh={onRefresh}
            onManagePermissions={() => setTab('permissions')}
          />
        )}

        {tab === 'permissions' && (
          <DesktopSettingsPermissions onRefresh={onRefresh} />
        )}

        {tab === 'master' && (
          <DesktopSettingsMaster
            masterItems={masterItems}
            warehouses={whList}
            settings={appSettings}
            onRefresh={onRefresh || (() => {})}
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
                warehouseId: appSettings.MAIN_WAREHOUSE_ID ? parseInt(appSettings.MAIN_WAREHOUSE_ID) : (whList[0]?.id || null)
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
                warehouseId: appSettings.MAIN_WAREHOUSE_ID ? parseInt(appSettings.MAIN_WAREHOUSE_ID) : (whList[0]?.id || null)
              });
              setShowItemForm(true);
            }}
            onDeleteItem={idx => {
              const t = masterItems.find(it => it.rowIndex === Number(idx));
              setDeleteConfirm({ show: true, rowIndex: idx, itemName: t ? t.รายการ : 'รายการนี้', type: 'item' });
            }}
            showSuccess={showSuccess}
            setError={setError}
            setLoading={setLoading}
            loading={loading}
          />
        )}

        {tab === 'customers' && (
          <DesktopSettingsCustomers
            onRefresh={onRefresh}
            thaiAddressData={FULL_ADDRESS_LIST}
            user={user}
            logisticsJobs={logisticsJobs}
            transactions={transactions}
            items={masterItems}
          />
        )}

        {/* Placeholder tabs */}
        {tab === 'notify' && (
          <DesktopSettingsNotify user={user} onRefresh={onRefresh} />
        )}
        {tab === 'zones' && (
          <DesktopSettingsZones user={user} onRefresh={onRefresh} />
        )}
        {tab === 'warehouses' && (
          <DesktopSettingsWarehouses user={user} onRefresh={onRefresh} settings={appSettings} setSettings={onSettingsChange} />
        )}
        {tab === 'system' && (
          <DesktopSettingsSystem user={user} onRefresh={onRefresh} />
        )}
      </div>

      {/* ── Item Form Modal ── */}
      {showItemForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowItemForm(false); setEditItem(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-[16px] font-black text-slate-900">{editItem.rowIndex ? 'แก้ไขข้อมูลพัสดุ' : 'เพิ่มพัสดุใหม่เข้าคลัง'}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">กรอกข้อมูลพัสดุให้ครบถ้วน</p>
              </div>
              <button onClick={() => { setShowItemForm(false); setEditItem(null); }} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em]">ประเภท</label>
                <input value={editItem.ประเภท || ''} onChange={e => setEditItem({...editItem, ประเภท: e.target.value})} className="w-full mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-4 h-[50px] text-[13px] font-bold text-slate-800 focus:bg-white focus:border-indigo-300 outline-none" placeholder="เริ่มพิมพ์ประเภท..." />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em]">ยี่ห้อ / รูปแบบ</label>
                <input value={editItem['ยี่ห้อหรือรูปแบบ'] || ''} onChange={e => setEditItem({...editItem, 'ยี่ห้อหรือรูปแบบ': e.target.value})} className="w-full mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-4 h-[50px] text-[13px] font-bold text-slate-800 focus:bg-white focus:border-indigo-300 outline-none" placeholder="เริ่มพิมพ์ยี่ห้อ..." />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em]">รายการ</label>
                <input value={editItem.รายการ || ''} onChange={e => setEditItem({...editItem, รายการ: e.target.value})} className="w-full mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-4 h-[50px] text-[13px] font-bold text-slate-800 focus:bg-white focus:border-indigo-300 outline-none" placeholder="ชื่อรายการพัสดุ..." />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em]">สภาพ</label>
                <input value={editItem.สภาพ || ''} onChange={e => setEditItem({...editItem, สภาพ: e.target.value})} className="w-full mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-4 h-[50px] text-[13px] font-bold text-slate-800 focus:bg-white focus:border-indigo-300 outline-none" placeholder="ใหม่ / มือสอง" />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em]">ขนาด</label>
                <input value={editItem.ขนาด || ''} onChange={e => setEditItem({...editItem, ขนาด: e.target.value})} className="w-full mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-4 h-[50px] text-[13px] font-bold text-slate-800 focus:bg-white focus:border-indigo-300 outline-none" placeholder="ระบุขนาด" />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em]">จำนวน</label>
                <input type="number" value={editItem.จำนวน || 0} onChange={e => setEditItem({...editItem, จำนวน: Number(e.target.value)})} className="w-full mt-1.5 bg-indigo-50 border border-indigo-200 rounded-xl px-4 h-[50px] text-[16px] font-black text-indigo-600 focus:bg-white outline-none" placeholder="0" />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em]">คลัง</label>
                <select value={editItem.warehouseId || ''} onChange={e => setEditItem({...editItem, warehouseId: Number(e.target.value)})} className="w-full mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-4 h-[50px] text-[13px] font-bold text-slate-800 focus:bg-white focus:border-indigo-300 outline-none">
                  <option value="">-- เลือกคลัง --</option>
                  {whList.map((wh: any) => <option key={wh.id} value={wh.id}>{wh.name || wh.warehouse_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em]">รายละเอียด</label>
                <textarea rows={2} value={editItem.รายละเอียด || ''} onChange={e => setEditItem({...editItem, รายละเอียด: e.target.value})} className="w-full mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-800 focus:bg-white focus:border-indigo-300 outline-none resize-none" placeholder="ระบุข้อมูลเพิ่มเติม..." />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 rounded-b-2xl">
              <button onClick={() => { setShowItemForm(false); setEditItem(null); }} className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-[12px]">ยกเลิก</button>
              <button onClick={handleSaveItem} disabled={loading} className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-black text-[12px] disabled:opacity-50">
                {loading ? 'กำลังบันทึก...' : editItem.rowIndex ? 'บันทึกการแก้ไข' : 'ลงทะเบียนพัสดุ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        title="ยืนยันการลบ"
        message={`คุณแน่ใจหรือไม่ที่จะลบ ${deleteConfirm.itemName || 'รายการนี้'}? การกระทำนี้ไม่สามารถย้อนกลับได้`}
        onConfirm={() => { void handleDeleteItem(); }}
        onClose={() => setDeleteConfirm({ show: false })}
        isLoading={loading}
      />

      {/* ── Toast ── */}
      {error && (
        <div className="fixed bottom-6 right-6 z-[100] bg-rose-50 border border-rose-200 text-rose-700 px-5 py-3 rounded-xl text-[12px] font-bold shadow-lg animate-in">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-rose-400 hover:text-rose-600 font-black">✕</button>
        </div>
      )}
      {success && (
        <div className="fixed bottom-6 right-6 z-[100] bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-3 rounded-xl text-[12px] font-bold shadow-lg animate-in">
          {success}
        </div>
      )}
    </div>
  );
};

export default DesktopUserAccess;
