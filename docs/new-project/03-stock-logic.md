# 03 - Stock Logic

## เป้าหมาย

ให้สต็อกถูกต้องเสมอ โดยแยกสถานะชัดเจนและห้ามยอดติดลบ

## Stock Buckets

| Bucket | ความหมาย |
|---|---|
| Available | พร้อมเบิก/พร้อมใช้ |
| Reserved | จองให้ใบงานแล้ว |
| In Transit | ระหว่างขนส่ง |
| With Customer | อยู่กับลูกค้า |
| Quarantine | รอตรวจ |
| Repair | รอซ่อม/กำลังซ่อม |
| Scrap | ตีซาก/รอจำหน่าย |
| Lost | สูญหาย |

## Movement Rules

### Receive

```text
External -> Available
External -> Quarantine ถ้าต้องตรวจก่อน
```

### Reserve

```text
Available -> Reserved
```

ใช้เมื่อสร้างใบงานและต้องกันของไว้

### Issue / Pick

```text
Reserved -> In Transit
หรือ Available -> In Transit ถ้าไม่ใช้ reserve
```

### Fulfill Delivery

```text
In Transit -> With Customer
CustomerInventory +qty
```

### Pickup Return

```text
With Customer -> In Transit
CustomerInventory -qty
```

### Return to Office

```text
In Transit -> Quarantine
```

### Admin Review

```text
Quarantine -> Available
Quarantine -> Repair
Quarantine -> Scrap
Quarantine -> Lost
```

### Repair Done

```text
Repair -> Available
```

### Transfer Warehouse

```text
Warehouse A Available -> Transit
Transit -> Warehouse B Available
```

## Non-negative Rule

ก่อน update ต้องตรวจว่า source bucket พอหรือไม่

ตัวอย่าง:

```text
ถ้าจะเบิก 3 จาก Available แต่เหลือ 2 → block
ถ้าจะส่งมอบ 3 จาก Transit แต่มี 1 → block
ถ้าจะรับคืนจากลูกค้า 2 แต่ CustomerInventory มี 0 → block หรือ require admin override
```

## Idempotency

ทุก action ที่กระทบ stock ต้องมี `idempotency_key`

ตัวอย่าง key:

```text
job:{jobNo}:line:{lineId}:action:issue:user:{userId}
```

ถ้า user กดซ้ำ ระบบต้องตอบ success เดิมหรือ skip ไม่หักซ้ำ

## Reconciliation

ควรมีคำสั่งตรวจยอด:

```text
sum(StockLedger) เทียบ WarehouseStock
sum(CustomerInventory) เทียบ AssetUnit WITH_CUSTOMER
JobLine planned เทียบ issued/fulfilled
```

## Error Message Guideline

ไม่ควรบอกแค่ “สต็อกไม่พอ” ต้องบอก:

- คลังไหน
- รายการอะไร
- เหลือเท่าไร
- ต้องการเท่าไร
- ต้องแก้ยังไง

ตัวอย่าง:

```text
พัสดุยังไม่ได้เบิกครบ ไม่สามารถส่งมอบได้
แจ้งส่ง 3 / เบิกแล้ว 1 / คงเหลือต้องเบิก 2
```

```text
สต็อกคลัง "คลังหลัก" ไม่พอสำหรับ LIEBHERR 105cm
พร้อมใช้เหลือ 2 แต่ต้องการเบิก 3
```

## Lessons from ETEIVM

1. ห้ามใช้ warehouseId จาก localStorage เป็นหลัก
2. Job ต้องมี warehouse_id เสมอ
3. Item matching ต้องใช้ item_id ก่อน text
4. รับคืนจากร้าน != รอตรวจ
5. ห้ามส่งมอบถ้ายังเบิกไม่ครบ
6. หน้า stock ต้องไม่ทำให้ของ 0 ดูเหมือนหาย
