/**
 * 🎯 Logistics Operational Constants
 * Centralized business rules and status mappings.
 */

export const TRANSACTION_STATUSES = {
  SURVEYING: 'สำรวจร้านค้า',
  DELIVERED: 'ส่งมอบเรียบร้อย',
  SUCCESS: 'สำเร็จ',
  CANCELLED: 'ยกเลิก',
};

export const POSSESSION_ACTIONS = {
  CONFIRMED_DELIVERY: ['ส่งมอบเรียบร้อย', 'สำเร็จ', 'SUCCESS', 'DELIVERED', 'ส่งเสร็จแล้ว'],
  LEAVING_SHOP: ['รับจากร้าน', 'รับจากลูกค้า', 'รับคืน', 'RECEIVE', 'RETURN', 'PICKUP', 'รอตรวจ', 'รอตรวจสอบ'],
};
