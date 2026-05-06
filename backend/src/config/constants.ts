// ─── Logistics Status Constants ───

export const WAITING_STATUSES = [
  'PENDING', 'รอรับงาน', 'รอส่ง', 'รอเครื่อง', 'รอรับคืน'
] as const

export const ACTIVE_STATUSES = [
  'ACCEPTED', 'รับงานแล้ว', 'กำลังเดินทาง', 'IN_TRANSIT', 'ถึงหน้าร้านแล้ว', 'ARRIVED', 'กำลังไปส่ง'
] as const

export const HISTORY_STATUSES = [
  'เสร็จสิ้น', 'ตรวจสอบแล้ว', 'ปิดงาน', 'คืนของแล้ว', 'คืนแล้ว', 'สำเร็จ',
  'SUCCESS', 'CLOSED', 'เดินทางกลับ', 'รับคืนแล้ว', 'รอตรวจ', 'กำลังเดินทางกลับ',
  'รับคืนจากร้าน'
] as const

// ─── Action Types ───

export const PLAN_TYPES = [
  'แจ้งส่ง', 'แจ้งคืน', 'ISSUE_REQUEST', 'RETURN_REQUEST'
] as const

export const ISSUE_TYPES = [
  'เบิกออก', 'ISSUE', 'ส่งแล้ว'
] as const

export const RETURN_TYPES = [
  'คืน', 'RETURN', 'RECEIVE', 'รับคืน'
] as const

export const TRANSIT_TYPES = [
  'รับงาน', 'ACCEPTED', 'TRANSIT', 'กำลังเดินทาง', 'กำลังไปส่ง', 'ถึงหน้าร้าน', 'ARRIVED'
] as const

// ─── Job Types ───

export const JOB_TYPES = {
  DELIVERY: 'DELIVERY',
  RETURN: 'RETURN',
  MIXED: 'MIXED'
} as const

// ─── Item Category Keywords ───

export const FREEZER_KEYWORDS = ['ตู้แช่', 'ตู้']
export const ACCESSORY_KEYWORDS = ['กุญแจ', 'ตะกร้า', 'อะไหล่', 'อุปกรณ์ตู้']

// ─── Default Admin Credentials (for seed) ───

export const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  name: 'ผู้ดูแลระบบ',
  role: 'ADMIN'
} as const
