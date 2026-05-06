import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
 onScan: (decodedText: string) => void;
 onClose: () => void;
 isOpen: boolean;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, isOpen }) => {
 const [error, setError] = useState<string | null>(null);
 const scannerRef = useRef<Html5Qrcode | null>(null);
 const scannerRegionId = 'html5qr-code-full-region';

 useEffect(() => {
 if (isOpen) {
 // Small delay to ensure DOM is ready
 const timer = setTimeout(() => {
 startScanner();
 }, 300);
 return () => {
 clearTimeout(timer);
 stopScanner();
 };
 } else {
 stopScanner();
 }
 }, [isOpen]);

 const startScanner = async () => {
 try {
 if (scannerRef.current) await stopScanner();

 const html5QrCode = new Html5Qrcode(scannerRegionId);
 scannerRef.current = html5QrCode;

 const config = { 
 fps: 10, 
 qrbox: { width: 250, height: 150 },
 aspectRatio: 1.0
 };

 await html5QrCode.start(
 { facingMode:"environment" }, 
 config, 
 (decodedText) => {
 onScan(decodedText);
 stopScanner();
 },
 () => {} // silent failure for frames with no QR
 );
 } catch (err: any) {
 console.error("Scanner Start Error:", err);
 setError("ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาตใช้งานกล้องครับ");
 }
 };

 const stopScanner = async () => {
 if (scannerRef.current && scannerRef.current.isScanning) {
 try {
 await scannerRef.current.stop();
 scannerRef.current = null;
 } catch (err) {
 console.error("Scanner Stop Error:", err);
 }
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80">
 <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden">
 <div className="p-6 border-b border-slate-100 mobile-row flex items-center justify-between bg-slate-50/50">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
 <span className="material-symbols-outlined text-indigo-600 text-[20px]">barcode_scanner</span>
 </div>
 <div>
 <h3 className="font-black text-slate-800 text-lg leading-none">สแกนบาร์โค้ด</h3>
 </div>
 </div>
 <button 
 onClick={onClose}
 className="btn no-animation w-10 h-10 rounded-full flex items-center justify-center text-slate-400"
 >
 <span className="material-symbols-outlined">close</span>
 </button>
 </div>

 <div className="p-6">
 {error ? (
 <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 flex flex-col items-center gap-4 text-center">
 <span className="material-symbols-outlined text-rose-500 text-[48px]">videocam_off</span>
 <p className="text-rose-800 font-bold text-[14px]">{error}</p>
 <button 
 onClick={startScanner}
 className="btn no-animation bg-rose-500 text-white px-6 py-2 rounded-xl text-[13px] font-bold"
 >
 ลองอีกครั้ง
 </button>
 </div>
 ) : (
 <div className="relative group">
 <div 
 id={scannerRegionId} 
 className="w-full aspect-square rounded-xl overflow-hidden bg-slate-900 border-4 border-slate-100"
 ></div>
 <div className="absolute inset-0 border-[2px] border-indigo-500/30 rounded-xl pointer-events-none"></div>
 
 <div className="mt-6 flex flex-col items-center gap-4">
 <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full">
 <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
 <span className="text-[12px] font-semibold text-indigo-700 tracking-tight">กำลังมองหาบาร์โค้ด...</span>
 </div>
 <p className="text-slate-400 text-[11px] font-medium max-w-[200px] text-center">
 วางบาร์โค้ดให้อยู่ในกรอบสี่เหลี่ยม<br/>ระบบจะอ่านค่าโดยอัตโนมัติ
 </p>
 </div>
 </div>
 )}
 </div>

 <div className="p-6 bg-slate-50/50 border-t border-slate-100">
 <button 
 onClick={onClose}
 className="btn no-animation w-full bg-white border border-slate-200 text-slate-600 h-12 rounded-2xl text-[13px] font-bold"
 >
 ยกเลิก
 </button>
 </div>
 </div>
 </div>
 );
};

export default BarcodeScanner;
