import { useState, type FormEvent } from 'react';
import { login } from '../../api';
import { InlineSpinner } from '../shared/CommonUI';
import type { User } from '../../types';
import developerLogo from '../../assets/hero.png';

interface LoginProps {
 onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');

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

 return (
 <div className="mobile-app-shell flex flex-col justify-center items-center p-6">
 <div className="w-full max-w-md mobile-plain-scope">
 <div className="card bg-base-100 border border-base-300 rounded-2xl p-6 md:p-7 shadow-none">
 
 <div className="flex flex-col items-center mb-8 text-center">
 <div className="relative mb-5">
 <div className="relative z-10 w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center bg-base-200 border border-base-300">
 <img 
 src={developerLogo} 
 alt="Developer" 
 className="w-full h-full object-contain p-3 scale-[0.9]" 
 />
 </div>
 </div>
 <h1 className="text-2xl font-bold text-base-content tracking-tight mb-1">เข้าสู่ระบบคลังพัสดุ</h1>
 <p className="text-[12px] font-semibold text-base-content/70">ETEIVM • ใช้งานบนมือถือได้ต่อเนื่อง</p>
 </div>

 {error && (
 <div className="alert alert-error rounded-xl mb-6 text-sm font-semibold border border-base-300">
 <span className="material-symbols-outlined text-lg">error</span>
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-[12px] font-semibold text-base-content/70 mb-2">ชื่อผู้ใช้</label>
 <div className="relative">
 <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40">person</span>
 <input
 type="text"
 value={username}
 onChange={(e) => setUsername(e.target.value)}
 className="input input-bordered w-full rounded-xl h-12 pl-12 pr-4 text-[14px]"
 placeholder="กรอกชื่อผู้ใช้"
 disabled={loading}
 />
 </div>
 </div>

 <div>
 <label className="block text-[12px] font-semibold text-base-content/70 mb-2">รหัสผ่าน</label>
 <div className="relative">
 <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40">lock</span>
 <input
 type="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="input input-bordered w-full rounded-xl h-12 pl-12 pr-4 text-[14px]"
 placeholder="กรอกรหัสผ่าน"
 disabled={loading}
 />
 </div>
 </div>

 <button
 type="submit"
 disabled={loading}
 className={`btn btn-primary no-animation w-full rounded-xl h-12 font-semibold text-[14px] ${loading ? 'btn-disabled' : ''}`}
 >
 {loading ? (
 <InlineSpinner className="text-white" />
 ) : (
 <div className="flex items-center justify-center gap-2">
 เข้าสู่ระบบ
 <span className="material-symbols-outlined text-[18px]">login</span>
 </div>
 )}
 </button>
 </form>

 <div className="mt-10 flex flex-col items-center">
 <p className="text-[10px] font-semibold text-base-content/50 tracking-[0.18em] uppercase">
 พัฒนาโดย ทีม เอเต้ ดีซี ภูเก็ต
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
