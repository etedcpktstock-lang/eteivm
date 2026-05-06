# 04 - Job & Logistics Workflow

## สถานะ Job แนะนำ

```text
DRAFT
PENDING
ACCEPTED
PARTIALLY_ISSUED
IN_TRANSIT
ARRIVED
PARTIALLY_FULFILLED
RETURN_PICKED_UP
RETURNING_TO_OFFICE
QUARANTINE_WAITING
COMPLETED
CANCELLED
```

ไม่จำเป็นต้องใช้ครบใน MVP แต่ควรออกแบบรองรับ

---

## Workflow 1: แจ้งงานส่งของ

```text
Sale/Admin สร้าง Job
↓
เลือก Customer + Warehouse + Delivery JobLines
↓
ระบบตรวจ customer
↓
ระบบตรวจ available stock
↓
optional: Available -> Reserved
↓
Job = PENDING
```

กฎ:
- ต้องมี customer CV
- ต้องมี warehouse_id
- delivery line ต้องมี item_id และ quantity

---

## Workflow 2: รับงาน

```text
Logistic เปิดงาน PENDING
↓
กดรับงาน
↓
Job = ACCEPTED
```

ยังไม่กระทบ stock

---

## Workflow 3: เบิกพัสดุ

```text
เปิด Job ACCEPTED/PARTIALLY_ISSUED
↓
ระบบหา JobLine delivery ที่ยังเบิกไม่ครบ
↓
แสดง stock ของ warehouse_id ใน Job
↓
ยืนยันเบิก
↓
Reserved/Available -> In Transit
↓
Job = PARTIALLY_ISSUED หรือ IN_TRANSIT
```

กฎ:
- ถ้า planned 3 เบิก 1 ต้องยังคงเห็นปุ่ม “ต้องเบิกพัสดุก่อน”
- ห้ามไปหน้าส่งมอบจนกว่าจะเบิกครบ

---

## Workflow 4: ถึงหน้าร้าน

```text
Job IN_TRANSIT
↓
Logistic กด ถึงหน้าร้าน
↓
บันทึก GPS/time
↓
Job = ARRIVED
```

---

## Workflow 5: ส่งมอบ

```text
Job ARRIVED
↓
เลือก/ยืนยันรายการส่ง
↓
ถ้า serial item ต้อง scan serial
↓
In Transit -> With Customer
↓
CustomerInventory +qty
↓
JobLine delivery = completed
```

กฎ:
- ตรวจ issued >= planned ก่อน
- ตรวจ transit พอก่อนหัก
- ต้องมี CV ลูกค้า

---

## Workflow 6: รับคืนจากลูกค้า

```text
Job มี return lines
↓
Logistic เลือกรายการรับคืน
↓
บันทึกสภาพ/สาเหตุ/รูป/serial
↓
With Customer -> In Transit
↓
CustomerInventory -qty
↓
Job = RETURN_PICKED_UP หรือ RETURNING_TO_OFFICE
```

คำสำคัญ:
- `รับคืนจากร้าน` = Customer -> Transit
- ยังไม่ใช่ `รอตรวจ`

---

## Workflow 7: กลับคลัง

```text
Logistic กลับถึงคลัง
↓
ยืนยันคืนของเข้าคลัง
↓
In Transit -> Quarantine
↓
Office Admin เห็นในคิวรอตรวจ
```

---

## Workflow 8: Office Admin ตรวจสภาพ

```text
Quarantine
↓
ตรวจแล้วเลือกผล
↓
Available / Repair / Scrap / Lost
↓
สร้าง StockLedger
```

---

## Workflow แบบ 2/3/4 Step

### รับคืนอย่างเดียว: 2 Step

```text
1. รับคืนจากลูกค้า: With Customer -> In Transit
2. กลับคลัง/ตรวจ: In Transit -> Quarantine -> Available/Repair/Scrap/Lost
```

### ส่งอย่างเดียว: 3 Step

```text
1. รับงาน
2. เบิกออก: Available/Reserved -> In Transit
3. ส่งมอบ: In Transit -> With Customer
```

### ส่ง + รับคืน: 4 Step

```text
1. รับงาน
2. เบิกของใหม่
3. ส่งมอบของใหม่
4. รับคืนของเก่า แล้วส่งออฟฟิศตรวจ
```

## UI Guardrails

- งานที่ยังเบิกไม่ครบ แสดงปุ่ม “ต้องเบิกพัสดุก่อน”
- งานที่ยังไม่ถึงหน้าร้าน ห้ามส่งมอบ
- รับคืนจากร้านต้องไม่ส่ง status `รอตรวจ`
- ปิดงานได้เมื่อ JobLine ทั้งหมด completed หรือส่งต่อ office ถูกต้อง
