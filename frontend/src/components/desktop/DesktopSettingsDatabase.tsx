import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, Server, RefreshCw, Download, Upload, Trash2, 
  ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Save 
} from 'lucide-react';
import { API_URL } from '../../api';

interface Props {
  user?: any;
}

const DesktopSettingsDatabase: React.FC<Props> = ({ user }) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dbUrl, setDbUrl] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 5000);
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const token = user?.token || '';
      const res = await fetch(`${API_URL}/database/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatus(data);
      }
    } catch {
      showMessage('โหลดสถานะฐานข้อมูลไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!dbUrl) return showMessage('กรุณาระบุ Connection URL', 'error');
    setTesting(true);
    try {
      const token = user?.token || '';
      const res = await fetch(`${API_URL}/database/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: dbUrl }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        showMessage(data.message, 'success');
      } else {
        showMessage(data.message, 'error');
      }
    } catch (err: any) {
      showMessage(err.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!dbUrl) return showMessage('กรุณาระบุ Connection URL', 'error');
    if (!window.confirm('ยืนยันการเปลี่ยน Connection String? ระบบอาจต้องรีสตาร์ทเพื่อใช้ค่าใหม่')) return;
    
    setActionLoading('save');
    try {
      const token = user?.token || '';
      const res = await fetch(`${API_URL}/database/save-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: dbUrl }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        showMessage(data.message, 'success');
      } else {
        showMessage(data.message, 'error');
      }
    } catch (err: any) {
      showMessage(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBackup = async () => {
    setActionLoading('backup');
    try {
      const token = user?.token || '';
      const res = await fetch(`${API_URL}/database/backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'success') {
        const blob = new Blob([JSON.stringify(data.payload, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        a.click();
        showMessage('สำรองข้อมูลเรียบร้อยแล้ว');
      }
    } catch (err: any) {
      showMessage(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('คำเตือน: การนำเข้าข้อมูลจะลบข้อมูลปัจจุบันทั้งหมดและแทนที่ด้วยข้อมูลจากไฟล์! ยืนยันที่จะดำเนินการหรือไม่?')) {
      e.target.value = '';
      return;
    }

    setActionLoading('import');
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const backupData = JSON.parse(event.target?.result as string);
          const token = user?.token || '';
          const res = await fetch(`${API_URL}/database/import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ backupData }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            showMessage(data.message, 'success');
            loadStatus();
          } else {
            showMessage(data.message, 'error');
          }
        } catch {
          showMessage('ไฟล์ข้อมูลไม่ถูกต้อง', 'error');
        } finally {
          setActionLoading(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      showMessage(err.message, 'error');
      setActionLoading(null);
    }
  };

  const handleReset = async () => {
    const confirm1 = window.confirm('คำเตือน: นี่คือการล้างข้อมูลทางธุรกิจทั้งหมด (Transactions, Jobs, Customers)!');
    if (!confirm1) return;
    const confirm2 = window.confirm('คุณแน่ใจจริงๆ หรือไม่? ข้อมูลทั้งหมดจะถูกลบอย่างถาวร!');
    if (!confirm2) return;

    setActionLoading('reset');
    try {
      const token = user?.token || '';
      const res = await fetch(`${API_URL}/database/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'success') {
        showMessage(data.message, 'success');
        loadStatus();
      }
    } catch (err: any) {
      showMessage(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-black text-slate-900 leading-none">จัดการฐานข้อมูล</h2>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            ตั้งค่าการเชื่อมต่อ, สำรองข้อมูล และบำรุงรักษาฐานข้อมูลระบบ
          </p>
        </div>
        <button
          onClick={loadStatus}
          disabled={loading}
          className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Status Section */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Database size={18} strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-black text-slate-800">สถานะปัจจุบัน</h3>
            </div>

            <div className="space-y-4">
              {[
                { label: 'ผู้ใช้ทั้งหมด', value: status?.counts?.users ?? '—', color: 'text-indigo-600' },
                { label: 'พัสดุในคลัง', value: status?.counts?.items ?? '—', color: 'text-rose-600' },
                { label: 'ลูกค้า', value: status?.counts?.customers ?? '—', color: 'text-emerald-600' },
                { label: 'งานทั้งหมด', value: status?.counts?.jobs ?? '—', color: 'text-amber-600' },
                { label: 'ธุรกรรม', value: status?.counts?.transactions ?? '—', color: 'text-sky-600' },
              ].map(stat => (
                <div key={stat.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="text-[12px] font-bold text-slate-400">{stat.label}</span>
                  <span className={`text-[15px] font-black ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status?.db_url === 'Connected (Hidden)' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className={`text-[11px] font-black uppercase tracking-widest ${status?.db_url === 'Connected (Hidden)' ? 'text-slate-400' : 'text-rose-500'}`}>
                  {status?.db_url === 'Connected (Hidden)' ? 'PostgreSQL Connected' : 'Database Not Connected'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Connection Settings */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Server size={18} strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-black text-slate-800">การตั้งค่าการเชื่อมต่อ</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">DATABASE_URL</label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="password"
                    value={dbUrl}
                    onChange={e => setDbUrl(e.target.value)}
                    placeholder="postgresql://user:password@host:port/dbname"
                    className="flex-1 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-300 transition-all"
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || !dbUrl}
                    className="h-[50px] px-6 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[12px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {testing ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    ทดสอบ
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 ml-1">
                  ระบุ Connection String เพื่อเชื่อมต่อกับฐานข้อมูล PostgreSQL ตัวใหม่
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveConnection}
                  disabled={actionLoading === 'save' || !dbUrl}
                  className="h-11 px-8 rounded-xl bg-slate-900 text-white text-[12px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black disabled:opacity-50"
                >
                  <Save size={16} />
                  {actionLoading === 'save' ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </div>
          </section>

          {/* Backup & Maintenance */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <RefreshCw size={18} strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-black text-slate-800">การสำรองข้อมูล & บำรุงรักษา</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={handleBackup}
                disabled={actionLoading === 'backup'}
                className="h-20 rounded-2xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 flex flex-col items-center justify-center gap-1.5 transition-all group disabled:opacity-50"
              >
                <Download size={20} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">สำรองข้อมูล (Backup)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={actionLoading === 'import'}
                className="h-20 rounded-2xl border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 flex flex-col items-center justify-center gap-1.5 transition-all group disabled:opacity-50"
              >
                <Upload size={20} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-black text-indigo-700 uppercase tracking-widest">นำเข้าข้อมูล (Import)</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black text-rose-700 leading-tight">รีเซ็ตฐานข้อมูล (Reset)</h4>
                    <p className="text-[10px] text-rose-600 font-bold mt-0.5 opacity-70">
                      ลบข้อมูลรายการทั้งหมดออกจากระบบอย่างถาวร
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  disabled={actionLoading === 'reset'}
                  className="h-10 px-6 rounded-xl bg-white border border-rose-200 text-rose-600 text-[11px] font-black uppercase tracking-widest hover:bg-rose-50 disabled:opacity-50 transition-all"
                >
                  {actionLoading === 'reset' ? 'กำลังรีเซ็ต...' : 'ล้างข้อมูล'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {msg && (
        <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl text-[12px] font-bold shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {msg.text}
        </div>
      )}
    </div>
  );
};

export default DesktopSettingsDatabase;
