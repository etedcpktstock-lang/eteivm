// ─── Logistics Status Constants (single source of truth) ───

export const WAITING_STATUSES = [
  'PENDING', 'รอรับงาน', 'รอส่ง', 'รอเครื่อง', 'รอรับคืน'
]

export const HISTORY_STATUSES = [
  'เสร็จสิ้น', 'ตรวจสอบแล้ว', 'ปิดงาน', 'คืนแล้ว', 'สำเร็จ',
  'SUCCESS', 'CLOSED', 'กำลังเดินทางกลับ', 'รับคืนจากร้าน'
] as const

export const TRANSIT_KEYWORDS = [
  'กำลังเดินทาง', 'เดินทาง', 'รับงาน', 'ACCEPTED', 'TRANSIT', 'กำลังไปส่ง', 'รอดำเนินการ'
]

// ─── Keywords for item classification ───

export const FREEZER_KEYWORDS = ['ตู้แช่', 'ตู้']
export const ACCESSORY_KEYWORDS = ['กุญแจ', 'ตะกร้า', 'อะไหล่', 'อุปกรณ์', 'อุปกรณ์ตู้']

// ─── Plan vs Action types ───

export const PLAN_TYPES = ['แจ้งส่ง', 'แจ้งคืน', 'ISSUE_REQUEST', 'RETURN_REQUEST']
export const TRANSIT_TYPES = ['รับงาน', 'ACCEPTED', 'TRANSIT', 'กำลังเดินทาง', 'กำลังไปส่ง', 'ถึงหน้าร้าน', 'ARRIVED']
export const DONE_STATUSES = ['สำเร็จ', 'CLOSED', 'SUCCESS', 'ยืนยันแล้ว', 'เดินทางกลับ', 'จากร้าน', 'ปิดงาน']

// ─── Item status mapping ───

export const CABINET_CONDITIONS = ['ปกติ', 'ส่งซ่อม', 'เสียหายหนัก', 'สูญหาย'] as const
export const RETURN_REASONS = [
  'ปิดการขาย (Sales Closed)',
  'ไม่มีออเดอร์ (No Orders)',
  'ของเสีย/ชำรุด (Broken/Damaged)',
  'อื่นๆ'
] as const
