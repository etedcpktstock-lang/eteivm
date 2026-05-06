# Dashboard Overview Layout A

## Goal
Mockup สำหรับปรับหน้า `DesktopDashboard` ให้เห็นภาพรวมหลายมิติแบบ desktop control center โดยยังคงแนว corporate / plain / low-motion

## Design principles
- corporate light
- ไม่มี animation ที่ไม่จำเป็น
- card ชัด แต่ไม่หนา/ฟู
- อ่านจากซ้ายไปขวา: ภาพรวม -> ความเสี่ยง -> เจาะรายละเอียด
- ทุก section ควรตอบคำถามที่ต่างกัน

---

## Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ แดชบอร์ดภาพรวม                          ช่วงเวลา [7 วัน▼]   [Refresh]      │
│ ยินดีต้อนรับ... / วันที่ / subtitle                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ KPI พร้อมใช้ │ KPI ระหว่างส่ง │ KPI Quarantine │ KPI รอซ่อม                 │
│ KPI รอจำหน่าย │ KPI สูญหาย │ KPI รับเข้า 7 วัน │ KPI เบิกออก 7 วัน         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  แนวโน้มการเคลื่อนไหว (stacked bar / composed chart)      ALERTS           │
│  - รับเข้า                                                          - สูญหาย  │
│  - เบิกออก                                                          - รอซ่อม │
│  - รับคืน                                                           - ค้าง   │
│  - ยกเลิก                                                           - เสี่ยง │
│                                                                              │
│                                                           LOGISTICS SUMMARY  │
│                                                           - เปิดงานใหม่      │
│                                                           - กำลังดำเนินการ   │
│                                                           - งานค้าง          │
├──────────────────────────────────────────────────────────────────────────────┤
│ STOCK STATUS (donut)                 │ WAREHOUSE / ZONE COMPARISON          │
│ - พร้อมใช้                            │ - คลัง A                             │
│ - transit                             │ - คลัง B                             │
│ - quarantine                          │ - คลัง C                             │
│ - repair                              │ - คลัง D                             │
│ - scrap / lost                        │                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ TOP MOVERS / HOT ITEMS                │ RECENT ACTIVITY                       │
│ 1. ...                                │ เวลา | สถานะ | รายการ | ผู้ทำ | เขต  │
│ 2. ...                                │ ...                                   │
│ 3. ...                                │ ...                                   │
│ 4. ...                                │ ...                                   │
│ 5. ...                                │ ...                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Section spec

### 1) Header row
**Left**
- title: `แดชบอร์ดภาพรวม`
- subtitle: user + วันที่ + คำอธิบายสั้น

**Right**
- preset range buttons
- custom date
- refresh

### 2) KPI row
ต้องใช้ตัวเลขสั้น อ่านจบเร็วใน 1 แถว
- value ใหญ่
- label สั้น
- delta เล็ก optional
- กดแล้วพาไปหน้าเกี่ยวข้องได้

### 3) Main overview row
**Left: movement chart**
- section หลักของหน้า
- สูงประมาณ 300–320px
- ควรมี legend ชัด

**Right: alert + operations rail**
- panel บน = alerts
- panel ล่าง = logistics summary
- ใช้ list/card ไม่ใช้ chart ซ้ำมากเกินไป

### 4) Comparison row
**Left:** donut / pie
- ใช้อธิบายสัดส่วนภาพรวมปัจจุบัน

**Right:** comparison chart
- ถ้ามีข้อมูล warehouse ใช้ warehouse
- ถ้ายังไม่มี ใช้ zone/CV/activity แทนชั่วคราว

### 5) Detail row
**Left:** top movers
- เป็น list หรือ compact table
- ไม่ควรยาวเกิน 5–7 แถว

**Right:** recent activity
- ใช้ของเดิมได้ แต่ปรับความสูงและ header ให้บาลานซ์กับซ้าย

---

## Recommended desktop proportions
- Row 2 main split: 8 / 4
- Row 3 split: 5 / 7
- Row 4 split: 6 / 6

---

## Visual tokens
- card radius: 14–16px
- header text: slate-900
- subtitle text: slate-500
- section labels: 11–12px
- chart grid: เบา
- icon: ใช้เฉพาะจุดสำคัญ

---

## Notes for implementation
- เริ่มจากเพิ่ม mock section ด้วยข้อมูล derived จาก component เดิมก่อน
- ถ้าข้อมูลคลังยังไม่พร้อม ให้ใช้ fallback comparison panel
- อย่ารื้อ activity table เดิมก่อนจนกว่าส่วนบนจะนิ่ง
- ทุก widget ต้องมี empty state
