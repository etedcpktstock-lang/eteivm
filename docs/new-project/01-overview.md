# 01 - Project Overview

> เอกสารภาพรวมสำหรับโปรเจคบริหารคลังพัสดุ/ตู้แช่เวอร์ชันใหม่

## เป้าหมายหลัก

สร้าง web app สำหรับบริหารคลังพัสดุ, ตู้แช่, งานขนส่ง, งานรับคืน และรายงาน โดยเน้น:

1. ใช้งานง่ายบนมือถือพนักงานเครื่องเก่า
2. สต็อกถูกต้องตามคลังจริง
3. ทุก movement ย้อนตรวจสอบได้
4. รองรับหลายคลัง/DC
5. พร้อมต่อยอด serial/asset tracking สำหรับตู้แช่รายเครื่อง

## ขอบเขตระบบ

ระบบใหม่ควรรวม 4 ส่วนใหญ่:

| ส่วน | หน้าที่ |
|---|---|
| Inventory | item master, stock, รับเข้า, เบิก, โอน, ปรับยอด |
| Logistics | ใบงาน, รับงาน, เบิกออก, ส่งมอบ, รับคืน |
| Asset Tracking | serial/asset tag, ตู้รายเครื่อง, ผู้ครอบครองปัจจุบัน |
| Reports | รายงานคลัง, movement, customer possession, export |

## หลักคิดสำคัญ

> Stock Ledger เป็นหัวใจ, WarehouseStock เป็นยอดจริง, JobLine เป็นแผน, Transaction เป็นสิ่งที่เกิดขึ้นจริง, AssetUnit ใช้ตามตู้รายเครื่อง

## User Roles

### Sale / ผู้แจ้งงาน
- สร้างใบแจ้งส่ง/รับคืน
- เลือกลูกค้าและรายการพัสดุ
- ดูสถานะงาน

### Logistic / พนักงานขนส่ง
- รับงาน
- เบิกของจากคลัง
- เช็กอินถึงหน้าร้าน
- ส่งมอบ/รับคืน
- ถ่ายรูป/บันทึก serial/asset tag

### Office Admin / คลัง
- รับเข้าพัสดุ
- ตรวจรับคืน
- จัดการรอตรวจ/ซ่อม/ตีซาก/สูญหาย
- โอนคลัง
- ปรับยอดแบบมีเหตุผล

### Manager / Auditor
- ดูรายงาน
- ตรวจ audit log
- อนุมัติ adjustment/write-off

## สิ่งที่ต้องต่างจาก ETEIVM ปัจจุบัน

1. แยก `JobLine` ออกจาก `Transaction` ชัดเจน
2. มี `Reserved` bucket เพื่อกันการเบิกซ้ำ
3. ทุก API ที่เกี่ยวกับงานต้องส่ง `warehouse_id` เสมอ
4. Stock page ต้องไม่ซ่อนรายการ 0 โดยไม่บอกผู้ใช้
5. Item matching ใช้ id ก่อน text เสมอ
6. Flow รับคืนจากร้านต้องแยกจาก Flow กลับคลังรอตรวจ

## MVP ที่ควรทำก่อน

- Login + role
- Item master
- Warehouse
- WarehouseStock buckets
- StockLedger
- Receive / Issue / Transfer / Adjustment
- Job delivery/return/mixed
- Logistics mobile workflow
- Stock report + Excel export
