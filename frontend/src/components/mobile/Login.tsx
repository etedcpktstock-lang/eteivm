import { useState, useEffect, type FormEvent } from 'react';
import { login, API_URL } from '../../api';
import { InlineSpinner } from '../shared/CommonUI';
import type { User } from '../../types';
import developerLogo from '../../assets/hero.png';
import { Sparkles, User as UserIcon, Lock, LogIn } from 'lucide-react';

interface LoginProps {
 onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [pubSettings, setPubSettings] = useState<any>(null);

  useEffect(() => {
   fetch(`${API_URL}/auth/public-settings`, {
     cache: 'no-store',
     headers: {
       'Pragma': 'no-cache',
       'Cache-Control': 'no-cache, no-store, must-revalidate'
     }
   })
    .then(r => r.json())
    .then(d => {
     if (d.status === 'success') setPubSettings(d.settings);
    })
    .catch(e => console.error("Public settings fetch failed", e));
  }, []);

 const handleSubmit = async (e: FormEvent) => {
 e.preventDefault();
 if (!username.trim() || !password.trim()) {
 setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
 return;
 }
 
 setLoading(true);
 setError('');
 
 try {
 // 1. Get Device Info (IP & UserAgent)
 let ip = 'Unknown';
 try {
 const ipRes = await fetch('https://api.ipify.org?format=json');
 const ipData = await ipRes.json();
 ip = ipData.ip;
 } catch (e) { console.error("IP Fetch Error", e); }

 const ua = navigator.userAgent;

 // 2. Try to get Location (Non-blocking)
 let loc = 'Not Allowed';
 const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
 navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
 });

 try {
 const pos = await getPosition();
 loc =`${pos.coords.latitude},${pos.coords.longitude}`;
 } catch (e) { console.warn("Location Access Denied or Timeout"); }

 const deviceInfo = { ip, loc, ua };

 // 3. Login with Device Info
 const res = await login(username, password, deviceInfo);
 if (res.status === 'success' && res.user) {
 onLogin(res.user);
 } else {
 setError(res.message || 'รหัสผ่านหรือชื่อผู้ใช้ไม่ถูกต้อง');
 }
 } catch (err: any) {
 setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
 } finally {
 setLoading(false);
 }
 };

 const loginTitle = pubSettings?.LOGIN_TITLE || 'เข้าสู่ระบบคลังพัสดุ';
 const loginSubtitle = pubSettings?.LOGIN_SUBTITLE || 'ETEIVM • ใช้งานบนมือถือได้ต่อเนื่อง';
 const loginLogo = pubSettings?.LOGIN_LOGO_URL || '';
 const loginBg = pubSettings?.LOGIN_BG_URL || '';

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* Left Panel - Branding */}
      <div 
        className="relative flex-1 lg:flex-[1.2] flex flex-col justify-center items-center p-8 lg:p-16 overflow-hidden min-h-[35vh] lg:min-h-screen shadow-2xl z-10"
        style={loginBg ? {
          backgroundImage: `url(${loginBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : {}}
      >
        {/* Abstract Gradient Fallback or Dark Overlay */}
        <div className={`absolute inset-0 ${loginBg ? 'bg-slate-900/60 backdrop-blur-[2px]' : 'bg-gradient-to-br from-indigo-900 via-slate-900 to-black'}`} />
        
        {/* Dynamic decorative elements if no bg */}
        {!loginBg && (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/20 blur-[120px] rounded-full mix-blend-screen" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-500/20 blur-[120px] rounded-full mix-blend-screen" />
          </>
        )}

        <div className="relative z-10 w-full max-w-xl flex flex-col items-center lg:items-start text-center lg:text-left text-white mt-auto lg:mt-0 lg:mb-auto">
          <div className="w-20 h-20 lg:w-28 lg:h-28 rounded-[32px] overflow-hidden flex items-center justify-center bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] mb-8 lg:mb-10 transition-transform hover:scale-105 duration-500">
            {loginLogo ? (
              <img src={loginLogo} alt="Logo" className="w-full h-full object-contain p-4 drop-shadow-xl" />
            ) : (
              <div className="text-white">
                <Sparkles size={48} strokeWidth={1.5} />
              </div>
            )}
          </div>
          
          <h1 className="text-3xl lg:text-5xl xl:text-6xl font-black tracking-tight mb-4 lg:mb-6 leading-[1.1] drop-shadow-md">
            {loginTitle}
          </h1>
          <p className="text-[13px] lg:text-base font-medium text-slate-200/90 max-w-md leading-relaxed drop-shadow">
            {loginSubtitle}
          </p>
        </div>

        {/* Powered By at bottom left on Desktop */}
        <div className="relative z-10 w-full max-w-xl mt-auto hidden lg:block">
          <p className="text-[11px] font-black text-white/50 tracking-[0.25em]">
            {pubSettings?.LOGIN_POWERED_BY || 'Powered by ETE DC Phuket Team'}
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 bg-white relative z-0">
        <div className="w-full max-w-[400px]">
          
          <div className="mb-10 text-center lg:text-left lg:hidden">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">เข้าสู่ระบบ</h2>
          </div>
          
          <div className="hidden lg:block mb-12">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">เข้าสู่ระบบ</h2>
            <p className="text-[14px] font-bold text-slate-500 mt-2">กรุณากรอกข้อมูลเพื่อเข้าสู่ระบบบริหารจัดการ</p>
          </div>

          {error && (
            <div className="alert alert-error rounded-2xl mb-8 text-[13px] font-bold border border-rose-200 bg-rose-50 text-rose-700 p-4 animate-in fade-in slide-in-from-top-2">
              <span className="material-symbols-outlined text-[20px]">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">ชื่อผู้ใช้</label>
              <div className="relative group">
                <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-[56px] rounded-2xl border border-slate-200 bg-slate-50/50 pl-[56px] pr-5 text-[14px] font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 placeholder:font-medium"
                  placeholder="กรอกชื่อผู้ใช้"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">รหัสผ่าน</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[56px] rounded-2xl border border-slate-200 bg-slate-50/50 pl-[56px] pr-5 text-[14px] font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 placeholder:font-medium"
                  placeholder="กรอกรหัสผ่าน"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[56px] rounded-2xl bg-slate-900 text-white font-bold text-[14px] flex items-center justify-center gap-3 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)] hover:bg-slate-800 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0 mt-8 group"
            >
              {loading ? (
                <InlineSpinner className="text-white" />
              ) : (
                <>
                  เข้าสู่ระบบ
                  <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Powered By at bottom center on Mobile */}
          <div className="mt-16 flex flex-col items-center lg:hidden">
            <p className="text-[10px] font-black text-slate-400 tracking-[0.2em]">
              {pubSettings?.LOGIN_POWERED_BY || 'Powered by ETE DC Phuket Team'}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
