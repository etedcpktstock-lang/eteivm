# 02 - Data Model / Database Schema

## หลักการออกแบบข้อมูล

ระบบใหม่ควรใช้แนวทาง **Catalog + Stock Bucket + Ledger + JobLine + AssetUnit**

- `Item` = รายการสินค้า/SKU
- `WarehouseStock` = ยอดจริงต่อคลังและสถานะ
- `StockLedger` = ประวัติ movement แบบแก้ย้อนหลังไม่ได้
- `Job`/`JobLine` = แผนงานที่ต้องทำ
- `AssetUnit` = ของรายชิ้น/serial เช่น ตู้แช่

---

## User / Role / Permission

```prisma
model User {
  id            Int      @id @default(autoincrement())
  username      String   @unique
  password_hash String
  display_name  String
  role_id       Int
  is_active     Boolean  @default(true)
  last_seen_at  DateTime?
  created_at    DateTime @default(now())
}

model Role {
  id   Int    @id @default(autoincrement())
  code String @unique
  name String
}

model RolePermission {
  id              Int @id @default(autoincrement())
  role_id          Int
  permission_code  String
  @@unique([role_id, permission_code])
}
```

Permission examples:
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

---

## Customer

```prisma
model Customer {
  cv           String  @id
  name         String
  phone        String?
  address      String?
  subdistrict  String?
  district     String?
  province     String?
  zipcode      String?
  latitude     Float?
  longitude    Float?
  image_url    String?
  is_active    Boolean @default(true)
}
```

กฎ:
- งานส่ง/รับคืนต้องมี CV
- CV ต้องมี `name` และ `address`
- ห้ามสร้างงานจริงถ้าข้อมูลลูกค้าไม่ครบ

---

## Warehouse / Location

```prisma
model Warehouse {
  id         Int     @id @default(autoincrement())
  code       String  @unique
  name       String
  type       String  // MAIN, DC, TRUCK, TEMP
  is_active  Boolean @default(true)
  latitude   Float?
  longitude  Float?
}

model LocationBin {
  id           Int    @id @default(autoincrement())
  warehouse_id Int
  code         String
  name         String?
  type         String? // shelf, floor, repair_area, quarantine_area
  @@unique([warehouse_id, code])
}
```

ช่วงแรกใช้แค่ Warehouse ได้ ยังไม่ต้องทำ Bin ถ้าหน้างานยังไม่พร้อม

---

## Item / SKU

```prisma
model Item {
  id             Int      @id @default(autoincrement())
  sku            String?  @unique
  category       String
  brand          String?
  item_name      String
  size           String?
  condition_label String?
  details        String?
  tracking_type  String   @default("BATCH") // BATCH, SERIALIZED
  unit           String   @default("ชิ้น")
  is_active      Boolean  @default(true)
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
}
```

แนวทาง:
- ตู้แช่ = เตรียมให้เป็น `SERIALIZED`
- อุปกรณ์/สติ๊กเกอร์ = `BATCH`

---

## WarehouseStock

```prisma
model WarehouseStock {
  id             Int @id @default(autoincrement())
  item_id        Int
  warehouse_id   Int
  available_qty  Int @default(0)
  reserved_qty   Int @default(0)
  transit_qty    Int @default(0)
  quarantine_qty Int @default(0)
  repair_qty     Int @default(0)
  scrap_qty      Int @default(0)
  lost_qty       Int @default(0)
  updated_at     DateTime @updatedAt

  @@unique([item_id, warehouse_id])
  @@index([warehouse_id])
  @@index([item_id])
}
```

ข้อสำคัญ:
- ทุก qty ต้องไม่ติดลบ
- เป็น source of truth ของจำนวนทุกสถานะ
- ถ้ามี `Item.total_qty` ให้ถือเป็น cache เท่านั้น

---

## StockLedger

```prisma
model StockLedger {
  id                Int      @id @default(autoincrement())
  event_no          String   @unique
  job_id            String?
  job_line_id       Int?
  item_id           Int
  asset_unit_id     Int?
  from_warehouse_id Int?
  to_warehouse_id   Int?
  customer_cv       String?
  action_type       String
  bucket_from       String?
  bucket_to         String?
  quantity          Int
  reason_code       String?
  note              String?
  operator_id       Int
  idempotency_key   String?  @unique
  created_at        DateTime @default(now())
}
```

กฎ:
- ห้ามแก้ ledger เดิม
- ถ้าผิดให้สร้าง reversal ledger
- ทุก movement ที่กระทบ stock ต้องมี ledger

---

## Job / JobLine

```prisma
model Job {
  id                Int      @id @default(autoincrement())
  job_no            String   @unique
  customer_cv        String?
  job_type           String   // DELIVERY, RETURN, MIXED, SURVEY
  status             String
  warehouse_id       Int
  created_by_id      Int
  assigned_to_id     Int?
  notifier           String?
  notification_date  DateTime?
  appointment_date   DateTime?
  note               String?
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt
}

model JobLine {
  id                  Int    @id @default(autoincrement())
  job_id              Int
  line_type           String // DELIVERY, RETURN, SERVICE
  item_id             Int?
  quantity            Int
  requested_condition String?
  return_reason       String?
  status              String
  requires_serial     Boolean @default(false)
}
```

ข้อดี:
- JobLine = แผน
- StockLedger = สิ่งที่เกิดจริง
- ลดปัญหานับ planned/issued/fulfilled ปนกัน

---

## CustomerInventory

```prisma
model CustomerInventory {
  id           Int      @id @default(autoincrement())
  customer_cv  String
  item_id      Int
  quantity     Int      @default(0)
  updated_at   DateTime @updatedAt

  @@unique([customer_cv, item_id])
}
```

ใช้กับ batch item ที่อยู่กับลูกค้า

---

## AssetUnit

```prisma
model AssetUnit {
  id                   Int      @id @default(autoincrement())
  item_id               Int
  asset_tag             String   @unique
  serial_number         String?  @unique
  status                String   // STOCK, RESERVED, IN_TRANSIT, WITH_CUSTOMER, QUARANTINE, REPAIR, SCRAP, LOST
  current_warehouse_id  Int?
  holder_customer_cv    String?
  condition             String?
  last_job_id           Int?
  note                  String?
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt
}
```

สำหรับตู้แช่ ต้องใช้ตัวนี้เป็นหลักเมื่อเข้าสู่ Phase รายชิ้น
