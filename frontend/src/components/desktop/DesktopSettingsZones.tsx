import React, { useState, useEffect } from 'react';
import { API_URL } from '../../api';

interface Props {
  user?: any;
  onRefresh?: () => void;
}

const DesktopSettingsZones: React.FC<Props> = ({ user, onRefresh }) => {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const token = user?.token || '';

  useEffect(() => { loadZones(); }, []);

  const loadZones = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/zones`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setZones(Array.isArray(data) ? data : []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), details: newDetail.trim() }),
      });
      setNewName(''); setNewDetail('');
      loadZones();
      if (onRefresh) onRefresh();
    } catch (e) { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (name: string) => {
    if (deleteConfirm !== name) { setDeleteConfirm(name); setTimeout(() => setDeleteConfirm(null), 3000); return; }
    try {
      await fetch(`${API_URL}/zones/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteConfirm(null);
      loadZones();
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="desktop-page">
      <div className="desktop-toolbar">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">map</span>
          </div>
          <div>
            <h2 className="text-[16px] font-black text-slate-900 leading-none">จัดการเขตงาน</h2>
            <p className="text-[11px] text-slate-500 font-bold mt-1">{zones.length} เขตงานในระบบ</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-2xl space-y-4">
        {/* Add form */}
        <div className="flex gap-2">
          <input
            type="text" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="ชื่อเขตงาน..."
            className="flex-1 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-teal-400"
          />
          <input
            type="text" value={newDetail} onChange={e => setNewDetail(e.target.value)}
            placeholder="รายละเอียด (ไม่บังคับ)"
            className="w-48 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-teal-400"
          />
          <button
            onClick={handleAdd} disabled={saving}
            className="h-[50px] px-6 rounded-2xl bg-teal-600 text-white text-[12px] font-black uppercase flex items-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> เพิ่ม
          </button>
        </div>

        {/* Zone list */}
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {zones.map((z: any) => (
              <div key={z.name || z.rowIndex} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-slate-200">
                <div>
                  <span className="text-[13px] font-bold text-slate-800">{z.name}</span>
                  {z.details && <span className="text-[11px] text-slate-400 ml-2">— {z.details}</span>}
                </div>
                <button
                  onClick={() => handleDelete(z.name)}
                  className={`h-8 rounded-lg flex items-center justify-center text-[11px] font-bold transition-colors ${
                    deleteConfirm === z.name
                      ? 'bg-rose-500 text-white px-3'
                      : 'w-8 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500'
                  }`}
                >
                  {deleteConfirm === z.name ? 'ยืนยัน?' : <span className="material-symbols-outlined text-[16px]">delete</span>}
                </button>
              </div>
            ))}
            {zones.length === 0 && (
              <div className="py-16 text-center text-slate-300">
                <span className="material-symbols-outlined text-[48px] block mb-2">map_off</span>
                <p className="text-[12px] font-black uppercase tracking-widest">ยังไม่มีเขตงาน</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopSettingsZones;
