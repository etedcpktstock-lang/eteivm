import React from 'react';

interface SettingsUserFormProps {
 editUser: any;
 setEditUser: React.Dispatch<React.SetStateAction<any>>;
 onClose: () => void;
 onSave: (e: React.FormEvent) => void;
 loading: boolean;
}

const SettingsUserForm: React.FC<SettingsUserFormProps> = ({
 editUser, setEditUser, onClose, onSave, loading
}) => {
 const labelClass = "text-[11px] font-black text-secondary/40 uppercase tracking-widest ml-1";

 return (
 <div className="p-4 max-w-4xl mx-auto">
 <button onClick={onClose} className="mb-6 text-secondary/40 font-black flex items-center gap-1.5 text-xs bg-white px-5 py-2.5 rounded-xl border border-slate-100 uppercase tracking-widest">
 <span className="material-symbols-outlined text-[18px]">arrow_back</span> กลับหน้ารายการ
 </button>

 <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-secondary/5 overflow-hidden relative">
 <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-50 text-left">
 <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center ">
 <span className="material-symbols-outlined text-[28px]">{editUser.rowIndex ? 'edit_note' : 'person_add'}</span>
 </div>
 <div>
 <h2 className="text-2xl font-black text-secondary tracking-tight">{editUser.rowIndex ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</h2>
 <p className="text-[10px] text-secondary/40 font-bold uppercase tracking-widest mt-0.5">User Account Management</p>
 </div>
 </div>

 <form onSubmit={onSave} className="space-y-6 text-left">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-1.5">
 <label className={labelClass}>Username (ใช้สำหรับ Login)</label>
 <input title="Username" required value={editUser.username} onChange={e => setEditUser({ ...editUser, username: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-secondary outline-none " placeholder="username" />
 </div>
 <div className="space-y-1.5">
 <label className={labelClass}>รหัสผ่าน {editUser.rowIndex && '(เว้นว่างหากไม่แก้)'}</label>
 <input title="Password" type="password" value={editUser.password || ''} onChange={e => setEditUser({ ...editUser, password: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-secondary outline-none font-mono" placeholder="••••••••" />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-1.5">
 <label className={labelClass}>ชื่อ-นามสกุล / ชื่อเล่น</label>
 <input title="Name" required value={editUser.name} onChange={e => setEditUser({ ...editUser, name: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-secondary outline-none " placeholder="ชื่อพนักงาน..." />
 </div>
 <div className="space-y-1.5">
 <label className={labelClass}>ระดับสิทธิ์ (Role)</label>
 <select
 title="เลือกระดับสิทธิ์"
 value={editUser.role}
 onChange={e => setEditUser({ ...editUser, role: e.target.value })}
 className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-secondary outline-none "
 >
 <option value="staff">Staff (เจ้าหน้าที่)</option>
 <option value="office admin">Office Admin (แอดมินออฟฟิศ)</option>
 <option value="admin">Admin (ผู้ดูแลระบบ)</option>
 <option value="manager">Manager (ผู้จัดการสูงสุด)</option>
 </select>
 </div>
 </div>

 <div className="pt-6 flex gap-4">
 <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 text-secondary font-black rounded-2xl uppercase tracking-widest text-xs">ยกเลิก</button>
 <button
 type="submit"
 disabled={loading}
 className={`flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
 >
 {loading ? (
 <>
 <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full "></span>
 กำลังบันทึก...
 </>
 ) : (
 editUser.rowIndex ? 'บันทึกการแก้ไขข้อมูล' : 'บันทึกพนักงานใหม่'
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};

export default SettingsUserForm;
