# ETEIVM New Project Blueprint

> เอกสารต้นแบบสำหรับสร้างโปรเจคบริหารคลังพัสดุ/ตู้แช่เวอร์ชันใหม่  
> สร้างเมื่อ: 2026-04-28 11:48 +07  
> เป้าหมาย: เอาบทเรียนจาก ETEIVM ปัจจุบัน + แนวทางจากระบบ Inventory/WMS ที่ดี มาทำระบบใหม่ให้ชัด, เบา, เร็ว, และกันสต็อกพลาดตั้งแต่โครงสร้าง

---

## 1. วิสัยทัศน์ของโปรเจคใหม่

ระบบใหม่ควรเป็น **Inventory + Logistics + Asset Tracking** สำหรับงานพัสดุคลังและตู้แช่เชิงพาณิชย์ โดยเน้น 5 เรื่องหลัก:

1. **สต็อกต้องถูกต้องตามคลังจริง**  
   ใช้ `WarehouseStock`/Stock Bucket เป็น source of truth ไม่ใช้ยอดรวมลอย ๆ

2. **ทุก movement ต้องย้อนดูได้**  
   รับเข้า, เบิกออก, โอนคลัง, ส่งมอบ, รับคืน, ซ่อม, ตีซาก ต้องมี ledger/transaction เสมอ

3. **มือถือพนักงานต้องใช้ง่ายและเร็ว**  
   UI เรียบ, ปุ่มใหญ่, โหลดเร็ว, ไม่มี effect หนัก, ลดการกรอกข้อความ

4. **ตู้แช่ต้องไปสู่รายชิ้น/Serial ได้**  
   ตอนแรกใช้ stock แบบจำนวนรวมได้ แต่โครงสร้างต้องพร้อมแยก Asset Unit ภายหลัง

5. **รายงานต้องใช้ตัดสินใจได้จริง**  
   ดูคงเหลือตามคลัง/สถานะ/ลูกค้า/งาน/ช่วงเวลา และ export Excel/PDF ได้

---

## 2. บทบาทผู้ใช้งานหลัก

### 2.1 Sale / ผู้แจ้งงาน
- สร้างใบแจ้งส่ง/รับคืน
- ระบุลูกค้า CV, ที่อยู่, เบอร์, ผู้แจ้ง, วันที่แจ้ง, นัดหมาย
- เลือกรายการพัสดุที่จะส่งหรือรับคืน
- ดูสถานะงานที่แจ้งไว้

### 2.2 Logistic / พนักงานขนส่ง
- รับงาน
- เบิกพัสดุจากคลัง
- เดินทางไปหน้างาน
- ยืนยันส่งมอบ
- รับคืนพัสดุจากลูกค้า
- ถ่ายรูป/บันทึก serial/asset tag/สภาพ
- ปิดงานหรือส่งต่อให้ออฟฟิศตรวจ

### 2.3 Office Admin / คลัง / แอดมิน
- รับเข้าสต็อก
- ตรวจรายการรับคืน
- ย้ายคลัง
- ปรับสถานะ: พร้อมใช้, รอตรวจ, รอซ่อม, ตีซาก, สูญหาย
- ตรวจรายงาน
- จัดการผู้ใช้/สิทธิ์/คลัง/สินค้า master

### 2.4 Manager / Auditor
- ดูรายงานรวม
- ตรวจ audit log
- อนุมัติ adjustment / write-off / ตีซาก
- ตรวจความคลาดเคลื่อนสต็อก

---

## 3. หลักการออกแบบข้อมูล

### 3.1 แยก Catalog ออกจาก Stock

อย่าให้ `Item` เก็บสถานะทุกอย่างเอง ควรแยกแบบนี้:

- `Item` หรือ `MasterItem` = ข้อมูลสินค้า/SKU
- `WarehouseStock` = ยอดต่อคลังและต่อสถานะ
- `StockLedger` หรือ `Transaction` = ประวัติการเคลื่อนไหว
- `AssetUnit` = รายชิ้น/Serial/Asset Tag สำหรับของที่ต้องตามตัว

### 3.2 Source of Truth

| ข้อมูล | Source of truth |
|---|---|
| จำนวนพร้อมใช้ต่อคลัง | `WarehouseStock.available_qty` หรือ `stock_qty` |
| จำนวนระหว่างส่ง | `WarehouseStock.transit_qty` |
| จำนวนรอตรวจ | `WarehouseStock.quarantine_qty` |
| จำนวนรอซ่อม | `WarehouseStock.repair_qty` |
| จำนวนสูญหาย/ตีซาก | `WarehouseStock.lost_qty`, `scrap_qty` |
| ประวัติการเคลื่อนไหว | `StockLedger`/`Transaction` |
| ของอยู่กับลูกค้า | `CustomerInventory` หรือ `AssetUnit.holder_customer_cv` |
| ตำแหน่งตู้รายเครื่อง | `AssetUnit.current_warehouse_id` + `holder_customer_cv` |

### 3.3 MasterItem.stock_qty ควรเป็น cache เท่านั้น

ใน ETEIVM ปัจจุบันใช้แนวทางที่ถูกต้องแล้ว:

- `WarehouseStock` เป็นตัวจริง
- `MasterItem.stock_qty` เป็น aggregate/cache
- ห้ามเก็บ bucket เช่น repair/scrap/lost/quarantine/transit ไว้ที่ `MasterItem`

โปรเจคใหม่ควรชัดกว่าเดิม: ถ้าเป็นไปได้ ให้ไม่ใช้ cache เลยในช่วงแรก หรือถ้าใช้ cache ต้องมี job ตรวจ reconcile

---

## 4. Schema แนะนำสำหรับโปรเจคใหม่

### 4.1 User / Role / Permission

```text
User
- id
- username
- password_hash
- display_name
- role_id
- is_active
- last_seen_at
- created_at

Role
- id
- code
- name

Permission
- id
- code
- description

RolePermission
- role_id
- permission_id
```

Permission ควรเป็นราย action เช่น:

- `inventory.view`
- `inventory.receive`
- `inventory.issue`
- `inventory.transfer`
- `inventory.adjust`
- `job.create`
- `job.issue`
- `job.fulfill`
- `repair.review`
- `report.export`
- `settings.manage`

### 4.2 Customer

```text
Customer
- cv / customer_code
- name
- phone
- address
- subdistrict
- district
- province
- zipcode
- latitude
- longitude
- image_url
- is_active
```

กฎสำคัญ:
- งานส่ง/รับคืนที่ผูกลูกค้าต้องมี CV
- CV ต้องมีชื่อและที่อยู่ครบ
- ถ้าไม่มีข้อมูลลูกค้า ไม่ควรให้สร้างงานจริง

### 4.3 Warehouse / Location

```text
Warehouse
- id
- code
- name
- type: MAIN, DC, TRUCK, CUSTOMER_SITE, TEMP
- is_active
- latitude
- longitude

Location/Bin (optional)
- id
- warehouse_id
- code
- name
- type: shelf, floor, repair_area, quarantine_area
```

เริ่มต้นอาจมีแค่ Warehouse ก่อน ไม่ต้องมี Bin ถ้าหน้างานยังไม่พร้อม

### 4.4 Item / SKU

```text
Item
- id
- sku
- category
- brand
- item_name
- size
- condition_label
- details
- tracking_type: BATCH | SERIALIZED
- unit
- is_active
```

แนวทาง:
- ของทั่วไป เช่น สติ๊กเกอร์/ตะกร้า ใช้ `BATCH`
- ตู้แช่/เครื่องสำคัญ ใช้ `SERIALIZED` เมื่อพร้อม

### 4.5 WarehouseStock / StockBucket

```text
WarehouseStock
- id
- item_id
- warehouse_id
- available_qty
- reserved_qty
- transit_qty
- quarantine_qty
- repair_qty
- scrap_qty
- lost_qty
- updated_at

unique(item_id, warehouse_id)
check all qty >= 0
```

แนะนำเพิ่ม `reserved_qty` ในโปรเจคใหม่  
เพราะช่วยกันปัญหา “แจ้งงานแล้ว แต่ยังไม่เบิก แล้วคนอื่นเบิกตัดหน้า”

### 4.6 StockLedger / Transaction

```text
StockLedger
- id
- event_no
- job_id nullable
- item_id
- asset_unit_id nullable
- from_warehouse_id nullable
- to_warehouse_id nullable
- customer_cv nullable
- action_type
- bucket_from nullable
- bucket_to nullable
- quantity
- reason_code nullable
- note nullable
- operator_id
- created_at
- idempotency_key
```

หลักสำคัญ:
- ห้ามแก้ ledger เดิมโดยตรง
- ถ้าผิด ให้ทำ reversal transaction
- ทุก movement ต้องมี `idempotency_key` กันกดซ้ำ

### 4.7 Job / JobLine

โปรเจคใหม่ควรแยก Job line ออกจาก Transaction ให้ชัดกว่าเดิม

```text
Job
- id / job_no
- customer_cv
- job_type: DELIVERY | RETURN | MIXED | SURVEY
- status
- warehouse_id
- created_by
- assigned_to
- notifier
- notification_date
- appointment_date
- note
- created_at

JobLine
- id
- job_id
- line_type: DELIVERY | RETURN | SERVICE
- item_id
- quantity
- requested_condition
- return_reason
- required_serial boolean
- status
```

ข้อดี:
- ใบงานคือ “แผน”
- Transaction/Ledger คือ “สิ่งที่เกิดขึ้นจริง”
- ลดปัญหาการนับ planned/issued/fulfilled ปนกัน

### 4.8 CustomerInventory

```text
CustomerInventory
- id
- customer_cv
- item_id
- quantity
- updated_at
unique(customer_cv, item_id)
```

ใช้สำหรับ batch item ที่อยู่กับลูกค้า

### 4.9 AssetUnit สำหรับรายชิ้น

```text
AssetUnit
- id
- item_id
- asset_tag
- serial_number
- status: STOCK | RESERVED | IN_TRANSIT | WITH_CUSTOMER | QUARANTINE | REPAIR | SCRAP | LOST
- current_warehouse_id nullable
- holder_customer_cv nullable
- condition
- last_job_id nullable
- note
- created_at
- updated_at
```

สำหรับตู้แช่ควรมี:
- ประวัติส่งมอบ/รับคืน
- ประวัติซ่อม
- รูปภาพ
- ลูกค้าผู้ครอบครองล่าสุด
- สถานะล่าสุด

---

## 5. Stock Bucket Logic

### 5.1 Bucket หลัก

| Bucket | ความหมาย | ใช้เมื่อ |
|---|---|---|
| Available | พร้อมเบิก/พร้อมใช้ | อยู่ในคลังและใช้งานได้ |
| Reserved | ถูกจองให้ใบงาน | สร้างใบงาน/รอเบิก |
| In Transit | อยู่ระหว่างขนส่ง | เบิกออกจากคลังแล้ว ยังไม่ส่งมอบ/รับเข้าปลายทาง |
| With Customer | อยู่กับลูกค้า | ส่งมอบแล้ว |
| Quarantine | รอตรวจ | รับคืนถึงคลัง/รอแอดมินตรวจ |
| Repair | รอซ่อม/กำลังซ่อม | ตรวจแล้วพบเสีย |
| Scrap | ตีซาก/รอจำหน่าย | ใช้งานไม่ได้ |
| Lost | สูญหาย | ยืนยันหาย |

### 5.2 Movement หลัก

```text
Receive:
  external/source -> Available หรือ Quarantine

Reserve:
  Available -> Reserved

Issue/Pick:
  Reserved หรือ Available -> In Transit

Fulfill Delivery:
  In Transit -> With Customer

Pickup Return from Customer:
  With Customer -> In Transit

Return to Office:
  In Transit -> Quarantine

Admin Review Normal:
  Quarantine -> Available

Admin Review Repair:
  Quarantine -> Repair

Admin Review Scrap:
  Quarantine -> Scrap

Admin Review Lost:
  Quarantine หรือ In Transit -> Lost

Transfer:
  Warehouse A Available -> In Transit -> Warehouse B Available
```

### 5.3 กฎ non-negative

ทุก update ต้องห้ามทำให้ bucket ติดลบ

ตัวอย่าง error ที่ดี:

```text
สต็อกคลัง "คลังหลัก" ไม่พอสำหรับ LIEBHERR 105cm
พร้อมใช้เหลือ 2 แต่ต้องการเบิก 3
```

หรือ

```text
พัสดุยังไม่ได้เบิกครบ ไม่สามารถส่งมอบได้
แจ้งส่ง 3 / เบิกแล้ว 1 / คงเหลือต้องเบิก 2
```

---

## 6. Workflow หลักของระบบใหม่

## 6.1 แจ้งงานส่งของ

```text
Sale/Admin สร้าง Job DELIVERY
↓
เลือก Customer + Warehouse + รายการส่ง
↓
ระบบตรวจ customer + stock available
↓
ระบบ reserve stock หรืออย่างน้อยตรวจ stock ณ เวลาสร้างงาน
↓
Job = PENDING/WAITING_ACCEPT
```

แนะนำโปรเจคใหม่: ใช้ `Reserved` ตั้งแต่ตอนสร้างงาน เพื่อกันสต็อกถูกใช้ซ้ำ

## 6.2 Logistics รับงาน

```text
Logistic เปิดหน้า รอรับงาน
↓
กดรับงาน
↓
Job = ACCEPTED
↓
ยังไม่ตัด stock ถ้ายังไม่ได้เบิกจริง
```

## 6.3 เบิกพัสดุออกหน้างาน

```text
Logistic เปิด Job
↓
ระบบโหลด JobLine delivery ที่ยังไม่ได้เบิกครบ
↓
แสดง stock ตาม warehouse_id ของ Job เท่านั้น
↓
กดยืนยันเบิก
↓
Reserved/Available -> In Transit
↓
สร้าง Transaction/Ledger เบิกออก
↓
Job = IN_TRANSIT หรือ PARTIALLY_ISSUED
```

กฎสำคัญ:
- ห้ามใช้ warehouseId จาก localStorage เป็นหลัก
- ใช้ warehouseId ของ Job ก่อนเสมอ
- Matching item ต้องใช้ `item_id` ก่อน text

## 6.4 ถึงหน้าร้าน

```text
Logistic กดถึงหน้าร้าน
↓
บันทึกเวลา + GPS
↓
Job = ARRIVED
```

## 6.5 ส่งมอบ

```text
Logistic ยืนยันรายการส่งมอบ
↓
ระบบตรวจว่า issued >= planned delivery
↓
In Transit -> With Customer
↓
CustomerInventory เพิ่ม
↓
Job delivery lines = completed
```

กฎสำคัญ:
- ถ้า planned 3 แต่ issued 1 ห้ามกดส่งมอบ ต้องกลับไปเบิกก่อน
- ถ้าตู้เป็น serial ต้อง scan serial ก่อนส่งมอบ

## 6.6 รับคืนจากลูกค้า

```text
Logistic เลือกรายการรับคืน
↓
บันทึกสภาพ/สาเหตุ/รูป/serial
↓
With Customer -> In Transit
↓
CustomerInventory ลด
↓
Job = RETURN_PICKED_UP / RETURNING
```

ข้อควรจำจาก ETEIVM:
- `รับคืนจากร้าน` ยังไม่ใช่ `รอตรวจ`
- อย่าส่ง status `รอตรวจ` ในขั้นรับคืนจากร้าน เพราะจะถูกตีความเป็นกลับคลังแล้ว

## 6.7 กลับคลัง / รอตรวจ

```text
ของกลับถึงคลัง
↓
In Transit -> Quarantine
↓
Office Admin เห็นในคิวรอตรวจ
```

## 6.8 Office Admin ตรวจสภาพ

```text
Quarantine -> Available / Repair / Scrap / Lost
↓
บันทึกผลตรวจ + รูป + note
↓
ถ้า Repair เสร็จ: Repair -> Available
```

---

## 7. Workflow แบบ 2/3/4 Step ที่ ETEIVM ต้องรองรับ

### 7.1 งานรับคืนอย่างเดียว: 2 Step

```text
1) Logistic รับคืนจากลูกค้า: With Customer -> In Transit
2) Office รับเข้ารอตรวจ: In Transit -> Quarantine -> Repair/Available/Scrap/Lost
```

### 7.2 งานส่งอย่างเดียว: 3 Step

```text
1) รับงาน
2) เบิกออก: Available/Reserved -> In Transit
3) ส่งมอบ: In Transit -> With Customer
```

### 7.3 งานส่ง + รับคืน: 4 Step

```text
1) รับงาน
2) เบิกของที่จะส่ง: Available/Reserved -> In Transit
3) ส่งมอบของใหม่: In Transit -> With Customer
4) รับคืนของเก่า: With Customer -> In Transit -> Quarantine/RepairManagement
```

ทุกกรณีต้องผูกกับ:
- Customer CV
- Warehouse ของใบงาน
- JobLine
- Transaction/Ledger

---

## 8. API Design แนะนำ

### 8.1 Auth

```text
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### 8.2 Master Data

```text
GET    /api/items
POST   /api/items
PATCH  /api/items/:id
GET    /api/warehouses
POST   /api/warehouses
GET    /api/customers
POST   /api/customers
PATCH  /api/customers/:cv
```

### 8.3 Stock

```text
GET  /api/stocks?warehouseId=&itemId=&bucket=
GET  /api/stocks/summary
GET  /api/stocks/ledger?dateFrom=&dateTo=&warehouseId=&itemId=
POST /api/stocks/receive
POST /api/stocks/issue
POST /api/stocks/transfer
POST /api/stocks/adjust
POST /api/stocks/reserve
POST /api/stocks/unreserve
```

### 8.4 Jobs

```text
GET  /api/jobs
POST /api/jobs
GET  /api/jobs/:jobNo
POST /api/jobs/:jobNo/accept
POST /api/jobs/:jobNo/issue
POST /api/jobs/:jobNo/arrive
POST /api/jobs/:jobNo/fulfill
POST /api/jobs/:jobNo/pickup-return
POST /api/jobs/:jobNo/return-to-office
POST /api/jobs/:jobNo/cancel
```

### 8.5 Repair / Review

```text
GET  /api/reviews/quarantine
POST /api/reviews/:id/mark-available
POST /api/reviews/:id/mark-repair
POST /api/reviews/:id/mark-scrap
POST /api/reviews/:id/mark-lost
```

### 8.6 Reports

```text
GET /api/reports/stock-on-hand
GET /api/reports/stock-movement
GET /api/reports/customer-possession
GET /api/reports/transfer-aging
GET /api/reports/low-stock
GET /api/reports/asset-history
GET /api/reports/export.xlsx
GET /api/reports/export.pdf
```

---

## 9. Frontend Structure แนะนำ

### 9.1 โครงสร้างหน้า

```text
src/
  api/
    client.ts
    auth.ts
    items.ts
    stocks.ts
    jobs.ts
    reports.ts
  components/
    common/
    mobile/
    desktop/
  features/
    inventory/
    receive/
    issue/
    logistics/
    repair/
    reports/
    settings/
  utils/
    stock.ts
    itemMatching.ts
    date.ts
    excel.ts
```

### 9.2 หน้า mobile สำคัญ

- Welcome / Quick Menu
- Inventory Search
- Quick Scan
- Receive
- Issue
- Logistics Jobs
- Fulfillment
- Return Pickup
- Repair Review
- Reports Lite

### 9.3 UI Guideline สำหรับกาน

- ใช้ plain HTML/CSS เป็นหลัก
- DaisyUI ใช้เฉพาะปุ่ม/alert/loading พื้นฐาน
- ไม่ใช้ animation/effect หนัก
- มือถือเก่าต้อง scroll ลื่น
- ปุ่ม action หลักต้องใหญ่และอยู่ล่างสุด
- ข้อความ error ต้องบอก “ทำอะไรต่อ”

---

## 10. Reports ที่ควรมีตั้งแต่แรก

### 10.1 Stock On Hand
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
- item
- warehouse
- available
- reserved
- transit
- quarantine
- repair
- scrap
- lost
- total

### 10.2 Movement Ledger
Filter:
- date range
- action type
- warehouse
- item
- job no
- operator
- customer

### 10.3 Customer Possession
- ลูกค้าถือครองอะไรอยู่
- จำนวนเท่าไร
- serial/asset tag อะไร
- ส่งมอบเมื่อไร
- งานล่าสุดคืออะไร

### 10.4 Logistics Aging
- งานค้างรับงาน
- งานค้างเบิก
- ของค้างระหว่างส่ง
- ของรับคืนค้างกลับคลัง
- ของค้างรอตรวจ

### 10.5 Repair / Scrap / Lost
- รายการรอตรวจ
- รายการรอซ่อม
- รายการซ่อมเสร็จ
- รายการตีซาก
- รายการสูญหาย

### 10.6 Export
- Excel ต้องใช้งานได้จริง
- PDF ใช้สำหรับส่งผู้บริหาร/พิมพ์
- ควรจำ filter ที่ผู้ใช้เลือกก่อน export

---

## 11. Best Practices จากระบบ Inventory/WMS ที่ดี

จากแนวทางของระบบ WMS/Inventory ชั้นดี เช่น Odoo, ERPNext, Dynamics, Shopify/WooCommerce inventory และระบบคลังแบบ barcode-driven ควรนำมาปรับใช้ดังนี้:

### 11.1 Ledger-first
ทุก movement ต้องเกิดเป็น ledger ก่อนหรือพร้อมกับ stock update  
ไม่ควรมีการแก้ยอดแบบเงียบ ๆ

### 11.2 Bucket-based inventory
แยก Available, Reserved, In Transit, Quarantine, Repair, Scrap, Lost  
อย่ารวมทุกอย่างเป็น “คงเหลือ” เดียว

### 11.3 Reservation
ถ้ามีใบงานแล้ว ควรจอง stock เพื่อกันเบิกซ้ำ

### 11.4 Barcode/QR scan
- ลดการพิมพ์
- ลดเลือก item ผิด
- บังคับ serial สำหรับตู้แช่

### 11.5 Cycle Count
- ตรวจนับเป็นรอบ
- เก็บ variance
- adjustment ต้องมีเหตุผลและอนุมัติ

### 11.6 Transfer Reconciliation
โอนคลังต้องมี 2 ฝั่ง:
- ต้นทางส่งออก
- ปลายทางรับเข้า

ถ้าปลายทางรับไม่ครบ ต้องมี shortage/damage note

### 11.7 Audit + Permission
- ทุก action มี user/time/device
- adjustment/write-off ต้องอนุมัติ
- admin ดูย้อนหลังได้

### 11.8 Mobile task flow
หน้า mobile ไม่ควรเป็น dashboard ใหญ่  
ควรเป็น “งานที่ต้องทำตอนนี้” เช่น รับเข้า, เบิก, สแกน, ส่งมอบ

---

## 12. ปัญหาจาก ETEIVM ปัจจุบันที่ต้องกันในโปรเจคใหม่

### 12.1 warehouseId ค้าง
ปัญหา:
- frontend ใช้ warehouseId จาก localStorage/default
- ทำให้เช็กสต็อกผิดคลัง

แนวทางใหม่:
- ทุก job ต้องมี `warehouse_id`
- ทุก API payload ต้องส่ง `warehouse_id`
- frontend ใช้ warehouse ของ job ก่อนเสมอ

### 12.2 Matching item ด้วย text
ปัญหา:
- รายการชื่อเหมือนกันแต่คนละ item id
- ทำให้ stock ขึ้น 0 หรือเลือก variant ผิด

แนวทางใหม่:
- ใช้ item_id / asset_unit_id เป็นหลัก
- text matching เป็น fallback เท่านั้น

### 12.3 เบิกไม่ครบแต่กดส่งมอบ
ปัญหา:
- planned 3 แต่ issued 1 ระบบไป fulfill แล้ว transit ไม่พอ

แนวทางใหม่:
- JobLine มี planned_qty
- StockLedger มี issued_qty
- UI ต้องคำนวณ `planned_delivery_qty > issued_qty` แล้วบังคับเบิกก่อน

### 12.4 สับสนระหว่างรับคืนจากร้านกับกลับคลัง
ปัญหา:
- `รับคืนจากร้าน` คือ Customer -> Transit
- `รอตรวจ` คือ Transit -> Quarantine

แนวทางใหม่:
- แยก action ชัด:
  - `pickup_return`
  - `return_to_office`
  - `review_return`

### 12.5 ซ่อนรายการ stock 0
ปัญหา:
- หน้า stock filter คลังแล้วซ่อนรายการ 0 ทำให้เหมือนพัสดุหาย

แนวทางใหม่:
- หน้า Stock ควรเลือกได้ว่า “แสดงรายการ 0” หรือไม่
- default ควรแสดงครบในมุมมองคลังหลัก/รายงาน

### 12.6 MasterItem กับ WarehouseStock ปนกัน
ปัญหา:
- ถ้าเก็บ bucket หลายที่ จะ reconcile ยาก

แนวทางใหม่:
- WarehouseStock เป็น source of truth เท่านั้น
- MasterItem เป็น catalog เท่านั้น

---

## 13. Roadmap ทำโปรเจคใหม่

## Phase 1: Core Inventory

เป้าหมาย: มีระบบคลังที่ถูกต้องก่อน

สิ่งที่ทำ:
- Auth + Role
- Item master
- Warehouse
- WarehouseStock bucket
- StockLedger
- Receive
- Issue manual
- Transfer
- Adjustment
- Stock report + export Excel

ยังไม่ต้องทำ:
- Logistics ซับซ้อน
- Serial เต็มระบบ
- Offline

## Phase 2: Job + Logistics

เป้าหมาย: เชื่อมใบงานกับการเบิก/ส่ง/รับคืน

สิ่งที่ทำ:
- Job / JobLine
- Create job delivery/return/mixed
- Accept job
- Issue by job
- Arrive
- Fulfill delivery
- Pickup return
- Return to office
- Quarantine review

## Phase 3: Asset Unit / Serial

เป้าหมาย: ตู้แช่ตามรายเครื่องได้

สิ่งที่ทำ:
- AssetUnit
- Asset tag / Serial
- Scan flow
- Asset timeline
- Customer possession by serial
- Repair history

## Phase 4: Reports + Audit

เป้าหมาย: รายงานใช้งานจริง

สิ่งที่ทำ:
- Stock on hand
- Movement ledger
- Customer possession
- Logistics aging
- Repair aging
- Low stock
- Audit log
- PDF/Excel export

## Phase 5: Optimization

เป้าหมาย: ใช้งานหน้างานได้ลื่น

สิ่งที่ทำ:
- Offline draft queue
- Barcode scanner optimization
- Background sync
- Dashboard manager
- Scheduled report
- Data cleanup/reconcile tools

---

## 14. Acceptance Criteria สำหรับโปรเจคใหม่

ระบบใหม่ถือว่าพร้อมใช้งานเมื่อ:

1. สร้าง item และคลังได้
2. รับเข้าแล้ว stock เพิ่มถูกคลัง
3. เบิกออกแล้ว stock ลดถูกคลัง และเพิ่ม transit
4. ส่งมอบแล้ว transit ลด และ customer inventory เพิ่ม
5. รับคืนแล้ว customer inventory ลด และ transit/quarantine ถูกต้อง
6. ห้าม stock bucket ติดลบ
7. Job mixed ส่ง+รับคืนทำงานได้
8. รายงาน stock ตรงกับ ledger
9. export Excel ได้
10. มือถือโหลดเร็วและใช้งานได้โดยไม่ต้อง zoom

---

## 15. ข้อเสนอด้านเทคนิค

### Backend
- Node.js + Express หรือ NestJS
- Prisma + PostgreSQL
- Transaction ทุก movement
- Zod validation สำหรับ request body
- Idempotency key สำหรับ API ที่กระทบ stock
- Centralized stock service เช่น `StockMovementService`

### Frontend
- React + Vite
- Plain CSS + DaisyUI เฉพาะพื้นฐาน
- แยก feature folder
- ใช้ API client กลาง
- ใช้ utility กลางสำหรับ item matching/stock bucket

### Database
- PostgreSQL
- ใช้ constraint non-negative
- ใช้ index ตาม query จริง
- ใช้ migration ชัดเจน
- มี seed สำหรับ warehouse/main roles

### Testing
- Unit test stock movement
- Integration test receive/issue/fulfill/return
- Regression test mixed job
- API test negative stock
- Frontend smoke test หน้า mobile หลัก

---

## 16. โครงสร้างเอกสารที่ควรทำต่อ

ควรแตกเอกสารเพิ่มเป็นไฟล์ย่อย:

```text
docs/new-project/
  01-overview.md
  02-data-model.md
  03-stock-logic.md
  04-job-logistics-workflow.md
  05-api-design.md
  06-ui-ux-guideline.md
  07-reports.md
  08-roadmap.md
  09-migration-from-eteivm.md
```

เอกสารนี้เป็น blueprint รวมก่อน จากนั้นค่อยแตกเป็น implementation plan ทีละ Phase

---

## 17. สรุปสั้นสำหรับกาน

โปรเจคใหม่ควรสร้างด้วยแนวคิด:

> **Stock Ledger เป็นหัวใจ, WarehouseStock เป็นยอดจริง, JobLine เป็นแผน, Transaction เป็นสิ่งที่เกิดขึ้นจริง, AssetUnit ใช้ตามตู้รายเครื่อง**

ถ้าทำตามนี้ ระบบจะกันปัญหาหลักที่เจอใน ETEIVM ปัจจุบันได้ เช่น:

- stock ขึ้น 0 เพราะคลังผิด
- เบิกไม่ครบแต่ส่งมอบ
- รับคืนจากร้านกับรอตรวจปนกัน
- รายการคลังหลักดูเหมือนหาย
- item ชื่อเหมือนกันแต่เลือกผิดตัว
- ตรวจประวัติย้อนหลังยาก

เป้าหมายไม่ใช่ทำ ERP ใหญ่ แต่ทำ **ระบบคลังพัสดุที่เบา, ใช้จริงหน้างานได้, และข้อมูลไม่มั่ว**
