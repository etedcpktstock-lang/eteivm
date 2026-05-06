# Desktop Transaction Workspaces Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** เปลี่ยนหน้า desktop ของ `รับพัสดุเข้าคลัง`, `แจ้งงาน / เบิกพัสดุ`, `เบิกพัสดุออกหน้างาน`, และ `รับคืนพัสดุ` จากการครอบ mobile form ด้วย `DesktopScopedPage` ไปเป็น desktop-native workspaces ที่อ่านง่ายขึ้น ใช้พื้นที่จอได้คุ้ม และไม่กระทบ business logic เดิม

**Architecture:** ใช้แนวทาง safe-first แบบ desktop-shell-first: แยก presentation ของ desktop ออกจาก mobile ก่อน, คง payload/validation/API semantics เดิมไว้, ดึง logic ร่วมออกเป็น hook/helper ทีละส่วน, แล้วค่อยย้าย desktop routes ใน `App.tsx` ไปใช้ component ใหม่โดยไม่แตะ mobile routes

**Tech Stack:** React, Vite, TypeScript, Tailwind/DaisyUI (เฉพาะ primitive), existing ETEIVM API layer, desktop CSS foundation ใน `frontend/src/styles/plain-ui.css`

---

## 1) สภาพปัจจุบันที่ตรวจแล้ว

### Routing ปัจจุบัน
ไฟล์ `frontend/src/App.tsx`
- mobile route ใช้ component โดยตรง:
  - `ReceiveForm`
  - `IssueForm`
  - `ReturnForm`
  - `JobRequestForm`
- desktop route ยังเป็นเพียง wrapper:
  - `DesktopScopedPage + ReceiveForm`
  - `DesktopScopedPage + IssueForm`
  - `DesktopScopedPage + ReturnForm`
  - `DesktopScopedPage + JobRequestForm`

### Component desktop ที่มีอยู่แล้ว
โฟลเดอร์ `frontend/src/components/desktop/`
- `DesktopInventory.tsx`
- `DesktopHistory.tsx`
- `DesktopReports.tsx`
- `DesktopLogisticsBoard.tsx`
- `DesktopReviewBoard.tsx`
- `DesktopTransactionWorkstation.tsx` *(มี prototype แต่ยังไม่ถูกใช้งานจริง)*
- `DesktopScopedPage.tsx`

### ข้อสรุปจากโค้ดปัจจุบัน
1. ตอนนี้ desktop transaction pages ยัง “mobile-first” อยู่จริง
2. `DesktopTransactionWorkstation.tsx` ใช้เป็น reference ได้ แต่ยังไม่ครอบคลุม workflow จริงของ `IssueForm / ReturnForm / JobRequestForm`
3. ถ้า rewrite ตรง ๆ ทีเดียวมีความเสี่ยง เพราะ 4 หน้าเหล่านี้มี logic ค่อนข้างลึก เช่น
   - localStorage resume state
   - cart/sub-items
   - logistics job binding
   - scanner / serial / asset tag
   - customer lookup / quick edit
   - return reason / photos / geostamp
4. ดังนั้นควรแยกเป็น **desktop-native shell + shared transactional hooks/adapters** มากกว่าก๊อปโค้ดใหม่ทั้งก้อน

---

## 2) คำตอบเชิงออกแบบ: “ควรทำไหม?”

**ควรทำครับ** แต่ควรทำแบบ “desktop-native, safe-first, phase-by-phase”

### เหตุผล
- ผู้ใช้ฝั่ง desktop เป็น admin / operator-at-PC ต้องการมุมมองควบคุม ไม่ใช่ mobile step form ที่แค่ถูกยืดจอ
- 4 หน้านี้เป็นกลุ่มงานปฏิบัติการหลัก จึงควรมี:
  - toolbar แนวนอน
  - split layout
  - list/table + detail + cart/summary
  - sticky action area
  - customer/job context ที่มองเห็นพร้อมกัน
- ถ้ายังใช้ mobile component ครอบต่อไป จะเจอปัญหาเดิม ๆ:
  - ช่องว่างเยอะ
  - ฟอร์มยาวเกินจอ
  - ต้อง scroll ขึ้นลงหลายรอบ
  - operator มองความสัมพันธ์ของข้อมูลยาก

### สิ่งที่ไม่ควรทำ
- ไม่ควรเอา mobile form เดิมมายืด CSS อย่างเดียว
- ไม่ควรเปลี่ยน payload/API semantics พร้อมกับเปลี่ยน UI ในรอบเดียว
- ไม่ควรทำทั้ง 4 หน้าพร้อมกันแบบ rewrite ใหญ่

---

## 3) Desktop design language ที่ควรใช้กับทั้ง 4 หน้า

## Shared layout pattern
ทุกหน้าใช้โครงแบบนี้:

1. **Page header**
   - title
   - subtitle
   - status pill / last save / last sync
   - quick actions

2. **Context toolbar**
   - warehouse selector
   - customer / CV search
   - job selector (ถ้ามี)
   - date/time
   - refresh / reset / draft tools

3. **Main split workspace**
   - ซ้าย: item picker / search result / job items / customer list
   - กลาง: form builder / cart / editable lines
   - ขวา: context panel / summary / validation / action panel

4. **Sticky action footer or right-rail action box**
   - จำนวนรายการ
   - ตรวจเงื่อนไขไม่ครบอะไรบ้าง
   - ปุ่มบันทึก
   - ปุ่มล้าง draft
   - ปุ่มดูข้อมูลที่เกี่ยวข้อง

## Shared visual rules
- desktop dense, low-motion
- ไม่มี animation เกินจำเป็น
- เน้น table/list + side panels
- ใช้ card เฉพาะ section สำคัญ
- แยก “ข้อมูลต้นทาง” กับ “ข้อมูลที่จะ submit” ให้ชัด
- ใช้สีเตือนเฉพาะ validation / risky action

---

## 4) แบบใหม่รายหน้า

## A. DesktopReceiveWorkspace
**แทน:** `DesktopScopedPage + ReceiveForm`

### เป้าหมาย UX
ทำให้การรับเข้าคลังเป็น “โต๊ะรับเข้า” ไม่ใช่ฟอร์มยาว

### Layout
- ซ้าย 40%: item search / recent receive templates / stock reference
- กลาง 35%: receive cart table
- ขวา 25%: receive context panel + submit

### Sections
1. **Toolbar บนสุด**
   - เลือกคลัง
   - ผู้รับเข้า
   - วันที่/เวลา
   - note สั้น
   - reset draft

2. **Item catalog panel**
   - search by ชื่อ / ประเภท / ยี่ห้อ / ขนาด / S/N / Asset Tag
   - filter by warehouse / tracking type
   - row action: เพิ่มเข้าตะกร้า

3. **Receive cart table**
   - รายการ
   - tracking type
   - จำนวน
   - sub-items
   - serial/asset identifiers (ถ้ามี)
   - ลบ / แก้ไข

4. **Right summary panel**
   - CV (optional)
   - ผู้ส่ง/ผู้นำส่ง
   - เขตงาน
   - note
   - quick customer preview
   - validation checklist
   - submit button

### จุดต่างจาก mobile
- ไม่ใช้ step form
- ให้เห็น item list + cart + metadata พร้อมกัน
- success state เป็น compact inline success card แทน full-screen takeover

---

## B. DesktopJobRequestWorkspace
**แทน:** `DesktopScopedPage + JobRequestForm`

### เป้าหมาย UX
ทำให้หน้าแจ้งงานเป็น “job builder + customer context + outbound/return plan”

### Layout
- ซ้าย 30%: customer search + customer quick profile
- กลาง 40%: job composition (รายการส่ง / รายการรับคืน)
- ขวา 30%: appointment + summary + submit

### Sections
1. **Customer command panel**
   - search CV / ชื่อลูกค้า
   - recent customers
   - quick edit / add customer
   - address / phone / map summary

2. **Job composition workspace**
   - tabs: `รายการส่ง`, `รายการรับคืน`
   - item selector table
   - add serial / scan asset tag inline
   - compact draft rows with qty + sub-items

3. **Job summary rail**
   - appointment date/time
   - warehouse source
   - note / return reason
   - generated job preview
   - checklist: ลูกค้าครบ? มีรายการส่ง/คืนหรือไม่? นัดหมายครบไหม?

### จุดต่างจาก mobile
- ลูกค้าไม่ควรซ่อนอยู่ใน flow ลึก ต้องเห็นตลอด
- รายการส่ง/คืนควรเทียบกันได้บนจอเดียว
- เหมาะกับ admin ที่ต้องวางแผนก่อนส่งงานให้ภาคสนาม

---

## C. DesktopIssueWorkspace
**แทน:** `DesktopScopedPage + IssueForm`

### เป้าหมาย UX
ทำให้หน้าเบิกเป็น “pick-pack-issue workstation” สำหรับผูกงาน/ลูกค้า/คลังแบบตรวจสอบได้

### Layout
- ซ้าย 32%: pending jobs + selected job context
- กลาง 38%: stock picker / scan / line items
- ขวา 30%: issue cart + submit summary

### Sections
1. **Job queue panel**
   - pending jobs filter by CV / customer / date / status
   - select job แล้ว preload items/context
   - quick jump from logistics board รองรับเหมือนเดิม

2. **Stock picker panel**
   - search items
   - show warehouse-ready qty ชัดเจน
   - badge บอก `BATCH / SERIALIZED`
   - scan S/N / Asset Tag inline

3. **Issue cart / execution panel**
   - รายการที่จะเบิก
   - จำนวนคงเหลือเทียบจำนวนที่จะใช้
   - customer / CV / เขตงาน / ผู้ส่ง
   - appointment / note / photo
   - validation ก่อน submit

### จุดต่างจาก mobile
- job context และ stock context ต้องเห็นพร้อมกัน
- ไม่ควรสลับหน้าไปมาเพื่อเช็ก job / stock / cart
- operator desktop ควรเห็น “งานที่เลือก”, “สต็อกที่พร้อม”, “ของที่กำลังจะตัด” พร้อมกัน

---

## D. DesktopReturnWorkspace
**แทน:** `DesktopScopedPage + ReturnForm`

### เป้าหมาย UX
ทำให้หน้ารับคืนเป็น “return intake + inspection + routing desk”

### Layout
- ซ้าย 30%: jobs pending return / return source
- กลาง 40%: returned items table + scan + quantity/status
- ขวา 30%: return reason / inspection / next-state summary

### Sections
1. **Return source panel**
   - เลือกจาก job ที่ค้าง
   - filter ตาม CV / ลูกค้า / ผู้แจ้ง / วันที่
   - prefill item lines จาก job ได้

2. **Returned items execution panel**
   - line-by-line return items
   - scan serial / asset tag
   - ระบุสภาพ
   - เพิ่มรายการพิเศษนอก job
   - mark ว่าเข้า stock / quarantine / repair ต่อ

3. **Inspection + submit panel**
   - ผู้แจ้งคืน
   - วันที่แจ้ง
   - เหตุผลการคืน
   - สภาพตู้/พัสดุ
   - รูปหลักฐาน
   - summary ว่าหลัง submit จะไป flow ไหน

### จุดต่างจาก mobile
- หน้า return ต้องเหมือนโต๊ะคัดแยก ไม่ใช่ฟอร์มยาว
- ต้องโชว์ “รายการจาก job” กับ “รายการรับจริง” ให้เทียบกันง่าย
- ควรเห็น next-state ชัด เช่น รับเข้าสต็อก / รอตรวจ / รอซ่อม

---

## 5) Shared components ที่ควรสร้าง

## New desktop components
สร้างใน `frontend/src/components/desktop/`

- `DesktopReceiveWorkspace.tsx`
- `DesktopJobRequestWorkspace.tsx`
- `DesktopIssueWorkspace.tsx`
- `DesktopReturnWorkspace.tsx`

## Shared primitives
สร้างชุด reusable ก่อน
- `DesktopWorkspaceShell.tsx`
- `DesktopContextRail.tsx`
- `DesktopStickyActions.tsx`
- `DesktopItemSearchPanel.tsx`
- `DesktopCartTable.tsx`
- `DesktopCustomerSummaryCard.tsx`
- `DesktopJobSummaryCard.tsx`
- `DesktopValidationChecklist.tsx`

## Shared hooks/adapters
ถ้าเริ่มย้าย logic ควรแยกที่ `frontend/src/hooks/` หรือ `frontend/src/components/desktop/hooks/`
- `useDesktopTransactionDraft.ts`
- `useDesktopCustomerLookup.ts`
- `useDesktopJobContext.ts`
- `useDesktopItemSearch.ts`

## Important rule
**ห้ามย้าย API semantics เข้า component ใหม่โดยตรงแบบ copy-paste ทั้งก้อน**
ควรค่อย ๆ extract:
- payload builders
- validation functions
- draft persistence
- job prefill logic
- cart merge logic

---

## 6) แผนลงมือแบบปลอดภัย

## Phase 1 — foundation
**เป้าหมาย:** สร้าง shell และ shared desktop primitives โดยยังไม่เปลี่ยน route จริง

### งาน
1. เพิ่ม desktop transaction style tokens ใน `plain-ui.css`
2. สร้าง `DesktopWorkspaceShell.tsx`
3. สร้าง `DesktopContextRail.tsx`
4. สร้าง `DesktopStickyActions.tsx`
5. reuse กับ mock data / shallow adapters ก่อน

### Verify
- `npm run build`
- เปิดหน้าเดโมหรือ temporary route เพื่อดู shell จริง

---

## Phase 2 — Receive ก่อน
**เป้าหมาย:** ทำ `DesktopReceiveWorkspace` เป็นหน้าแรก เพราะ logic ตรงที่สุดและเสี่ยงน้อยสุด

### งาน
1. ใช้ `ReceiveForm` เป็น source logic reference
2. ย้ายเฉพาะ desktop presentation ก่อน
3. คง `processBatchTransaction` payload เดิม
4. คง localStorage draft semantics เดิมเท่าที่จำเป็น
5. เปลี่ยน desktop route `activeTab === 'receive'` ไปใช้ `DesktopReceiveWorkspace`

### Verify
- build ผ่าน
- browser smoke: รับรายการเข้าคลัง 1 ชุด
- เช็ก transaction เกิดจริง

---

## Phase 3 — Job Request
**เป้าหมาย:** ทำ `DesktopJobRequestWorkspace` โดยเน้น customer + job composition

### งาน
1. แยก customer lookup summary block
2. แยก send cart / return cart panels
3. คง saveJobRequest semantics เดิม
4. ทำ job summary rail ฝั่งขวา

### Verify
- build ผ่าน
- สร้าง job ได้
- logistics board มองเห็น job ที่สร้างใหม่

---

## Phase 4 — Issue
**เป้าหมาย:** ทำ `DesktopIssueWorkspace` โดยยังรักษา logistics preselect flow เดิม

### งาน
1. แยก pending jobs panel
2. แยก selected job context card
3. แยก stock picker table + cart panel
4. คง `initialJobId`, `setLogisticsSubTab`, `setPreSelectedLogisticsJobId` flow เดิม

### Verify
- build ผ่าน
- เปิดจาก logistics board แล้ว job preload ได้
- เบิกสำเร็จ, stock ลดถูก warehouse

---

## Phase 5 — Return
**เป้าหมาย:** ทำ `DesktopReturnWorkspace` เป็นตัวสุดท้าย เพราะ logic ซับซ้อนสุด

### งาน
1. แยก return job source panel
2. แยก returned items execution grid
3. แยก inspection + routing panel
4. คง prefill จาก job และ return reason mapping เดิม

### Verify
- build ผ่าน
- เปิดจาก logistics board แล้ว preload return job ได้
- รับคืนสำเร็จและ routing downstream ถูก

---

## 7) Routing target ใน App.tsx

### ปัจจุบัน desktop
- `receive` -> `DesktopScopedPage + ReceiveForm`
- `issue` -> `DesktopScopedPage + IssueForm`
- `return` -> `DesktopScopedPage + ReturnForm`
- `job-request` -> `DesktopScopedPage + JobRequestForm`

### เป้าหมาย
- `receive` -> `DesktopReceiveWorkspace`
- `issue` -> `DesktopIssueWorkspace`
- `return` -> `DesktopReturnWorkspace`
- `job-request` -> `DesktopJobRequestWorkspace`

**หมายเหตุ:** mobile routes ต้องคงเดิมทั้งหมด

---

## 8) Acceptance criteria

ถือว่าสำเร็จเมื่อ:

1. desktop ทั้ง 4 หน้าไม่ใช่แค่ mobile wrapper แล้ว
2. แต่ละหน้ามี desktop-native layout อย่างน้อย 3 ส่วน:
   - source/context
   - working area
   - summary/actions
3. mobile route เดิมไม่พัง
4. payload/API semantics เดิมยังถูกต้อง
5. build ผ่านทุก phase
6. browser smoke test ผ่านทุกหน้า
7. logistics jump flows (`issue` / `return`) ยังทำงาน

---

## 9) ข้อเสนอแนะเชิงตัดสินใจ

ถ้าจะเริ่มจริง ผมแนะนำลำดับนี้:
1. `รับพัสดุเข้าคลัง`
2. `แจ้งงาน / เบิกพัสดุ`
3. `เบิกพัสดุออกหน้างาน`
4. `รับคืนพัสดุ`

เหตุผล:
- ง่าย -> ยาก
- จาก flow ที่พึ่งพา job น้อย ไปหา flow ที่พึ่งพา logistics มาก
- ลดความเสี่ยง regression

---

## 10) ไฟล์ที่คาดว่าจะต้องแตะ

### Modify
- `frontend/src/App.tsx`
- `frontend/src/styles/plain-ui.css`

### Create
- `frontend/src/components/desktop/DesktopWorkspaceShell.tsx`
- `frontend/src/components/desktop/DesktopContextRail.tsx`
- `frontend/src/components/desktop/DesktopStickyActions.tsx`
- `frontend/src/components/desktop/DesktopItemSearchPanel.tsx`
- `frontend/src/components/desktop/DesktopCartTable.tsx`
- `frontend/src/components/desktop/DesktopCustomerSummaryCard.tsx`
- `frontend/src/components/desktop/DesktopJobSummaryCard.tsx`
- `frontend/src/components/desktop/DesktopValidationChecklist.tsx`
- `frontend/src/components/desktop/DesktopReceiveWorkspace.tsx`
- `frontend/src/components/desktop/DesktopJobRequestWorkspace.tsx`
- `frontend/src/components/desktop/DesktopIssueWorkspace.tsx`
- `frontend/src/components/desktop/DesktopReturnWorkspace.tsx`

### Possible extraction targets later
- `frontend/src/hooks/useDesktopTransactionDraft.ts`
- `frontend/src/hooks/useDesktopCustomerLookup.ts`
- `frontend/src/hooks/useDesktopJobContext.ts`
- `frontend/src/hooks/useDesktopItemSearch.ts`

---

## 11) Recommendation

**สรุป:** ทำครับ และควรทำเป็น desktop-native ใหม่เลย ไม่ใช่แค่ห่อ mobile form ต่อ

แต่ให้ทำแบบ **phase-by-phase + safe-first**
- เริ่มจาก `Receive`
- แล้ว `Job Request`
- แล้ว `Issue`
- ปิดท้าย `Return`

แบบนี้จะได้ UI desktop ที่คุมงานง่ายขึ้นมาก โดยไม่เสี่ยงพังทั้งระบบในรอบเดียว
