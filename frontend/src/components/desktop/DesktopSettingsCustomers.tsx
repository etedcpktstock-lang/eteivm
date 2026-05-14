import React, { useState, useEffect, useMemo, lazy, Suspense, useRef } from 'react';
import { getCustomers, deleteCustomer, API_URL } from '../../api';
import { Search, Plus, FileSpreadsheet, FileText, Phone, MapPin, Building2, ChevronDown, ChevronUp, Edit, Trash2, X, RotateCcw, Upload, Download, AlertTriangle, Maximize2 } from 'lucide-react';
import { exportJsonToExcel } from '../../utils/excel';
import { usePossession } from '../../hooks/usePossession';
import { SARABUN_REGULAR, SARABUN_BOLD } from '../../utils/pdfFonts';

const CustomerQuickEdit = lazy(() => import('../shared/CustomerQuickEdit'));

interface Props {
  onRefresh?: () => void;
  thaiAddressData?: any[];
  user?: any;
  logisticsJobs?: any[];
  transactions?: any[];
  items?: any[];
}

// ─── Possession Badge ───
const PossessionBadge: React.FC<{ cv: string; transactions: any[]; logisticsJobs: any[]; items: any[]; inventory?: any[] }> = ({ cv, transactions, logisticsJobs, items, inventory }) => {
  const possession = usePossession(transactions, cv, logisticsJobs, items, inventory);
  const [expanded, setExpanded] = useState(false);

  if (!possession || possession.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        ครอบครอง {possession.length} รายการ
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5 max-h-[200px] overflow-y-auto">
          {possession.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between bg-indigo-50/50 px-2.5 py-1.5 rounded-lg text-[11px]">
              <span className="font-bold text-slate-700 truncate max-w-[240px]">
                {p.name}{p.detail ? ` ${p.detail}` : ''}{p.size ? ` ขนาด ${p.size}` : ''}
              </span>
              <span className="font-black text-indigo-600 ml-2 shrink-0">×{p.qty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DesktopSettingsCustomers: React.FC<Props> = ({
  onRefresh, thaiAddressData = [], user, logisticsJobs = [], transactions = [], items = [],
}) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Modal state
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => { loadCustomers(); }, []);

  // ─── Column mapping for Excel import ───
  const COLUMN_MAP: Record<string, string> = {
    'cv code': 'cv',
    'ชื่อร้าน': 'name',
    'ทีอยู่ 1': 'address1',
    'ที่อยู่ 2': 'address2',
    'จังหวัด': 'province',
    'อำเภอ': 'district',
    'ตำบล': 'subdistrict',
    'ไปรษณีย์': 'zipcode',
    'Latitude': 'lat',
    'Longitude': 'lng',
    'ชือเปิดบัญชี': 'contact_name',
    'เบอร์โทร': 'phone',
    'โทรศัพท์': 'phone',
    'phone': 'phone',
    'รูป': 'image_url',
    'รูปภาพ': 'image_url',
    'รูปหน้าร้าน': 'image_url',
    'image_url': 'image_url',
  };

  // ─── Excel import handler ───
  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);
      const ws = workbook.worksheets[0];
      if (!ws) { showMessage('ไม่พบ sheet ในไฟล์'); return; }

      // Read headers
      const headers: string[] = [];
      ws.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '').trim();
      });

      // Map columns
      const colIndex: Record<string, number> = {};
      for (const [excelCol, eteField] of Object.entries(COLUMN_MAP)) {
        const idx = headers.findIndex(h => h === excelCol || h.toLowerCase() === excelCol.toLowerCase());
        if (idx >= 0) colIndex[eteField] = idx;
      }

      // Parse rows
      const rows: any[] = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const cv = colIndex['cv'] !== undefined ? String(row.getCell(colIndex['cv'] + 1).value ?? '').trim() : '';
        if (!cv) continue; // skip rows without CV

        const name = colIndex['name'] !== undefined ? String(row.getCell(colIndex['name'] + 1).value ?? '').trim() : '';
        if (!name) continue; // skip rows without name

        rows.push({
          cv,
          name,
          address: [
            colIndex['address1'] !== undefined ? String(row.getCell(colIndex['address1'] + 1).value ?? '').trim() : '',
            colIndex['address2'] !== undefined ? String(row.getCell(colIndex['address2'] + 1).value ?? '').trim() : '',
          ].filter(Boolean).join(' '),
          province: colIndex['province'] !== undefined ? String(row.getCell(colIndex['province'] + 1).value ?? '').trim() : '',
          district: colIndex['district'] !== undefined ? String(row.getCell(colIndex['district'] + 1).value ?? '').trim() : '',
          subdistrict: colIndex['subdistrict'] !== undefined ? String(row.getCell(colIndex['subdistrict'] + 1).value ?? '').trim() : '',
          zipcode: colIndex['zipcode'] !== undefined ? String(row.getCell(colIndex['zipcode'] + 1).value ?? '').trim() : '',
          lat: colIndex['lat'] !== undefined ? String(row.getCell(colIndex['lat'] + 1).value ?? '').trim() : '',
          lng: colIndex['lng'] !== undefined ? String(row.getCell(colIndex['lng'] + 1).value ?? '').trim() : '',
        });
      }

      setImportTotal(rows.length);
      setImportPreview(rows.slice(0, 8));
      setShowImportModal(true);
    } catch (err: any) {
      showMessage('อ่านไฟล์ไม่สำเร็จ: ' + (err.message || ''));
    } finally {
      // reset input for re-select
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportExecute = async () => {
    if (importTotal === 0) return;
    setImporting(true);
    try {
      // Re-parse the full file
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const buffer = await importFile!.arrayBuffer();
      await workbook.xlsx.load(buffer);
      const ws = workbook.worksheets[0];

      const headers: string[] = [];
      ws.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '').trim();
      });

      const colIndex: Record<string, number> = {};
      for (const [excelCol, eteField] of Object.entries(COLUMN_MAP)) {
        const idx = headers.findIndex(h => h === excelCol || h.toLowerCase() === excelCol.toLowerCase());
        if (idx >= 0) colIndex[eteField] = idx;
      }

      const allRows: any[] = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const cv = colIndex['cv'] !== undefined ? String(row.getCell(colIndex['cv'] + 1).value ?? '').trim() : '';
        if (!cv) continue;
        const name = colIndex['name'] !== undefined ? String(row.getCell(colIndex['name'] + 1).value ?? '').trim() : '';
        if (!name) continue;
        allRows.push({
          cv,
          name,
          address: [
            colIndex['address1'] !== undefined ? String(row.getCell(colIndex['address1'] + 1).value ?? '').trim() : '',
            colIndex['address2'] !== undefined ? String(row.getCell(colIndex['address2'] + 1).value ?? '').trim() : '',
          ].filter(Boolean).join(' '),
          province: colIndex['province'] !== undefined ? String(row.getCell(colIndex['province'] + 1).value ?? '').trim() : '',
          district: colIndex['district'] !== undefined ? String(row.getCell(colIndex['district'] + 1).value ?? '').trim() : '',
          subdistrict: colIndex['subdistrict'] !== undefined ? String(row.getCell(colIndex['subdistrict'] + 1).value ?? '').trim() : '',
          zipcode: colIndex['zipcode'] !== undefined ? String(row.getCell(colIndex['zipcode'] + 1).value ?? '').trim() : '',
          lat: colIndex['lat'] !== undefined ? String(row.getCell(colIndex['lat'] + 1).value ?? '').trim() : '',
          lng: colIndex['lng'] !== undefined ? String(row.getCell(colIndex['lng'] + 1).value ?? '').trim() : '',
        });
      }

      // Send in batches of 200
      const BATCH = 200;
      let totalCreated = 0, totalUpdated = 0;
      for (let i = 0; i < allRows.length; i += BATCH) {
        const batch = allRows.slice(i, i + BATCH);
        const token = user?.token || '';
        const res = await fetch(`${API_URL}/customers/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ customers: batch }),
        });
        const data = await res.json();
        if (data.status === 'success') {
          totalCreated += data.created || 0;
          totalUpdated += data.updated || 0;
        }
      }

      showMessage(`นำเข้าสำเร็จ: สร้างใหม่ ${totalCreated}, อัปเดต ${totalUpdated}`);
      setShowImportModal(false);
      setImportFile(null);
      loadCustomers();
      onRefresh?.();
    } catch (err: any) {
      showMessage('นำเข้าไม่สำเร็จ: ' + (err.message || ''));
    } finally {
      setImporting(false);
    }
  };

  const showMessage = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await getCustomers(true);
      setCustomers(Array.isArray(data) ? data : []);
    } catch { showMessage('โหลดข้อมูลลูกค้าไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  // ─── Filtering ───
  const provinces = useMemo(() => {
    const set = new Set<string>();
    customers.forEach(c => { if (c.province) set.add(c.province); });
    return Array.from(set).sort();
  }, [customers]);

  const filtered = useMemo(() => {
    let list = customers;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        String(c.cv || '').toLowerCase().includes(s) ||
        String(c.name || '').toLowerCase().includes(s) ||
        String(c.phone || '').includes(s) ||
        String(c.address || '').toLowerCase().includes(s) ||
        String(c.province || '').toLowerCase().includes(s)
      );
    }
    if (provinceFilter) list = list.filter(c => c.province === provinceFilter);
    return list;
  }, [customers, search, provinceFilter]);

  // ─── Stats ───
  const stats = useMemo(() => ({
    total: customers.length,
    withPhone: customers.filter(c => c.phone).length,
    withLocation: customers.filter(c => c.lat && c.lng).length,
    provinces: new Set(customers.map(c => c.province).filter(Boolean)).size,
  }), [customers]);

  const clearFilters = () => { setSearch(''); setProvinceFilter(''); };

  // ─── Delete ───
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteCustomer(String(deleteTarget.rowIndex || deleteTarget.cv));
      showMessage('ลบลูกค้าแล้ว');
      setDeleteTarget(null);
      loadCustomers();
      onRefresh?.();
    } catch { showMessage('ลบไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const handleSaveDone = () => {
    setEditCustomer(null);
    setShowAddModal(false);
    loadCustomers();
    onRefresh?.();
  };

  // ─── Export ───
  const exportExcel = async () => {
    const data = filtered.map(c => ({
      'CV': c.cv,
      'ชื่อลูกค้า': c.name,
      'เบอร์โทร': c.phone || '',
      'จังหวัด': c.province || '',
      'อำเภอ': c.district || '',
      'ตำบล': c.subdistrict || '',
      'ที่อยู่': c.address || '',
      'Lat': c.lat || '',
      'Lng': c.lng || '',
    }));
    await exportJsonToExcel(data, 'Customers', 'Customer_Database.xlsx');
    showMessage('ส่งออก Excel แล้ว');
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      const doc = new (jsPDF as any)();
      
      doc.addFileToVFS('Sarabun-Regular.ttf', SARABUN_REGULAR);
      doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
      doc.setFont('Sarabun', 'normal');
      
      const tableData = filtered.map(c => [c.cv, c.name, c.phone || '-', c.province || '-']);
      doc.autoTable({ head: [['CV', 'ชื่อ', 'เบอร์โทร', 'จังหวัด']], body: tableData, styles: { font: 'Sarabun' } });
      doc.save('Customer_Database.pdf');
      showMessage('ส่งออก PDF แล้ว');
    } catch { showMessage('ส่งออก PDF ไม่สำเร็จ'); }
  };

  return (
    <div className="desktop-page">
      {/* ── Header ── */}
      <div className="desktop-toolbar">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <Building2 size={20} strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="text-[16px] font-black text-slate-900 leading-none">จัดการลูกค้า</h2>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">
              {stats.total} รายการ • {stats.provinces} จังหวัด
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-[11px] font-bold text-emerald-600">{msg}</span>}
          <button onClick={exportExcel} className="h-9 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-100 hover:bg-emerald-100">
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={exportPDF} className="h-9 px-3 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-rose-100 hover:bg-rose-100">
            <FileText size={14} /> PDF
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-11 px-5 rounded-xl bg-emerald-600 text-white text-[12px] font-black uppercase tracking-widest flex items-center gap-2"
          >
            <Plus size={16} strokeWidth={2.5} /> เพิ่มลูกค้า
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-11 px-5 rounded-xl bg-indigo-50 text-indigo-700 text-[12px] font-black uppercase tracking-widest flex items-center gap-2 border border-indigo-100 hover:bg-indigo-100"
          >
            <Upload size={16} strokeWidth={2.5} /> นำเข้า Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFilePick}
            className="hidden"
          />
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="px-6 pt-2 pb-1">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'ทั้งหมด', value: stats.total, icon: Building2, tone: 'bg-slate-50 text-slate-700 border-slate-100' },
            { label: 'มีเบอร์โทร', value: stats.withPhone, icon: Phone, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: 'มีพิกัด', value: stats.withLocation, icon: MapPin, tone: 'bg-sky-50 text-sky-700 border-sky-100' },
            { label: 'จังหวัด', value: stats.provinces, icon: MapPin, tone: 'bg-amber-50 text-amber-700 border-amber-100' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${s.tone}`}>
                <Icon size={16} strokeWidth={2.2} className="opacity-60" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider opacity-60">{s.label}</p>
                  <p className="text-[18px] font-black leading-none">{s.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Search + Filters ── */}
      <div className="px-6 py-3 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา CV / ชื่อ / เบอร์โทร / ที่อยู่..."
            className="w-full h-[44px] rounded-xl pl-10 pr-4 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-emerald-300 placeholder:text-slate-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-slate-200 text-slate-400 flex items-center justify-center">
              <X size={12} />
            </button>
          )}
        </div>
        <select
          value={provinceFilter}
          onChange={e => setProvinceFilter(e.target.value)}
          className="h-[44px] rounded-xl px-4 text-[12px] font-bold text-slate-600 bg-slate-50 border border-slate-200 outline-none cursor-pointer"
        >
          <option value="">ทุกจังหวัด</option>
          {provinces.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(search || provinceFilter) && (
          <button onClick={clearFilters} className="h-[44px] px-3 rounded-xl bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-slate-200">
            <RotateCcw size={13} /> ล้าง ({filtered.length})
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 size={48} className="mx-auto text-slate-200 mb-3" strokeWidth={1.5} />
            <p className="text-[13px] font-black text-slate-300 uppercase tracking-wider">
              {customers.length === 0 ? 'ไม่มีข้อมูลลูกค้า' : 'ไม่พบผลลัพธ์ที่ตรงกับตัวกรอง'}
            </p>
            {customers.length > 0 && (
              <button onClick={clearFilters} className="mt-3 h-9 px-4 rounded-xl bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-wider">
                ล้างตัวกรอง
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[52px]">รูป</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[80px]">CV</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อลูกค้า</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[130px]">เบอร์โทร</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[130px]">จังหวัด</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ที่อยู่</th>
                  <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[50px]">แผนที่</th>
                  <th className="text-center px-3 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[80px]">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any, i: number) => (
                  <tr key={c.cv || c.rowIndex || i} className="border-b border-slate-50 hover:bg-slate-50/50 group">
                    <td className="px-3 py-3">
                      {c.image_url ? (
                        <button
                          onClick={() => setPreviewImage({ url: c.image_url, name: c.name })}
                          className="relative w-9 h-9 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 mx-auto cursor-pointer group/img hover:ring-2 hover:ring-indigo-300"
                        >
                          <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 flex items-center justify-center transition-all">
                            <Maximize2 size={12} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ) : (
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 mx-auto">
                          <Building2 size={14} className="text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[12px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{c.cv || '-'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div>
                        <span className="text-[13px] font-bold text-slate-800">{c.name || '-'}</span>
                        {items.length > 0 && (
                          <PossessionBadge cv={c.cv} transactions={transactions} logisticsJobs={logisticsJobs} items={items} inventory={c.inventory} />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {c.phone ? (
                        <span className="text-[12px] font-bold text-emerald-600 flex items-center gap-1">
                          <Phone size={12} /> {c.phone}
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[12px] font-bold text-slate-600">{c.province || '-'}</td>
                    <td className="px-5 py-3 text-[12px] text-slate-500 max-w-[200px] truncate">
                      {[c.address, c.subdistrict, c.district].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="px-3 py-3">
                      {(() => {
                        const mapUrl = (c.lat != null && c.lng != null)
                          ? `https://www.google.com/maps?q=${c.lat},${c.lng}`
                          : `https://www.google.com/maps/search/${encodeURIComponent([c.name, c.address, c.subdistrict, c.district, c.province].filter(Boolean).join(' '))}`;
                        return (
                          <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-sky-50 hover:text-sky-600 flex items-center justify-center border border-slate-100 mx-auto"
                            title="เปิด Google Maps"
                          >
                            <MapPin size={14} />
                          </a>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditCustomer({ ...c, rowIndex: c.rowIndex ?? c.cv })}
                          className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center border border-slate-100"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center border border-slate-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit / Add Modal ── */}
      <Suspense fallback={null}>
        <CustomerQuickEdit
          isOpen={!!(editCustomer || showAddModal)}
          customer={editCustomer || {}}
          thaiAddressData={thaiAddressData}
          customers={customers}
          onSave={() => handleSaveDone()}
          onClose={() => { setEditCustomer(null); setShowAddModal(false); }}
        />
      </Suspense>

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm m-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-[16px] font-black text-slate-900">ยืนยันการลบ</h3>
            <p className="text-[13px] text-slate-500 mt-2">
              คุณแน่ใจที่จะลบ <strong>{deleteTarget.name || 'ลูกค้ารายนี้'}</strong> (CV: {deleteTarget.cv})?
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-[12px]">ยกเลิก</button>
              <button onClick={handleDelete} disabled={saving} className="flex-1 h-11 rounded-xl bg-rose-600 text-white font-black text-[12px] disabled:opacity-50">
                {saving ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Preview Modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowImportModal(false); setImportFile(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] m-4 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-black text-slate-900">ตัวอย่างข้อมูลนำเข้า</h3>
                <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                  {importTotal} รายการจาก {importFile?.name} — แสดง {importPreview.length} รายการแรก
                </p>
              </div>
              <button onClick={() => { setShowImportModal(false); setImportFile(null); }} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-black text-amber-800">การนำเข้าจะทำการ Upsert</p>
                  <p className="text-[11px] text-amber-700 mt-1">CV ที่มีอยู่แล้วจะถูกอัปเดต CV ใหม่จะถูกสร้าง — ข้อมูลเดิมจะไม่ถูกลบ</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">CV</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อ</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">จังหวัด</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">อำเภอ</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">พิกัด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="px-4 py-2 text-[12px] font-bold text-indigo-600">{row.cv}</td>
                        <td className="px-4 py-2 text-[12px] font-bold text-slate-700">{row.name}</td>
                        <td className="px-4 py-2 text-[12px] text-slate-600">{row.province || '-'}</td>
                        <td className="px-4 py-2 text-[12px] text-slate-500">{row.district || '-'}</td>
                        <td className="px-4 py-2 text-[11px] text-slate-400">{row.lat ? `${row.lat}, ${row.lng}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
                className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-[12px]"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleImportExecute}
                disabled={importing}
                className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download size={16} />
                {importing ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า ${importTotal} รายการ`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Image Lightbox ─── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            <X size={20} />
          </button>
          <div className="text-center max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain"
            />
            <p className="mt-4 text-white/80 text-[14px] font-bold">{previewImage.name}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopSettingsCustomers;
