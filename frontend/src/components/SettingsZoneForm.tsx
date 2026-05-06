import React from 'react';
import type { Zone } from '../types';

interface SettingsZoneFormProps {
 editZone: Zone | null;
 setEditZone: React.Dispatch<React.SetStateAction<Zone | null>>;
 onClose: () => void;
 onSave: (e: React.FormEvent) => void;
 loading: boolean;
}

const SettingsZoneForm: React.FC<SettingsZoneFormProps> = ({
 editZone, setEditZone, onClose, onSave, loading
}) => {
 return (
 <div className="p-4 max-w-xl mx-auto">
 <button onClick={onClose} className="mb-4 text-secondary/40 font-black flex items-center gap-2 text-[12px] bg-white px-4 py-2.5 rounded-xl border border-slate-100 uppercase tracking-widest">
 <span className="material-symbols-outlined text-[18px]">arrow_back</span> ย้อนกลับ
 </button>
 <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 relative overflow-hidden text-left">
 <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
 <span className="material-symbols-outlined text-[100px] text-primary">add_location</span>
 </div>
 <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-50 relative z-10">
 <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center ">
 <span className="material-symbols-outlined text-[24px] font-black">{editZone?.rowIndex ? 'edit_location' : 'share_location'}</span>
 </div>
 <div>
 <h2 className="text-xl font-black text-secondary tracking-tight">{editZone?.rowIndex ? 'แก้ไขเขตงาน' : 'เพิ่มเขตงานใหม่'}</h2>
 <p className="text-[10px] text-secondary/30 font-black uppercase tracking-[0.2em] mt-0.5">Work Zone Setup</p>
 </div>
 </div>

 <form onSubmit={onSave} className="space-y-5 relative z-10">
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">pin_drop</span> ชื่อเขตงาน / รหัสเขต
 </label>
 <input title="Zone Name Input" required value={editZone?.name || ''} onChange={e => setEditZone(p => p ? ({ ...p, name: e.target.value }) : null)} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="เช่น เขต 1, โซนเหนือ..." />
 </div>
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">description</span> รายละเอียดเพิ่มเติม
 </label>
 <textarea title="Zone Description" rows={2} value={editZone?.description || ''} onChange={e => setEditZone(p => p ? ({ ...p, description: e.target.value }) : null)} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white resize-none text-[14px]" placeholder="ระบุพื้นที่ครอบคลุม (ถ้ามี)..." />
 </div>
 <div className="pt-4 flex gap-3">
 <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 text-secondary/60 font-black rounded-2xl uppercase tracking-widest text-[11px]">ยกเลิก</button>
 <button type="submit" disabled={loading} className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2">
 {loading ? (
 <>
 <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full "></span>
 กำลังบันทึก...
 </>
 ) : (
 <>
 <span className="material-symbols-outlined text-[20px]">save</span> บันทึกเขตงาน
 </>
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};

export default SettingsZoneForm;
