import React, { useState, useEffect, useRef } from 'react';
import { saveCustomer } from '../../api';
import MapPickerModal from '../MapPickerModal';

interface CustomerQuickEditProps {
 isOpen: boolean;
 onClose: () => void;
 customer: any;
 onSave: (savedData?: any) => void;
 thaiAddressData: any[];
 customers: any[];
}

const CustomerQuickEdit: React.FC<CustomerQuickEditProps> = ({ 
 isOpen, onClose, customer, onSave, thaiAddressData, customers 
}) => {
 const [editingCustomer, setEditingCustomer] = useState<any>({ cv: '', name: '', phone: '', address: '', subdistrict: '', district: '', province: '', zipcode: '', lat: '', lng: '', image_url: '' });
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [loading, setLoading] = useState(false);
 const [districts, setDistricts] = useState<string[]>([]);
 const [subdistricts, setSubdistricts] = useState<any[]>([]);
 const [showMapPicker, setShowMapPicker] = useState(false);
 const prevOpenRef = useRef(false);

 useEffect(() => {
 if (showMapPicker && !(window as any).L) {
 const link = document.createElement('link');
 link.rel = 'stylesheet';
 link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
 document.head.appendChild(link);
 const script = document.createElement('script');
 script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
 document.head.appendChild(script);
 }
 }, [showMapPicker]);

 useEffect(() => {
 if (isOpen && !prevOpenRef.current) {
 let initialCv = customer?.cv || '';
 if (!initialCv && customers.length > 0) {
 initialCv = calculateNextCv();
 } else if (!initialCv) {
 initialCv = '1001';
 }
 
 const newEditData = { ...customer, cv: initialCv };
 setEditingCustomer(newEditData);

 if (thaiAddressData.length > 0 && newEditData.province) {
 const p = thaiAddressData.find(prov => prov.name_th === newEditData.province);
 if (p) {
 setDistricts(p.amphure.map((a: any) => a.name_th).sort());
 if (newEditData.district) {
 const a = p.amphure.find((amp: any) => amp.name_th === newEditData.district);
 if (a) setSubdistricts(a.tambon.sort((x: any, y: any) => (x.name_th || '').localeCompare(y.name_th || '')));
 }
 }
 }
 }
 prevOpenRef.current = isOpen;
 }, [isOpen, customer, thaiAddressData, customers]);

 const handleProvinceChange = (pName: string) => {
 const p = thaiAddressData.find((prov: any) => prov.name_th === pName);
 setEditingCustomer((prev: any) => ({ ...prev, province: pName, district: '', subdistrict: '', zipcode: '' }));
 if (p) setDistricts(p.amphure.map((a: any) => a.name_th).sort()); else setDistricts([]);
 setSubdistricts([]);
 };

 const handleDistrictChange = (dName: string) => {
 const p = thaiAddressData.find((prov: any) => prov.name_th === editingCustomer.province);
 setEditingCustomer((prev: any) => ({ ...prev, district: dName, subdistrict: '', zipcode: '' }));
 if (p) {
 const a = p.amphure.find((amp: any) => amp.name_th === dName);
 if (a) setSubdistricts(a.tambon.sort((x: any, y: any) => (x.name_th||'').localeCompare(y.name_th||''))); else setSubdistricts([]);
 }
 };

 const handleTambonChange = (tName: string) => {
 const t = subdistricts.find(tam => tam.name_th === tName);
 setEditingCustomer((prev: any) => ({ ...prev, subdistrict: tName, zipcode: t ? String(t.zip_code || t.zipcode || '') : '' }));
 };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 if (file.size > 2 * 1024 * 1024) {
 alert("Image size must be less than 2MB");
 return;
 }
 const reader = new FileReader();
 reader.onloadend = () => {
 setEditingCustomer((prev: any) => ({ ...prev, image_url: reader.result as string }));
 };
 reader.readAsDataURL(file);
 }
 };

 const removePhoto = () => {
 setEditingCustomer((prev: any) => ({ ...prev, image_url: '' }));
 if (fileInputRef.current) fileInputRef.current.value = '';
 };

 const isCvDuplicate = React.useMemo(() => {
 if (!editingCustomer.cv || !customers) return false;
 return customers.some((c: any) => 
 String(c.cv || c.CV || '').trim() === String(editingCustomer.cv).trim() && 
 (customer?.name ? (c.name !== customer.name) : true)
 );
 }, [editingCustomer.cv, customers, customer?.name]);

 const handleSave = async () => {
 if (!editingCustomer.name || isCvDuplicate) return;
 setLoading(true);
 try {
 await saveCustomer(editingCustomer);
 onSave(editingCustomer);
 onClose();
 } catch (e: any) { alert(e.message); }
 finally { setLoading(false); }
 };

 const calculateNextCv = () => {
 if (!customers || customers.length === 0) return 'A100001';

 // Parse all CVs into components: prefix and number
 const parsedCvs = customers.map(c => {
 const val = String(c.cv || c.CV || '').trim();
 if (!val) return null;
 
 // Matches a prefix (letters) and a numeric part (digits)
 const match = val.match(/^([a-zA-Z]*)(\d+)$/);
 if (match) {
 return {
 prefix: match[1],
 num: parseInt(match[2]),
 originalNumStr: match[2]
 };
 }
 return null;
 }).filter(p => p !== null);

 if (parsedCvs.length === 0) {
 // Fallback if no patterns matched
 return 'A100001';
 }

 // Attempt to find the highest number within the preferred "A" prefix pattern
 const aPattern = parsedCvs.filter(p => p!.prefix.toUpperCase() === 'A');
 
 // Pick the target pattern to increment: 
 // Priority 1: Prefix "A" (most common based on user request)
 // Priority 2: Whatever has the highest numeric value
 const target = aPattern.length > 0 
 ? aPattern.sort((a, b) => b!.num - a!.num)[0]
 : parsedCvs.sort((a, b) => b!.num - a!.num)[0];

 if (!target) return 'A100001';

 const nextNum = target.num + 1;
 // Maintain the same number of digits (padding with zeros)
 const nextNumStr = nextNum.toString().padStart(target.originalNumStr.length, '0');
 
 return target.prefix + nextNumStr;
 };

 if (!isOpen) return null;

 const inputClass = "w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[14px] font-bold text-slate-900 outline-none focus:border-primary/20 focus:bg-white placeholder:text-slate-300";
 const labelClass = "text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1 mb-1.5 block";

 return (
 <>
 <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 bg-black/60 ">
 <div className="bg-white w-full max-w-3xl rounded-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] m-2">
 {/* Header - Navy Standard */}
 <div className="bg-[#0b1b32] px-6 py-8 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
 <div className="flex items-center gap-4 relative z-10">
 <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20">
 <span className="material-symbols-outlined text-[28px]">assignment_ind</span>
 </div>
 <div className="flex flex-col">
 <h3 className="text-[20px] font-black tracking-tight leading-none uppercase">ข้อมูลลูกค้า (CV)</h3>
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 opacity-60">Customer Management</p>
 </div>
 </div>
 <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center relative z-10">
 <span className="material-symbols-outlined text-[20px]">close</span>
 </button>
 </div>

 <div className="overflow-y-auto scrollbar-hide bg-white flex-1">
 {/* Shop Photo Section - Bleed Layout */}
 <div className="flex flex-col items-center justify-center mb-6">
 <div className="w-full px-6 md:px-8 mt-6 mb-2">
 <label className={labelClass + " !ml-0"}>รูปหน้าร้าน (Shop Photo)</label>
 </div>
 <div className="relative group w-full aspect-[16/9] sm:aspect-[21/9] bg-slate-50 border-y border-slate-200 overflow-hidden flex items-center justify-center ">
 {editingCustomer.image_url ? (
 <>
 <img 
 src={editingCustomer.image_url} 
 alt="Shop" 
 className="w-full h-full object-cover"
 />
 <div className="absolute inset-0 bg-black/40 opacity-0 flex items-center justify-center gap-3">
 <button 
 onClick={() => fileInputRef.current?.click()}
 className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-900 "
 title="Change Photo"
 >
 <span className="material-symbols-outlined text-[20px]">edit</span>
 </button>
 <button 
 onClick={removePhoto}
 className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center text-white "
 title="Remove Photo"
 >
 <span className="material-symbols-outlined text-[20px]">delete</span>
 </button>
 </div>
 </>
 ) : (
 <button 
 onClick={() => fileInputRef.current?.click()}
 className="flex flex-col items-center gap-2 text-slate-400 "
 >
 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 ">
 <span className="material-symbols-outlined text-[32px]">add_a_photo</span>
 </div>
 <span className="text-[11px] font-black uppercase tracking-widest">คลิกเพื่อถ่ายรูป / อัปโหลด</span>
 </button>
 )}
 <input 
 type="file" 
 ref={fileInputRef} 
 className="hidden" 
 accept="image/*" 
 capture="environment"
 onChange={handleFileChange} 
 />
 </div>
 </div>

 <div className="px-6 md:px-8 pb-8 space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
 <div>
 <label className={labelClass}>เลข CV {isCvDuplicate && <span className="text-rose-500 font-black">(ซ้ำ)</span>}</label>
 <input 
 className={inputClass} 
 value={editingCustomer.cv} 
 onChange={(e) => setEditingCustomer((p:any) => ({...p, cv: e.target.value}))} 
 placeholder="รหัส CV..." 
 title="CV number"
 />
 </div>
 <div>
 <label className={labelClass}>เบอร์โทรศัพท์</label>
 <input 
 className={inputClass} 
 value={editingCustomer.phone} 
 maxLength={10} 
 onChange={(e) => setEditingCustomer((p:any) => ({...p, phone: e.target.value.replace(/\D/g, '')}))} 
 placeholder="08x-xxx-xxxx" 
 title="Phone number"
 />
 </div>

 <div className="col-span-2">
 <label className={labelClass}>ชื่อลูกค้า / ชื่อร้าน <span className="text-rose-500 font-black">*</span></label>
 <input 
 className={inputClass} 
 value={editingCustomer.name} 
 onChange={(e) => setEditingCustomer((p:any) => ({...p, name: e.target.value}))} 
 placeholder="ระบุชื่อจริงหรือชื่อร้าน..." 
 title="Customer name"
 />
 </div>

 <div className="col-span-2">
 <label className={labelClass}>ที่อยู่</label>
 <textarea 
 rows={2} 
 className={`${inputClass} h-auto py-3 resize-none leading-relaxed min-h-[80px]`}
 value={editingCustomer.address} 
 onChange={(e) => setEditingCustomer((p:any) => ({...p, address: e.target.value}))} 
 placeholder="ระบุบ้านเลขที่, ถนน, ซอย..." 
 title="Address detail"
 />
 </div>

 <div>
 <label className={labelClass}>จังหวัด</label>
 <div className="relative">
 <select title="Province" className={`${inputClass} appearance-none`} value={editingCustomer.province} onChange={(e) => handleProvinceChange(e.target.value)}>
 <option value="">-- จังหวัด --</option>
 {thaiAddressData.map(p => <option key={p.name_th} value={p.name_th}>{p.name_th}</option>)}
 </select>
 <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">expand_more</span>
 </div>
 </div>
 <div>
 <label className={labelClass}>อำเภอ</label>
 <div className="relative">
 <select title="District" className={`${inputClass} appearance-none`} value={editingCustomer.district} onChange={(e) => handleDistrictChange(e.target.value)} disabled={!editingCustomer.province}>
 <option value="">-- อำเภอ --</option>
 {districts.map(d => <option key={d} value={d}>{d}</option>)}
 </select>
 <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">expand_more</span>
 </div>
 </div>
 <div>
 <label className={labelClass}>ตำบล</label>
 <div className="relative">
 <select title="Subdistrict" className={`${inputClass} appearance-none`} value={editingCustomer.subdistrict} onChange={(e) => handleTambonChange(e.target.value)} disabled={!editingCustomer.district}>
 <option value="">-- ตำบล --</option>
 {subdistricts.map((t: any) => <option key={t.name_th} value={t.name_th}>{t.name_th}</option>)}
 </select>
 <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">expand_more</span>
 </div>
 </div>
 <div>
 <label className={labelClass}>รหัสไปรษณีย์</label>
 <input title="Zipcode" className={`${inputClass} opacity-60 cursor-not-allowed`} value={editingCustomer.zipcode || ''} readOnly placeholder="00000" />
 </div>
 </div>

 <div className="pt-2">
 <button title="Open Map Picker" onClick={() => setShowMapPicker(true)} className="w-full h-12 bg-blue-50 text-blue-600 rounded-xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-blue-100 ">
 <span className="material-symbols-outlined text-[20px]">map</span> ใส่พิกัดแผนที่ร้านค้า
 </button>
 </div>

 <div className="pt-4 shrink-0 pb-2">
 <button 
 onClick={handleSave} 
 disabled={loading || !editingCustomer.name || isCvDuplicate} 
 className={`w-full h-16 rounded-2xl text-[15px] font-black uppercase tracking-[0.1em] flex items-center justify-center gap-3 ${
 loading || !editingCustomer.name || isCvDuplicate
 ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
 : 'bg-[#0b1b32] text-white ]'
 }`}
 >
 {loading ? (
 <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full "></div>
 ) : (
 <>
 <span className="material-symbols-outlined text-[22px]">save</span>
 ยืนยันและบันทึกข้อมูลลูกค้า
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>

 {showMapPicker && (
 <MapPickerModal 
 initialLat={parseFloat(editingCustomer.lat) || 13.7563} 
 initialLng={parseFloat(editingCustomer.lng) || 100.5018} 
 suggestedAddress={editingCustomer.province || ''}
 onClose={() => setShowMapPicker(false)}
 onSelect={(lt: number, ln: number) => {
 setEditingCustomer((p: any) => ({ ...p, lat: lt.toFixed(6), lng: ln.toFixed(6) }));
 setShowMapPicker(false);
 }}
 />
 )}
 </>
 );
};

export default React.memo(CustomerQuickEdit);
