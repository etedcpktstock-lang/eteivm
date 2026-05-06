import React from 'react';
import type { MaterialItem } from '../types';

interface SettingsItemFormProps {
 editItem: MaterialItem;
 setEditItem: React.Dispatch<React.SetStateAction<MaterialItem>>;
 onClose: () => void;
 onSave: (e: React.FormEvent) => void;
 loading: boolean;
 suggestions: {
 types: string[];
 brands: string[];
 items: string[];
 conditions: string[];
 sizes: string[];
 };
 keepFormOpen: boolean;
 setKeepFormOpen: (val: boolean) => void;
}

const SettingsItemForm: React.FC<SettingsItemFormProps> = ({
 editItem, setEditItem, onClose, onSave, loading, suggestions, keepFormOpen, setKeepFormOpen
}) => {
 return (
 <div className="p-2 md:p-4 max-w-4xl mx-auto overflow-y-auto">
 <button onClick={onClose} className="mb-4 text-secondary/40 font-black flex items-center gap-2 text-[12px] bg-white px-4 py-2.5 rounded-xl border border-slate-100 uppercase tracking-widest">
 <span className="material-symbols-outlined text-[18px]">arrow_back</span> ย้อนกลับ
 </button>

 <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 relative overflow-hidden text-left">
 <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
 <span className="material-symbols-outlined text-[120px] text-primary">history_edu</span>
 </div>

 <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-50">
 <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center ">
 <span className="material-symbols-outlined text-[24px] font-black">{editItem.rowIndex ? 'edit_square' : 'add_circle'}</span>
 </div>
 <div>
 <h2 className="text-xl font-black text-secondary tracking-tight">{editItem.rowIndex ? 'แก้ไขข้อมูลพัสดุ' : 'เพิ่มพัสดุใหม่เข้าคลัง'}</h2>
 <p className="text-[10px] text-secondary/30 font-black uppercase tracking-[0.2em] mt-0.5">Inventory Intelligence Input</p>
 </div>
 </div>

 <form onSubmit={onSave} className="space-y-5 relative z-10">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">category</span> ประเภทพัสดุ
 </label>
 <input title="Item Category" list="suggest-types" value={editItem.ประเภท || ''} onChange={e => setEditItem({ ...editItem, ประเภท: e.target.value })} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="เริ่มพิมพ์ประเภท..." />
 <datalist id="suggest-types">{suggestions.types.map(v => <option key={v} value={v} />)}</datalist>
 </div>
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">branding_watermark</span> ยี่ห้อหรือรูปแบบ
 </label>
 <input title="Item Brand" list="suggest-brands" value={editItem['ยี่ห้อหรือรูปแบบ']} onChange={e => setEditItem({ ...editItem, 'ยี่ห้อหรือรูปแบบ': e.target.value })} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="เริ่มพิมพ์ยี่ห้อ..." />
 <datalist id="suggest-brands">{suggestions.brands.map(v => <option key={v} value={v} />)}</datalist>
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">inventory</span> ชื่อรายการพัสดุ
 </label>
 <input title="Item Name" list="suggest-items" value={editItem.รายการ || ''} onChange={e => setEditItem({ ...editItem, รายการ: e.target.value })} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="เลือกชื่อรายการที่มีอยู่ หรือพิมพ์ใหม่..." />
 <datalist id="suggest-items">{suggestions.items.map(v => <option key={v} value={v} />)}</datalist>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">verified</span> สภาพ
 </label>
 <input title="Item Condition" list="suggest-conds" value={editItem.สภาพ} onChange={e => setEditItem({ ...editItem, สภาพ: e.target.value })} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="ใหม่ / มือสอง" />
 <datalist id="suggest-conds">{suggestions.conditions.map(v => <option key={v} value={v} />)}</datalist>
 </div>
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">straighten</span> ขนาด
 </label>
 <input title="Item Size" list="suggest-sizes" value={editItem.ขนาด} onChange={e => setEditItem({ ...editItem, ขนาด: e.target.value })} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white focus:border-primary/20 text-[14px]" placeholder="ระบุขนาด" />
 <datalist id="suggest-sizes">{suggestions.sizes.map(v => <option key={v} value={v} />)}</datalist>
 </div>
 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-primary uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">pin</span> จำนวนตั้งต้น
 </label>
 <input title="Item Quantity" type="number" value={editItem.จำนวน} onChange={e => setEditItem({ ...editItem, จำนวน: Number(e.target.value) })} className="w-full bg-slate-50/50 border border-primary/20 rounded-2xl px-5 py-3.5 font-black text-primary focus:bg-white text-[16px]" placeholder="0" />
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="text-[12px] font-black text-secondary/60 uppercase tracking-widest ml-1 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px]">notes</span> หมายเหตุ / รายละเอียด
 </label>
 <textarea title="Item Remark" rows={1} value={editItem.รายละเอียด} onChange={e => setEditItem({ ...editItem, รายละเอียด: e.target.value })} className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-secondary focus:bg-white resize-none text-[14px]" placeholder="ระบุข้อมูลเพิ่มเติม..." />
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
 <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 text-secondary/60 font-black rounded-2xl uppercase tracking-widest text-xs">ยกเลิก</button>
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
 );
};

export default SettingsItemForm;
