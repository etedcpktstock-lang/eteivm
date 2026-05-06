# Dashboard Overview Revamp Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** ปรับ `frontend/src/components/desktop/DesktopDashboard.tsx` ให้เป็น dashboard overview ที่เห็นภาพรวมหลายมิติขึ้น โดยเพิ่ม layout เชิงบริหาร, widget สำคัญ, กราฟที่ตอบคำถามงานคลัง/โลจิสติกส์, และคง business logic/API เดิมให้มากที่สุด

**Architecture:** ใช้แนวทาง safe-first แบบ presentation-led refactor: คง source data เดิมจาก `items` / `transactions` / `allRepair` / `allScrap` / `allLost`, แยก derived dashboard selectors ด้วย `useMemo`, แล้วค่อยเพิ่ม section/widget ใหม่แบบเป็นก้อนย่อยที่ตรวจ build และ runtime ได้ทีละ phase โดยยังไม่แตะ mobile dashboard ในรอบแรก

**Tech Stack:** React, TypeScript, Vite, Recharts, Lucide React, plain desktop CSS tokens / DaisyUI primitives, existing ETEIVM data model

---

## 1) Current file baseline

**Files already identified**
- Modify: `frontend/src/components/desktop/DesktopDashboard.tsx`
- Reference: `frontend/src/components/mobile/MobileDashboard.tsx`
- Reference: `frontend/src/components/desktop/DesktopReports.tsx`
- Optional styles: `frontend/src/styles/plain-ui.css`
- Optional app wiring only if needed later: `frontend/src/App.tsx`

**Current dashboard already has**
- KPI grid 8 cards
- date range selector
- range KPI cards
- 1 trend chart (bar)
- recent activity table

**Current dashboard still lacks**
- stock status composition
- warehouse/DC comparison
- logistics status summary
- alert rail / aging / backlog visibility
- comparison vs previous period
- top movers / top problem areas

---

## 2) Design target

Desktop dashboard should answer these questions within one screen:
1. ตอนนี้ stock อยู่ในสถานะอะไรบ้าง?
2. งานเคลื่อนไหวช่วงนี้เป็นอย่างไร?
3. คลังไหน/พื้นที่ไหนมี movement หรือความเสี่ยงสูง?
4. มีอะไรค้าง/ผิดปกติที่ต้องรีบจัดการ?
5. รายการล่าสุดที่กระทบงานปฏิบัติการคืออะไร?

---

## 3) Phase roadmap

### Phase A — Blueprint / Mockup / Layout lock
**Outcome:** ได้ผัง layout และชื่อ widget ที่จะทำ โดยยังไม่แตะ business logic

### Phase B — Executive summary + alerts
**Outcome:** ปรับแถวบนและเพิ่ม alert rail

### Phase C — Multi-view charts
**Outcome:** เพิ่ม stock composition + warehouse comparison + enhanced movement chart

### Phase D — Drill-friendly operational panels
**Outcome:** เพิ่ม top movers / aging / logistics summary / click-throughs

### Phase E — Cleanup + regression verification
**Outcome:** build ผ่าน, runtime verified, mobile unaffected, comparison chart ใช้ชื่อคลังจริงและมี click interaction เพิ่ม

### Phase F — Component extraction / maintainability
**Outcome:** แยก presentation subcomponents ออกจาก `DesktopDashboard.tsx`, build ผ่าน, runtime verified, behavior เดิมยังอยู่

### Phase G — Chart cards extraction
**Outcome:** แยก chart cards (`DashboardStockCompositionCard`, `DashboardComparisonChartCard`) ไป `DesktopDashboardCharts.tsx`, build ผ่าน, runtime verified

### Phase H — Shared type consolidation
**Outcome:** ดึง types ทั้งหมดของ dashboard ไป `DesktopDashboard.types.ts` (DashboardAlert, RangePreset, KpiCard, ComparisonData, ฯลฯ), build ผ่าน, runtime verified

### Phase I — Trend card extraction
**Outcome:** แยก trend chart + range KPI + controls ออกจาก `DesktopDashboard.tsx` ไป `DesktopDashboardTrendCard.tsx`, build ผ่าน, runtime verified — ไฟล์หลักเหลือ 553 บรรทัด business logic ล้วน ๆ

### Phase J — CSS token consolidation
**Outcome:** สร้าง `dashboard-tokens.css` (dash-val, dash-label, dash-subtle, dash-surface, dash-pill, ฯลฯ), แทนที่ inline styles ซ้ำ ๆ ในทุกไฟล์, build ผ่าน, runtime verified

---

## 4) Proposed dashboard layout (desktop)

### Row 1 — Executive summary
- KPI: พร้อมใช้งาน
- KPI: ระหว่างส่ง
- KPI: Quarantine
- KPI: รอซ่อม
- KPI: รอจำหน่าย
- KPI: สูญหาย
- KPI: รับเข้า 7 วัน
- KPI: เบิกออก 7 วัน

### Row 2 — Main overview split
- Left 8 cols: movement trend chart (stacked bar or composed)
- Right 4 cols: alert rail + logistics summary cards

### Row 3 — State + comparison
- Left 5 cols: stock status composition (donut/pie)
- Middle 7 cols: warehouse/DC comparison chart
- Optional lower strip: previous-period comparison mini KPIs

### Row 4 — Detail insights
- Left 6 cols: top moving items / top active customers or zones
- Right 6 cols: recent activity table

---

## 5) Data widgets to add

### Widget A: Alert rail
**Objective:** แสดงสิ่งที่ต้องรีบดูทันที

**Derived from:** `items`, `transactions`, aggregate props

**Initial alert set**
- พัสดุสูญหาย > 0
- รอจำหน่าย > 0
- รอซ่อมเกิน threshold
- ระหว่างส่งสูงผิดปกติ
- รับคืนสูงในช่วงล่าสุด

**Phase-1 rule:** ใช้ threshold จากค่าที่มีอยู่ก่อน ยังไม่สร้าง settings schema ใหม่

### Widget B: Stock status composition
**Objective:** เห็นสัดส่วนสถานะปัจจุบันทันที

**Data**
- available/normal stock
- transit
- quarantine
- repair
- scrap
- lost

**Note:** ถ้ายังไม่มี field available ชัดเจน ให้ใช้ total items / derived counts ที่เชื่อถือได้ในรอบแรกและติดป้ายให้ตรงความหมาย

### Widget C: Warehouse/DC comparison
**Objective:** เห็นคลังไหนถือภาระ/ความเสี่ยงมาก

**Dependency check:** ต้องสำรวจก่อนว่าข้อมูล warehouse อยู่ใน `items`/`transactions` แค่ไหน

**Fallback:** ถ้า aggregate ตามคลังยังไม่พร้อม ให้ phase แรกใช้ top work zones / top CV movement แทน

### Widget D: Logistics summary
**Objective:** ทำให้ dashboard ตอบโจทย์ operation มากขึ้น

**Phase-1 fallback:** หาก dashboard data ยังไม่มี job status ตรง ๆ ให้เริ่มจาก transaction statuses ที่สะท้อน flow ก่อน และค่อยขยับไปผูก logistics board data ใน phase ถัดไป

### Widget E: Top movers
**Objective:** ระบุรายการที่เคลื่อนไหวสูงสุด

**Candidate grouping keys**
- `รายการ`
- `ประเภท`
- `ยี่ห้อหรือรูปแบบ`
- `เขตการทำงาน`
- `CV`

---

## 6) Bite-sized implementation tasks

### Task 1: Snapshot current dashboard data shape
**Objective:** ระบุ field ที่ `DesktopDashboard.tsx` ใช้อยู่และ field ที่พอใช้สร้าง widget ใหม่ได้

**Files:**
- Modify later: `frontend/src/components/desktop/DesktopDashboard.tsx`
- Inspect: `frontend/src/types.ts`

**Verification:** อ่านโค้ดแล้วจดรายการ field ที่มีจริงก่อนเริ่ม phase ลงมือ

### Task 2: Lock layout blueprint
**Objective:** สร้าง mockup document สำหรับ row/section/widget

**Files:**
- Create: `docs/mockups/dashboard-overview-layout-a.md`

**Verification:** เปิดอ่านแล้วเห็น row/column structure ครบ

### Task 3: Extract dashboard selectors mentally/in-code plan
**Objective:** กำหนด selector blocks ที่จะแยกใน component

**Planned selectors**
- `overviewKpis`
- `movementTrendData`
- `stockCompositionData`
- `alertItems`
- `warehouseComparisonData`
- `topMoversData`

**Verification:** selectors map กับ widget ทุกตัวแบบ 1:1

### Task 4: Add alert rail section
**Objective:** เพิ่ม plain-card ด้านขวาของกราฟหลัก

**Files:**
- Modify: `frontend/src/components/desktop/DesktopDashboard.tsx`

**Verification:** build ผ่านและ alert ไม่ทำให้ layout พังเมื่อข้อมูลว่าง

### Task 5: Add stock composition chart
**Objective:** เพิ่ม donut/pie สัดส่วนสถานะพัสดุ

**Files:**
- Modify: `frontend/src/components/desktop/DesktopDashboard.tsx`

**Verification:** build ผ่าน, chart render ได้, legend อ่านง่าย

### Task 6: Add warehouse comparison or fallback comparison
**Objective:** เพิ่มกราฟเปรียบเทียบมิติที่สองของ dashboard

**Files:**
- Modify: `frontend/src/components/desktop/DesktopDashboard.tsx`

**Verification:** ถ้าข้อมูล warehouse ยังไม่พร้อม ให้ fallback เป็น top zones พร้อม label ชัดเจน

### Task 7: Add top movers panel
**Objective:** เพิ่ม insight table/list ที่กดอ่านง่าย

**Files:**
- Modify: `frontend/src/components/desktop/DesktopDashboard.tsx`

**Verification:** มี list อย่างน้อย 5 อันดับ และ state ว่างไม่พัง

### Task 8: Refine KPI semantics and period deltas
**Objective:** เพิ่มความหมายเชิงเปรียบเทียบของ KPI โดยไม่ทำ UI รก

**Files:**
- Modify: `frontend/src/components/desktop/DesktopDashboard.tsx`

**Verification:** delta card อ่านออกใน 3 วินาที และไม่มี animation

### Task 9: Build and runtime verify
**Objective:** ยืนยันว่า desktop dashboard render จริงด้วย Vite runtime ไม่ใช่แค่ source diff

**Commands:**
- `cd /mnt/c/Users/Rocket Star/Desktop/ETEIVM/frontend && npm run build`
- เปิด `http://127.0.0.1:5173/?_ts=<fresh>`

**Expected:** build ผ่าน, ไม่มี JS error สำคัญ, mobile route ไม่ได้รับผลกระทบ

---

## 7) Acceptance criteria

- desktop dashboard เห็นอย่างน้อย 4 มิติ: summary / trend / composition / alerts
- มีอย่างน้อย 2 visualizations นอกเหนือจากกราฟแท่งเดิม
- layout ใช้พื้นที่ desktop คุ้มขึ้นและยังอ่านง่าย
- ไม่มีการเปลี่ยน API contract
- mobile dashboard ยังไม่ถูกแก้ในรอบนี้
- `npm run build` ผ่าน
- runtime verification ผ่านหลัง hard reload / cache-busting URL

---

## 8) Risks and guardrails

### Risks
- ใช้ field ที่ไม่ได้มีจริงในข้อมูล live
- chart เยอะเกินจนรก
- layout แตกเมื่อข้อมูลเป็น 0 หรือ empty
- Vite/HMR เสิร์ฟ code เก่า

### Guardrails
- ใช้ derived selectors จาก fields ที่พิสูจน์แล้วเท่านั้น
- เพิ่มทีละ section และ build ทุก phase
- มี empty states ทุก widget
- ถ้าพฤติกรรมไม่ตรง source ให้รีสตาร์ต dev server แล้ว verify runtime อีกครั้ง

---

## 9) Mockup path

- Layout blueprint: `docs/mockups/dashboard-overview-layout-a.md`
- Detailed implementation plan: `docs/plans/2026-05-03-dashboard-overview-revamp.md`

---

## 10) Recommended execution order

1. lock blueprint
2. inspect exact data fields
3. implement alert rail
4. implement composition chart
5. implement comparison chart
6. implement top movers
7. polish KPI labels and deltas
8. build + browser verify
