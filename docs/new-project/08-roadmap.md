# 08 - Roadmap / Implementation Plan

## Phase 1: Core Inventory

เป้าหมาย: ทำแกนคลังให้ถูกก่อน

### Features
- Auth + role
- Item master
- Warehouse
- WarehouseStock buckets
- StockLedger
- Receive
- Issue manual
- Transfer
- Adjustment
- Stock report
- Excel export

### Acceptance Criteria
- รับเข้าแล้ว stock เพิ่มถูกคลัง
- เบิกแล้ว stock ลดถูกคลัง
- โอนคลังแล้วต้นทาง/ปลายทางถูกต้อง
- ห้าม bucket ติดลบ
- ledger ตรงกับ stock

---

## Phase 2: Job + Logistics

เป้าหมาย: เชื่อมใบงานกับ stock movement

### Features
- Job / JobLine
- Create delivery/return/mixed job
- Accept job
- Issue by job
- Arrive
- Fulfill delivery
- Pickup return
- Return to office
- Quarantine review

### Acceptance Criteria
- งานส่งอย่างเดียวครบ flow
- งานรับคืนอย่างเดียวครบ flow
- งานส่ง+รับคืนครบ flow
- ห้ามส่งมอบถ้าเบิกไม่ครบ
- รับคืนจากร้านไม่ถูกตีเป็นรอตรวจทันที

---

## Phase 3: Asset Unit / Serial

เป้าหมาย: ตามตู้แช่รายเครื่องได้

### Features
- AssetUnit
- Asset tag / Serial
- Scan flow
- Asset timeline
- Customer possession by serial
- Repair history

### Acceptance Criteria
- ตู้ serialized ต้อง scan ก่อนส่งมอบ
- ดูได้ว่าตู้อยู่คลังไหน/ลูกค้าไหน
- เห็นประวัติตู้รายเครื่อง

---

## Phase 4: Reports + Audit

เป้าหมาย: รายงานใช้บริหารจริง

### Features
- Stock on hand
- Movement ledger
- Customer possession
- Logistics aging
- Repair aging
- Low stock
- Audit log
- PDF/Excel export

### Acceptance Criteria
- Export Excel ทุก report ได้
- filter ทำงานถูก
- audit log ดูย้อนหลังได้

---

## Phase 5: Optimization

เป้าหมาย: ใช้หน้างานได้ลื่นขึ้น

### Features
- Offline draft queue
- Barcode scanner optimization
- Background sync
- Scheduled report
- Reconcile tools
- Performance tuning

---

## Suggested Tech Stack

### Backend
- Node.js + Express หรือ NestJS
- Prisma
- PostgreSQL
- Zod validation
- JWT auth

### Frontend
- React + Vite
- Plain CSS
- DaisyUI เฉพาะพื้นฐาน
- ExcelJS สำหรับ export

### Quality
- Unit test stock movement
- API integration test
- Frontend smoke test
- Seed data สำหรับ demo/test

## First Sprint แนะนำ

1. สร้าง repo/project skeleton
2. สร้าง schema core: User, Item, Warehouse, WarehouseStock, StockLedger
3. ทำ login
4. ทำ item/warehouse CRUD
5. ทำ receive stock
6. ทำ stock report
7. ทำ issue manual
8. ทำ transfer
9. ทำ non-negative tests
10. ทำ Excel export

## Definition of Done

แต่ละ feature ต้องมี:
- API validation
- DB transaction
- ledger record
- error message ภาษาไทย
- frontend loading/disable button
- test หรือ manual verification note
