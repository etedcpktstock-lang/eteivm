import React, { useState, useEffect } from 'react';
import { Layout, Palette, Image as ImageIcon, Type, Sparkles, Eye, Save, Upload } from 'lucide-react';
import { API_URL } from '../../api';

interface Props {
  user?: any;
  settings?: any;
  onRefresh?: () => void;
}

const DesktopSettingsLogin: React.FC<Props> = ({ user, settings: appSettings, onRefresh }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'bg' | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (appSettings) {
      setSettings(appSettings);
    }
  }, [appSettings]);

  const showMessage = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleUpload = async (type: 'logo' | 'bg', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(type);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        const baseUrl = API_URL.replace(/\/api\/?$/, '');
        const fullUrl = `${baseUrl}${data.imageUrl}`;
        if (type === 'logo') {
          setSettings(prev => ({ ...prev, LOGIN_LOGO_URL: fullUrl }));
        } else {
          setSettings(prev => ({ ...prev, LOGIN_BG_URL: fullUrl }));
        }
        showMessage('อัปโหลดรูปภาพสำเร็จ');
      } else {
        showMessage('อัปโหลดไม่สำเร็จ: ' + data.message);
      }
    } catch (err: any) {
      showMessage('อัปโหลดไม่สำเร็จ: ' + err.message);
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = user?.token || '';
      await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });
      showMessage('บันทึกการตั้งค่าหน้า Login เรียบร้อย');
      onRefresh?.();
    } catch {
      showMessage('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const loginTitle = settings.LOGIN_TITLE || 'ยินดีต้อนรับกลับมา';
  const loginSubtitle = settings.LOGIN_SUBTITLE || 'กรุณาเข้าสู่ระบบเพื่อจัดการคลังพัสดุของคุณ';
  const loginPoweredBy = settings.LOGIN_POWERED_BY || 'Powered by ETE DC Phuket Team';
  const loginLogo = settings.LOGIN_LOGO_URL || '';
  const loginBg = settings.LOGIN_BG_URL || '';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-black text-slate-900 leading-none">ปรับแต่งหน้า Login</h2>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            กำหนดรูปภาพ ข้อความ และเอกลักษณ์ของหน้าเข้าสู่ระบบ
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-indigo-600 text-white text-[12px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Type size={18} strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-black text-slate-800">ข้อความต้อนรับ</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">หัวข้อหลัก (Title)</label>
                <input
                  type="text"
                  value={settings.LOGIN_TITLE || ''}
                  onChange={e => setSettings(prev => ({ ...prev, LOGIN_TITLE: e.target.value }))}
                  placeholder="ยินดีต้อนรับกลับมา"
                  className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-300 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">ข้อความบรรยาย (Subtitle)</label>
                <textarea
                  value={settings.LOGIN_SUBTITLE || ''}
                  onChange={e => setSettings(prev => ({ ...prev, LOGIN_SUBTITLE: e.target.value }))}
                  placeholder="กรุณาเข้าสู่ระบบเพื่อจัดการคลังพัสดุของคุณ"
                  rows={2}
                  className="w-full mt-1.5 rounded-2xl p-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-300 transition-all resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">เครดิต (Powered By)</label>
                <input
                  type="text"
                  value={settings.LOGIN_POWERED_BY || ''}
                  onChange={e => setSettings(prev => ({ ...prev, LOGIN_POWERED_BY: e.target.value }))}
                  placeholder="Powered by ETE DC Phuket Team"
                  className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-300 transition-all"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ImageIcon size={18} strokeWidth={2.5} />
              </div>
              <h3 className="text-[15px] font-black text-slate-800">รูปภาพ & พื้นหลัง</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">URL โลโก้</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={settings.LOGIN_LOGO_URL || ''}
                    onChange={e => setSettings(prev => ({ ...prev, LOGIN_LOGO_URL: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                    className="flex-1 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-rose-300 transition-all"
                  />
                  <input type="file" id="upload-logo" accept="image/*" className="hidden" onChange={e => handleUpload('logo', e)} />
                  <label htmlFor="upload-logo" className={`h-[50px] px-4 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[12px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 cursor-pointer transition-all ${uploading === 'logo' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload size={16} />
                    {uploading === 'logo' ? 'กำลังโหลด...' : 'อัปโหลด'}
                  </label>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1">หากไม่ระบุ จะใช้ไอคอนระบบเริ่มต้น</p>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">URL รูปพื้นหลัง</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={settings.LOGIN_BG_URL || ''}
                    onChange={e => setSettings(prev => ({ ...prev, LOGIN_BG_URL: e.target.value }))}
                    placeholder="https://example.com/background.jpg"
                    className="flex-1 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-rose-300 transition-all"
                  />
                  <input type="file" id="upload-bg" accept="image/*" className="hidden" onChange={e => handleUpload('bg', e)} />
                  <label htmlFor="upload-bg" className={`h-[50px] px-4 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[12px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 cursor-pointer transition-all ${uploading === 'bg' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload size={16} />
                    {uploading === 'bg' ? 'กำลังโหลด...' : 'อัปโหลด'}
                  </label>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1">รูปภาพพื้นหลังขนาดใหญ่ (แนะนำ 1920x1080)</p>
              </div>
            </div>
          </section>
        </div>

        {/* Live Preview */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 ml-1">
            <Eye size={14} className="text-slate-400" />
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">พรีวิว (Live Preview)</span>
          </div>
          
          <div className="relative rounded-[32px] border border-slate-200 bg-white overflow-hidden aspect-[9/16] max-w-[320px] mx-auto flex flex-col group shadow-inner shadow-slate-200">
            {/* Top Branding Section */}
            <div className="relative h-[45%] w-full flex flex-col items-center justify-center p-6"
                 style={loginBg ? { backgroundImage: `url(${loginBg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
            >
              <div className={`absolute inset-0 ${loginBg ? 'bg-slate-900/60 backdrop-blur-[2px]' : 'bg-gradient-to-br from-indigo-900 via-slate-900 to-black'}`} />
              
              <div className="relative z-10 w-16 h-16 rounded-[20px] overflow-hidden flex items-center justify-center bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.2)] mb-4">
                {loginLogo ? (
                  <img src={loginLogo} className="w-full h-full object-contain p-2 drop-shadow-md" alt="logo" />
                ) : (
                  <div className="text-white"><Sparkles size={24} /></div>
                )}
              </div>
              <h4 className="relative z-10 text-[16px] font-black text-white leading-tight drop-shadow-md text-center">{loginTitle}</h4>
              <p className="relative z-10 text-[9px] font-bold text-slate-200/90 mt-1.5 leading-relaxed text-center drop-shadow">
                {loginSubtitle}
              </p>
            </div>

            {/* Bottom Form Section */}
            <div className="relative flex-1 bg-white p-6 flex flex-col">
              <div className="w-full space-y-3 mt-2">
                <div className="h-[40px] bg-slate-50 border border-slate-200 rounded-xl" />
                <div className="h-[40px] bg-slate-50 border border-slate-200 rounded-xl" />
                <div className="h-[42px] bg-slate-900 rounded-xl mt-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.5)]" />
              </div>

              <div className="mt-auto flex flex-col items-center mb-2">
                <p className="text-[8px] font-black text-slate-400 tracking-[0.2em] text-center">
                  {loginPoweredBy}
                </p>
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[9px] font-black text-white uppercase tracking-widest border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
              Mobile App Layout
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <div className="fixed bottom-6 right-6 z-[100] bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-3 rounded-xl text-[12px] font-bold shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
          {msg}
        </div>
      )}
    </div>
  );
};

export default DesktopSettingsLogin;
