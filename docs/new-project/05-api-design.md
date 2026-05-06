# 05 - API Design

## หลักการ API

1. ทุก endpoint ที่กระทบ stock ต้องทำใน DB transaction
2. ทุก request ต้อง validate ด้วย schema เช่น Zod
3. ทุก stock movement ต้องสร้าง StockLedger
4. ใช้ `idempotencyKey` กันกดซ้ำ
5. Error ต้องเป็นภาษาไทยและบอกวิธีแก้

---

## Auth

```text
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

## Master Data

```text
GET    /api/items
POST   /api/items
PATCH  /api/items/:id
GET    /api/warehouses
POST   /api/warehouses
PATCH  /api/warehouses/:id
GET    /api/customers
POST   /api/customers
PATCH  /api/customers/:cv
```

## Stock

```text
GET  /api/stocks
GET  /api/stocks/summary
GET  /api/stocks/ledger
POST /api/stocks/receive
POST /api/stocks/reserve
POST /api/stocks/unreserve
POST /api/stocks/issue
POST /api/stocks/transfer
POST /api/stocks/adjust
```

### POST /api/stocks/issue

Request:

```json
{
  "warehouseId": 3,
  "jobId": 123,
  "items": [
    { "itemId": 96, "quantity": 1, "assetTag": "AST-001" }
  ],
  "operatorId": 1,
  "idempotencyKey": "job:123:issue:item:96:1"
}
```

Response:

```json
{
  "status": "success",
  "message": "เบิกพัสดุสำเร็จ",
  "ledgerIds": [1001]
}
```

## Jobs

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

### POST /api/jobs

Request:

```json
{
  "customerCv": "312677000",
  "warehouseId": 3,
  "jobType": "MIXED",
  "deliveryLines": [
    { "itemId": 96, "quantity": 3 }
  ],
  "returnLines": [
    { "itemId": 90, "quantity": 3, "returnReason": "ของเสีย/ชำรุด" }
  ],
  "notifier": "Sale A",
  "appointmentDate": "2026-04-29T09:00:00+07:00"
}
```

## Repair / Review

```text
GET  /api/reviews/quarantine
POST /api/reviews/:id/mark-available
POST /api/reviews/:id/mark-repair
POST /api/reviews/:id/mark-scrap
POST /api/reviews/:id/mark-lost
```

## Asset Unit

```text
GET  /api/assets
GET  /api/assets/:assetTag
POST /api/assets
PATCH /api/assets/:id
GET  /api/assets/:id/timeline
```

## Reports

```text
GET /api/reports/stock-on-hand
GET /api/reports/stock-movement
GET /api/reports/customer-possession
GET /api/reports/logistics-aging
GET /api/reports/repair-aging
GET /api/reports/low-stock
GET /api/reports/export.xlsx
GET /api/reports/export.pdf
```

## Error Response Standard

```json
{
  "status": "error",
  "code": "INSUFFICIENT_STOCK",
  "message": "สต็อกคลังหลักไม่พอสำหรับ LIEBHERR 105cm เหลือ 2 ต้องการ 3",
  "details": {
    "warehouseId": 3,
    "itemId": 96,
    "available": 2,
    "required": 3
  }
}
```

## API Pitfalls ที่ต้องกัน

- ไม่รับ `warehouseId` จาก client แบบมั่ว ถ้าเป็น Job ต้องยึด warehouse ของ Job
- ห้ามให้ frontend ส่งสถานะที่ backend ตีความผิด เช่น `รอตรวจ` ตอนรับคืนจากร้าน
- ต้องแยก endpoint action ชัดเจน เช่น pickup-return vs return-to-office
- ห้ามให้ `processBatch` รับ payload กว้างเกินจน logic ปนกัน
