# 07 - Reports & Export

## เป้าหมายรายงาน

รายงานต้องตอบคำถามผู้ใช้ได้ทันที:

- ตอนนี้ของอยู่ไหน
- ใช้ได้จริงเท่าไร
- ใครถือครองอยู่
- งานไหนค้าง
- ของไหนค้างซ่อม/รอตรวจ
- movement ย้อนหลังเป็นอย่างไร

---

## 1. Stock On Hand

Filter:
- warehouse
- category
- brand
- item
- size
- condition
- bucket
- qty range

Columns:
- item code / sku
- category
- brand
- item name
- size
- condition
- warehouse
- available
- reserved
- transit
- quarantine
- repair
- scrap
- lost
- total

Export:
- Excel
- PDF summary

---

## 2. Stock Movement Ledger

Filter:
- date range
- warehouse
- item
- action type
- job no
- operator
- customer

Columns:
- date/time
- event no
- job no
- action
- item
- qty
- from warehouse
- to warehouse
- bucket from
- bucket to
- operator
- note

สำคัญ:
- ต้อง export ได้
- ใช้ audit ได้

---

## 3. Customer Possession

ตอบว่า “ลูกค้าถืออะไรอยู่”

Filter:
- customer CV
- province/district
- item
- asset tag

Columns:
- CV
- customer name
- address
- item
- quantity
- asset tag / serial
- delivered date
- last job

---

## 4. Logistics Aging

ดูงานค้าง:

- รอรับงานเกิน X ชั่วโมง
- รับงานแล้วแต่ยังไม่เบิก
- เบิกแล้วแต่ยังไม่ส่งมอบ
- รับคืนแล้วแต่ยังไม่กลับคลัง
- กลับคลังแล้วแต่ยังไม่ตรวจ

Columns:
- job no
- customer
- status
- current step
- age
- assigned logistic
- next action

---

## 5. Repair / Quarantine Aging

ดูของค้างตรวจ/ซ่อม:

- รอตรวจกี่วัน
- รอซ่อมกี่วัน
- ซ่อมเสร็จรอรับเข้าสต็อก
- ตีซาก/สูญหาย

---

## 6. Low Stock / Reorder

ถ้ามี min/max:

Columns:
- item
- warehouse
- available
- reserved
- min
- suggested order qty

---

## 7. Adjustment Report

ทุกการปรับยอดต้องเห็น:
- ใครปรับ
- ปรับอะไร
- ก่อน/หลัง
- เหตุผล
- ผู้อนุมัติ

---

## 8. Dashboard Summary

Dashboard ไม่ควรเยอะเกิน ควรมี:

- Stock available total
- Transit total
- Quarantine total
- Repair total
- Low stock count
- Jobs pending today
- Jobs overdue

## Export Rules

- ทุก report ต้อง export Excel ได้
- PDF ใช้กับรายงานสรุป/ผู้บริหาร
- Export ต้องเคารพ filter ที่เลือกอยู่
- File name ควรมีวันที่ เช่น `stock-on-hand-2026-04-28.xlsx`
