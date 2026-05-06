import React, { useState, useEffect } from 'react';
import { getWarehouses, saveWarehouse, deleteWarehouse, saveSettings } from '../../api';
import {
  Plus, MapPin, Edit, Trash2, X, Building, Star, Navigation, AlertTriangle, CheckCircle
} from 'lucide-react';
import MapPickerModal from '../MapPickerModal';

interface Props {
  user?: any;
  onRefresh?: () => void;
  settings?: any;
  setSettings?: (s: any) => void;
}

const DesktopSettingsWarehouses: React.FC<Props> = ({ user, onRefresh, settings: externalSettings, setSettings: setExternalSettings }) => {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ id: number | null; name: string; latitude: number | null; longitude: number | null }>({
    id: null, name: '', latitude: null, longitude: null
  });

  // Map picker
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Internal settings for MAIN_WAREHOUSE_ID
  const [internalSettings, setInternalSettings] = useState<any>({});
  const settings = externalSettings || internalSettings;
  const setSettings = setExternalSettings || setInternalSettings;

  const mainWhId = settings?.MAIN_WAREHOUSE_ID ? parseInt(settings.MAIN_WAREHOUSE_ID) : null;

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getWarehouses(true);
      setWarehouses(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // ─── Save ───
  const handleSave = async () => {
    const nameStr = (form.name || '').trim();
    if (!nameStr) return;
    setLoading(true);
    try {
      await saveWarehouse({ id: form.id, name: nameStr, latitude: form.latitude, longitude: form.longitude });
      await loadData();
      setShowForm(false);
      setForm({ id: null, name: '', latitude: null, longitude: null });
      setMsg('บันทึกข้อมูลคลังเรียบร้อยแล้ว');
      setTimeout(() => setMsg(''), 3000);
      if (onRefresh) onRefresh();
    } catch (e: any) { setMsg('ผิดพลาด: ' + e.message); }
    finally { setLoading(false); }
  };

  // ─── Delete ───
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await deleteWarehouse(deleteTarget.id);
      await loadData();
      setDeleteTarget(null);
      setMsg('ลบคลังและโอนย้ายสินค้าเรียบร้อยแล้ว');
      setTimeout(() => setMsg(''), 3000);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      setMsg('ผิดพลาด: ' + e.message);
      setDeleteTarget(null);
    }
    finally { setLoading(false); }
  };

  // ─── Mark as Main ───
  const markAsMain = async (id: number) => {
    setLoading(true);
    try {
      const newSettings = { ...settings, MAIN_WAREHOUSE_ID: String(id) };
      await saveSettings(newSettings);
      setSettings(newSettings);
      setMsg('กำหนดสำนักงานใหญ่เรียบร้อยแล้ว');
      setTimeout(() => setMsg(''), 3000);
      if (onRefresh) onRefresh();
    } catch (e: any) { setMsg('ผิดพลาด: ' + e.message); }
    finally { setLoading(false); }
  };

  // ─── Stats ───
  const stats = {
    total: warehouses.length,
    main: warehouses.filter(w => w.id === mainWhId).length,
    hasGps: warehouses.filter(w => w.latitude != null).length,
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={() => { setForm({ id: null, name: '', latitude: null, longitude: null }); setShowForm(true); }}
          className="h-11 rounded-xl bg-indigo-600 text-white font-black text-[12px] uppercase tracking-widest px-5 flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus size={16} /> เพิ่มคลังใหม่
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'ทั้งหมด', value: stats.total, icon: Building, color: 'bg-slate-100 text-slate-600' },
          { label: 'คลังหลัก', value: stats.main, icon: Star, color: 'bg-indigo-100 text-indigo-600' },
          { label: 'มีพิกัด GPS', value: stats.hasGps, icon: Navigation, color: 'bg-emerald-100 text-emerald-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon size={16} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
              <p className="text-[20px] font-black text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Success/Error message */}
      {msg && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 text-[13px] font-bold ${msg.includes('ผิดพลาด') ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
          <CheckCircle size={18} />
          {msg}
        </div>
      )}

      {/* Warehouse Table */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[60px]"></th>
              <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อคลังสินค้า</th>
              <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[200px]">พิกัด GPS</th>
              <th className="text-center px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[100px]">สถานะ</th>
              <th className="text-center px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[120px]">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((wh) => {
              const isMain = mainWhId === wh.id;
              return (
                <tr key={wh.id} className="border-b border-slate-50 hover:bg-slate-50/30">
                  <td className="px-5 py-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isMain ? 'bg-indigo-100 text-indigo-600' : wh.latitude != null ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <MapPin size={16} />
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-slate-800">{wh.name}</span>
                      {isMain && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-indigo-100">
                          Main Office
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {wh.latitude != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${wh.latitude},${wh.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg w-fit"
                      >
                        <Navigation size={11} />
                        {Number(wh.latitude).toFixed(5)}, {Number(wh.longitude).toFixed(5)}
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${isMain ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                      {isMain ? 'Head Office' : 'Sub DC'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {!isMain && (
                        <button
                          onClick={() => markAsMain(wh.id)}
                          className="h-8 px-3 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-[10px] font-bold uppercase tracking-widest border border-indigo-100"
                          title="ตั้งเป็นสำนักงานใหญ่"
                        >
                          <Star size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => { setForm({ id: wh.id, name: wh.name, latitude: wh.latitude, longitude: wh.longitude }); setShowForm(true); }}
                        className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center border border-slate-100"
                        title="แก้ไข"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(wh)}
                        className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center border border-slate-100"
                        title="ลบคลัง"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-[12px] text-slate-300 font-bold">
                  ยังไม่มีคลังสินค้า — กด "เพิ่มคลังใหม่" เพื่อเริ่มต้น
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Warning */}
      <div className="mt-6 bg-amber-50 border border-amber-100 p-5 rounded-2xl flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h5 className="text-[13px] font-black text-amber-800 uppercase tracking-tight">ข้อควรระวัง</h5>
          <p className="text-[12px] font-bold text-amber-700/70 mt-1">
            การลบคลังสินค้าจะ "ยุบรวม" พัสดุคงเหลือทั้งหมดเข้ากับคลังหลัก (Head Office) โดยอัตโนมัติ
            เพื่อให้สต็อกรวมของระบบยังคงถูกต้อง
          </p>
        </div>
      </div>

      {/* ─── Add/Edit Form Modal ─── */}
      {showForm && (
        <div className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-black text-slate-800">{form.id ? 'แก้ไขคลังสินค้า' : 'เพิ่มคลังสินค้าใหม่'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อคลังสินค้า</label>
                <input
                  className="w-full h-[50px] rounded-xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 mt-1 outline-none focus:border-indigo-300"
                  placeholder="ระบุชื่อคลัง..."
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className="w-full h-[50px] rounded-xl bg-indigo-50 text-indigo-600 text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-indigo-100 hover:bg-indigo-100"
                >
                  <MapPin size={16} />
                  {form.latitude != null
                    ? `พิกัด: ${form.latitude.toFixed(5)}, ${form.longitude?.toFixed(5)}`
                    : 'ปักหมุดแผนที่คลังสินค้า'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={loading || !form.name.trim()}
                className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-800"
              >
                {loading ? 'กำลังบันทึก...' : form.id ? 'อัปเดต' : 'บันทึก'}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm({ id: null, name: '', latitude: null, longitude: null }); }}
                className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-500 font-bold text-[12px]"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Map Picker Modal ─── */}
      {showMapPicker && (
        <MapPickerModal
          initialLat={form.latitude || 7.8804}
          initialLng={form.longitude || 98.3922}
          suggestedAddress={form.name || "ภูเก็ต"}
          onClose={() => setShowMapPicker(false)}
          onSelect={(lat, lng) => {
            setForm({ ...form, latitude: lat, longitude: lng });
            setShowMapPicker(false);
          }}
        />
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center p-6" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-[15px] font-black text-slate-800">ยืนยันการลบคลัง</h3>
              <p className="text-[12px] font-bold text-slate-500 mt-1">
                ลบ <span className="text-rose-600">"{deleteTarget.name}"</span>?
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                พัสดุทั้งหมดจะถูกโอนย้ายไปยังคลังหลักโดยอัตโนมัติ
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-500 font-bold text-[12px]"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 h-11 rounded-xl bg-rose-600 text-white font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-rose-700"
              >
                {loading ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopSettingsWarehouses;
