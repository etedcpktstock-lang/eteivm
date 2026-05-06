import React from 'react';

interface SettingsUsersProps {
 users: any[];
 onEditUser: (user: any) => void;
 onDeleteUser: (user: any) => void;
 onAddUser: () => void;
 onManagePermissions?: () => void;
}

const SettingsUsers: React.FC<SettingsUsersProps> = ({ users, onEditUser, onDeleteUser, onAddUser, onManagePermissions }) => {
 return (
 <div className="p-4 md:p-8 space-y-4">
 <div className="mobile-toolbar-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none rotate-12">
 <span className="material-symbols-outlined text-[100px] text-primary">badge</span>
 </div>
 
 <div className="flex items-center gap-4 relative z-10">
 <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
 <span className="material-symbols-outlined text-[26px]">manage_accounts</span>
 </div>
 <div className="text-left">
            <h2 className="text-base font-bold text-slate-900 tracking-tight leading-none">จัดการพนักงาน</h2>
            <p className="text-[11px] text-slate-500 font-medium mt-1 leading-none">Team & Privilege System</p>
 </div>
 </div>

 <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
 <button 
 onClick={onAddUser} 
 className="btn no-animation flex-1 md:flex-none h-12 px-8 bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-2.5 text-[13px] uppercase tracking-widest whitespace-nowrap"
 >
 <span className="material-symbols-outlined text-[20px]">person_add</span>
 เพิ่มคนใหม่
 </button>
 {onManagePermissions && (
 <button 
 onClick={onManagePermissions} 
 className="btn no-animation w-12 h-12 bg-white text-primary rounded-2xl font-black flex items-center justify-center border-2 border-primary/20 shrink-0"
 title="ตั้งค่าสิทธิ์"
 >
 <span className="material-symbols-outlined text-[24px]">admin_panel_settings</span>
 </button>
 )}
 </div>
 </div>

 {/* User Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {users.map((u, idx) => (
            <div key={idx} className="bg-white border border-slate-100 rounded-xl p-5 group relative overflow-hidden text-left">
            <div className="flex flex-col h-full space-y-3 relative z-10 text-left">
            <div className="flex items-start justify-between gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="text-[13px] font-black">{u.name?.charAt(0) || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-black text-slate-800 leading-snug line-clamp-1">{u.name}</h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-black rounded-md uppercase tracking-tight border border-primary/10">{u.role}</span>
                  <span className="text-[11px] text-slate-300 font-black uppercase tracking-tighter">@{u.username}</span>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
              <button 
 onClick={() => onEditUser(u)} 
 className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100"
 >
 <span className="material-symbols-outlined text-[18px]">edit</span>
 </button>
 <button 
 onClick={() => onDeleteUser(u)} 
 className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100"
 >
 <span className="material-symbols-outlined text-[18px]">delete</span>
 </button>
 </div>
 </div>
 </div>
 </div>
 ))}
 {users.length === 0 && (
 <div className="py-32 text-center col-span-full bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
 <span className="material-symbols-outlined text-[48px] text-slate-200 block mb-2">person_search</span>
 <p className="text-secondary/20 font-black uppercase tracking-[0.3em] text-[10px]">ไม่พบข้อมูลพนักงานในระบบ</p>
 </div>
 )}
 </div>
 </div>
 );
};

export default React.memo(SettingsUsers);
