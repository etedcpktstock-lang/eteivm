import React, { useState, useEffect } from 'react';
import { getUsers, saveUser, deleteUser } from '../../api';

interface Props {
  onRefresh?: () => void;
  onManagePermissions?: () => void;
}

const ACCESS_LEVELS = [
  { value: 4, role: 'SUPER_ADMIN', label: 'ผู้ดูแลสูงสุด', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 3, role: 'ADMIN',      label: 'ผู้ดูแลระบบ',   color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 2, role: 'OFFICER',    label: 'จนท.ปฏิบัติการ', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 1, role: 'STAFF',      label: 'พนักงาน',       color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

const LEVEL_INFO: Record<number, typeof ACCESS_LEVELS[0]> = {};
ACCESS_LEVELS.forEach(l => LEVEL_INFO[l.value] = l);

const DesktopSettingsUsers: React.FC<Props> = ({ onRefresh, onManagePermissions }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('STAFF');
  const [formLevel, setFormLevel] = useState(1);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('loadUsers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormRole('STAFF');
    setFormLevel(1);
    setEditingUser(null);
    setShowForm(false);
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormName(user.name || '');
    setFormUsername(user.username || '');
    setFormPassword('');
    setFormRole(user.role || 'STAFF');
    setFormLevel(user.access_level || 1);
    setShowForm(true);
  };

  const handleAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      alert('กรุณากรอกชื่อพนักงาน');
      return;
    }

    if (!editingUser && !formUsername.trim()) {
      alert('กรุณากรอก username');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: formName.trim(),
        role: formRole,
        access_level: formLevel,
      };

      if (editingUser) {
        payload.id = editingUser.id;
        payload.username = editingUser.username;
      } else {
        payload.username = formUsername.trim();
        if (!formPassword.trim()) {
          alert('กรุณากรอกรหัสผ่าน');
          setSaving(false);
          return;
        }
        payload.password = formPassword;
      }

      if (editingUser && formPassword.trim()) {
        payload.password = formPassword;
      }

      await saveUser(payload);
      resetForm();
      await loadUsers();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert('Error: ' + (e.message || 'ไม่สามารถบันทึกได้'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: any) => {
    if (deleteConfirm !== user.id) {
      setDeleteConfirm(user.id);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }
    try {
      await deleteUser(user.id);
      setDeleteConfirm(null);
      await loadUsers();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert('Error: ' + (e.message || 'ไม่สามารถลบได้'));
    }
  };

  return (
    <div className="desktop-page h-full flex flex-col">
      {/* Toolbar */}
      <div className="desktop-toolbar">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">manage_accounts</span>
          </div>
          <div>
            <h2 className="text-[16px] font-black text-slate-900 leading-none">จัดการพนักงาน</h2>
            <p className="text-[11px] text-slate-500 font-bold mt-1">{users.length} คนในระบบ</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {onManagePermissions && (
            <button
              onClick={onManagePermissions}
              className="h-11 px-4 rounded-xl bg-white border border-violet-200 text-violet-600 text-[12px] font-black uppercase flex items-center gap-2 hover:bg-violet-50"
            >
              <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
              สิทธิ์
            </button>
          )}
          <button
            onClick={handleAdd}
            className="h-11 px-6 rounded-xl bg-indigo-600 text-white text-[12px] font-black uppercase flex items-center gap-2 hover:bg-indigo-700"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      {/* User table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อ</th>
                <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Username</th>
                <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">บทบาท</th>
                <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ระดับ</th>
                <th className="text-right px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const info = LEVEL_INFO[u.access_level] || LEVEL_INFO[1];
                return (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <span className="text-[12px] font-black">{u.name?.charAt(0) || '?'}</span>
                        </div>
                        <span className="text-[13px] font-bold text-slate-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[12px] font-bold text-slate-500">@{u.username}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg border ${info.color}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[12px] font-bold text-slate-600">Lv.{u.access_level || 1} — {info.label}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(u)}
                          className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        {u.role !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => handleDelete(u)}
                            className={`h-8 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                              deleteConfirm === u.id
                                ? 'bg-rose-500 text-white px-3 min-w-[60px]'
                                : 'w-8 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500'
                            }`}
                          >
                            {deleteConfirm === u.id ? 'ยืนยัน?' : (
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && !loading && (
            <div className="py-20 text-center text-slate-300">
              <span className="material-symbols-outlined text-[48px] block mb-2">person_search</span>
              <p className="text-[12px] font-black uppercase tracking-widest">ไม่มีผู้ใช้ในระบบ</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-black text-slate-900">
                {editingUser ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
              </h3>
              <button onClick={resetForm} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="ชื่อพนักงาน"
                  className="w-full h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    placeholder="username"
                    className="w-full h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  รหัสผ่าน {editingUser && '(เว้นว่างถ้าไม่เปลี่ยน)'}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder={editingUser ? '••••••••' : 'ตั้งรหัสผ่าน'}
                  className="w-full h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">บทบาท & ระดับ</label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCESS_LEVELS.map(l => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => { setFormRole(l.role); setFormLevel(l.value); }}
                      className={`p-3 rounded-xl border-2 text-left transition-colors ${
                        formLevel === l.value
                          ? `${l.color} border-current`
                          : 'bg-white border-slate-100 text-slate-400'
                      }`}
                    >
                      <div className="text-[13px] font-black">{l.role}</div>
                      <div className="text-[10px] font-bold mt-0.5 opacity-70">Lv.{l.value} — {l.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={resetForm} className="flex-1 h-12 rounded-xl bg-slate-100 text-slate-500 text-[12px] font-black uppercase">
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-12 rounded-xl bg-indigo-600 text-white text-[12px] font-black uppercase flex items-center justify-center gap-2"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  editingUser ? 'บันทึก' : 'สร้างผู้ใช้'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopSettingsUsers;
