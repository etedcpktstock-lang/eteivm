import React, { useState, useEffect } from 'react';
import { getWarehouses, saveWarehouse, deleteWarehouse, saveSettings } from '../../api';
import MapPickerModal from '../MapPickerModal';

interface SettingsWarehousesProps {
 settings: any;
 setSettings: (settings: any) => void;
 onRefresh: () => void;
}

const SettingsWarehouses: React.FC<SettingsWarehousesProps> = ({ 
 settings, 
 setSettings,
 onRefresh 
}) => {
 const [warehouses, setWarehouses] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [isEditing, setIsEditing] = useState(false);
 const [form, setForm] = useState({ 
 id: null as number | null, 
 name: '', 
 latitude: null as number | null, 
 longitude: null as number | null 
 });
 const [success, setSuccess] = useState<string | null>(null);
 const [showMapPicker, setShowMapPicker] = useState(false);
 const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

 const mainWhId = settings?.MAIN_WAREHOUSE_ID ? parseInt(settings.MAIN_WAREHOUSE_ID) : null;

 const loadData = async () => {
 setLoading(true);
 try {
 const data = await getWarehouses(true);
 setWarehouses(data || []);
 } catch (e) { console.error(e); }
 finally { setLoading(false); }
 };

 useEffect(() => {
 loadData();
 }, []);

 const handleSave = async () => {
 const nameStr = (form.name || '').trim();
 if (!nameStr) return;
 
 setLoading(true);
 try {
 await saveWarehouse({ 
 id: form.id, 
 name: nameStr,
 latitude: form.latitude,
 longitude: form.longitude
 });
 await loadData();
 setIsEditing(false);
 setForm({ id: null, name: '', latitude: null, longitude: null });
 setSuccess('บันทึกข้อมูลเรียบร้อยแล้ว');
 setTimeout(() => setSuccess(null), 3000);
 if (onRefresh) onRefresh();
 } catch (e: any) { alert(e.message); }
 finally { setLoading(false); }
 };

 const handleDelete = async (id: number) => {
 try {
 const targetMainWhId = settings?.MAIN_WAREHOUSE_ID ? parseInt(settings.MAIN_WAREHOUSE_ID) : null;
 let mainWh = warehouses.find(w => w.id === targetMainWhId) || warehouses.find(w => w.id !== id) || warehouses[0];
 
 if (!mainWh) {
 alert('ไม่สามารถลบคลังสุดท้ายได้');
 return;
 }

 setLoading(true);
 await deleteWarehouse(id);
 await loadData();
 setSuccess('ลบคลังและโอนย้ายสินค้าเรียบร้อยแล้ว');
 setConfirmDeleteId(null);
 setTimeout(() => setSuccess(null), 3000);
 if (onRefresh) onRefresh();
 } catch (e: any) { 
 console.error('Delete error:', e);
 alert('เกิดข้อผิดพลาดในการลบ: ' + e.message); 
 } finally { 
 setLoading(false); 
 }
 };

 const markAsMain = async (id: number) => {
 setLoading(true);
 try {
 const newSettings = { ...settings, MAIN_WAREHOUSE_ID: String(id) };
 await saveSettings(newSettings);
 setSettings(newSettings);
 setSuccess('กำหนดสำนักงานใหญ่เรียบร้อยแล้ว');
 setTimeout(() => setSuccess(null), 3000);
 if (onRefresh) onRefresh();
 } catch (e: any) { alert(e.message); }
 finally { setLoading(false); }
 };

 return (
 <div className="space-y-8 fade-in slide-in- ">
 <div className="flex items-center justify-between">
 <div className="text-left">
 <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
 <span className="material-symbols-outlined text-indigo-500">warehouse</span> จัดการคลังสินค้า (Sub DC)
 </h3>
 <p className="text-[12px] font-bold text-slate-400 mt-1 uppercase tracking-widest text-left">Manage Warehouse Locations & Inventory Migration</p>
 </div>
 {!isEditing && (
 <button 
 onClick={() => {
 setForm({ id: null, name: '', latitude: null, longitude: null });
 setIsEditing(true);
 }}
 className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest"
 >
 <span className="material-symbols-outlined">add_circle</span> เพิ่มคลังใหม่
 </button>
 )}
 </div>

 {success && (
 <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex items-center gap-3 text-emerald-600 zoom-in-95">
 <span className="material-symbols-outlined">check_circle</span>
 <span className="text-[14px] font-black">{success}</span>
 </div>
 )}

 {isEditing && (
 <div className="bg-white p-8 rounded-[2rem] border border-slate-100 space-y-6 zoom-in-95 text-left">
 <div className="space-y-2">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">ชื่อคลังสินค้า / จังหวัด</label>
 <input 
 className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-[16px] font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100"
 placeholder="ระบุชื่อคลัง..."
 value={form.name}
 onChange={e => setForm({ ...form, name: e.target.value })}
 autoFocus
 />
 </div>
 <div className="pt-2">
 <button 
 onClick={() => setShowMapPicker(true)}
 className="w-full h-14 bg-indigo-50 text-indigo-600 rounded-2xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-3 border border-indigo-100 "
 >
 <span className="material-symbols-outlined">location_on</span> {form.latitude ? `พิกัด: ${form.latitude.toFixed(4)}, ${form.longitude?.toFixed(4)}` : 'ปักหมุดแผนที่คลังสินค้า'}
 </button>
 </div>

 <div className="flex gap-4 pt-4">
 <button 
 onClick={handleSave}
 disabled={loading}
 className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black text-[14px] uppercase tracking-widest disabled:opacity-50"
 >
 {loading ? 'Processing...' : 'บันทึกข้อมูลคลัง'}
 </button>
 <button 
 onClick={() => { setIsEditing(false); setForm({ id: null, name: '', latitude: null, longitude: null }); }}
 className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl font-black text-[13px] uppercase tracking-widest"
 >
 ยกเลิก
 </button>
 </div>
 </div>
 )}

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

 <div className="grid grid-cols-1 gap-6">
 {warehouses.map((wh) => {
 const isMain = mainWhId === wh.id;
 return (
 <div 
 key={wh.id} 
 className={`group bg-white border rounded-[2.5rem] p-8 flex items-center justify-between ${isMain ? 'border-indigo-100 ' : 'border-slate-50'}`}
 >
 <div className="flex items-center gap-6 text-left">
 <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${
 isMain 
 ? 'bg-indigo-600 text-white )]' 
 : wh.latitude != null 
 ? 'bg-emerald-500 text-white '
 : 'bg-slate-50 text-slate-300 '
 }`}>
 <span className="material-symbols-outlined text-[32px]">location_on</span>
 </div>
 <div className="text-left">
 <div className="flex items-center gap-3">
              <h4 className="text-base font-bold text-slate-900 tracking-tight">{wh.name}</h4>
 {isMain && (
 <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-100">Main Office</span>
 )}
 </div>
 <div className="flex flex-col gap-1.5 mt-2">
 <p className="text-[13px] font-bold text-slate-400 flex items-center gap-2">
 <span className="material-symbols-outlined text-[16px] text-slate-300">sync_alt</span> 
 {isMain ? 'ระบบโอนย้ายพัสดุศูนย์กลาง' : `โอนย้ายไปยัง ${warehouses.find(w => w.id === mainWhId)?.name || 'คลังหลัก'} เมื่อระบบถูกยุบ`}
 </p>
 {wh.latitude != null && (
 <p className="text-[10px] font-black text-indigo-600 flex items-center gap-1.5 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-xl w-fit">
 <span className="material-symbols-outlined text-[14px]">map</span> GPS: {Number(wh.latitude).toFixed(5)}, {Number(wh.longitude).toFixed(5)}
 </p>
 )}
 </div>
 </div>
 </div>

 {confirmDeleteId === wh.id ? (
 <div className="flex items-center gap-3 bg-rose-50 p-2 rounded-[1.5rem] border border-rose-100 fade-in slide-in-">
 <span className="text-[11px] font-black text-rose-600 px-3 uppercase tracking-widest">Confirm Delete?</span>
 <button 
 onClick={() => handleDelete(wh.id)}
 className="px-6 py-3 bg-rose-600 text-white rounded-xl font-black text-[12px] uppercase tracking-widest"
 >
 Delete
 </button>
 <button 
 onClick={() => setConfirmDeleteId(null)}
 className="px-6 py-3 bg-white border border-slate-200 text-slate-400 rounded-xl font-black text-[12px] uppercase tracking-widest"
 >
 Cancel
 </button>
 </div>
 ) : (
 <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
 {!isMain && (
 <button 
 onClick={() => markAsMain(wh.id)}
 className="px-6 py-3 bg-white border border-indigo-100 text-indigo-600 rounded-xl font-black text-[11px] uppercase tracking-widest"
 >
 SET AS HEAD OFFICE
 </button>
 )}
 <button 
 onClick={() => { 
 setForm({ 
 id: wh.id, 
 name: wh.name, 
 latitude: wh.latitude, 
 longitude: wh.longitude 
 }); 
 setIsEditing(true); 
 }}
 className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-300 rounded-2xl "
 >
 <span className="material-symbols-outlined text-[20px]">edit</span>
 </button>
 <button 
 onClick={() => setConfirmDeleteId(wh.id)}
 className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-300 rounded-2xl "
 >
 <span className="material-symbols-outlined text-[20px]">delete</span>
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>

 <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2.5rem] flex items-start gap-5 text-left">
 <span className="material-symbols-outlined text-amber-500 shrink-0 mt-1 text-[24px]">warning</span>
 <div>
 <h5 className="text-[15px] font-black text-amber-800 uppercase tracking-tight">ข้อควรระวังสำคัญ (Warning)</h5>
 <p className="text-[13px] font-bold text-amber-700/70 leading-relaxed mt-2">
 การลบคลังสินค้าจะเป็นการ "ยุบรวม" พัสดุคงเหลือในคลังเข้ากับคลังหลัก (Head Office) ทันที 
 เพื่อให้ระบบคลังยังคงมีความสมดุลของสต็อกรวมที่ถูกต้องแม่นยำที่สุด
 </p>
 </div>
 </div>
 </div>
 );
};

export default SettingsWarehouses;
