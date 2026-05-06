// ==========================================
// ETE DC PHUKET - Centralized Constants
// ==========================================

// คำนิยามสถานะพัสดุ (Item Status Dictionary)
// รวมทุกคำที่หน้าบ้านอาจจะส่งมา เพื่อดักจับให้เข้า Bucket ที่ถูกต้อง 100%
export const ITEM_STATUS = {
    NORMAL: ['รับเข้า', 'ปกติ', 'เพิ่มสต๊อก', 'รอตรวจ', 'ปกติ(รอตรวจ)', 'ส่งไม่สำเร็จ'],
    REPAIR: ['รอซ่อม', 'ตู้เสีย', 'เสีย', 'ส่งซ่อม'],
    SCRAP: ['ซาก', 'ชำรุดหนัก/ซาก', 'จำหน่ายซาก', 'รอจำหน่าย', 'ชำรุด', 'ชำรุดหนัก'],
    LOST: ['สูญหาย', 'หาย', 'ยืนยันสูญหาย'],
    QUARANTINE: ['รอตรวจ', 'quarantine', 'returned_to_base', 'ถึงออฟฟิศแล้ว', 'รับคืนแล้ว', 'สำเร็จ', 'ปกติ(รอตรวจ)', 'ส่งไม่สำเร็จ', 'ยกเลิก'],
    TRANSIT: ['กำลังเดินทาง', 'In Transit', 'ทาง', 'ไปส่ง', 'เบิก', 'รับจากร้าน']
} as const;

// คำนิยามสถานะใบงาน (Job Status Dictionary)
// สำหรับเช็คว่าเป็นกิจกรรมนอกพื้นที่หรือจบงานแล้ว
export const JOB_STATUS = {
    TRANSIT_ACTIVES: ['เดินทาง', 'transit', 'ทาง', 'กำลังไปส่ง', 'เบิก', 'หน้าร้าน', 'เครื่อง'],
    COMPLETED: ['เสร็จ', 'เรียบร้อย', 'สำเร็จ', 'ส่งแล้ว'],
    RETURNED_TO_BASE: ['ออฟฟิศ', 'คืนแล้ว', 'ตรวจ', 'ปิดงาน', 'เสร็จสิ้น', 'สำเร็จ', 'รับเข้า', 'นำคืน', 'ตีคืน'],
    PICKUP: ['ร้าน', 'รับคืน']
} as const;

/**
 * Utility function to check if a status string matches any in the dictionary array
 * Uses case-insensitive substring matching logic to be forgiving with UI inputs.
 */
export const statusMatches = (currentStatus: string, dictionaryArray: readonly string[]): boolean => {
    if (!currentStatus) return false;
    const lowerStatus = currentStatus.toLowerCase();
    return dictionaryArray.some(keyword => lowerStatus.includes(keyword.toLowerCase()));
};
