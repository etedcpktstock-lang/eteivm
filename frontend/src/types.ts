export interface MaterialItem {
  rowIndex?: number;
  id?: number;
  ประเภท: string;
  ยี่ห้อหรือรูปแบบ: string;
  รายการ: string;
  สภาพ: string;
  รายละเอียด: string;
  ขนาด: string;
  จำนวน: number;
  repair_qty: number;
  quarantine_qty: number;
  lost_qty: number;
  scrap_qty: number;
  transit_qty: number;
  tracking_type?: 'BATCH' | 'SERIALIZED' | string;
  item_name?: string;
  brand?: string;
  warehouseId?: number;
  warehouse_stocks?: {
    warehouseId: number;
    stock: number;
    repair: number;
    scrap: number;
    lost: number;
    quarantine: number;
    transit: number;
  }[];
}

export interface Transaction {
  id: string;
  item_id?: number;
  activity_name?: string;
  [key: string]: any;
  เลขที่รายการ: string;
  "วัน-เวลา": string;
  ผู้ทำรายการ: string;
  สถานะ: string;
  ประเภท: string;
  "ยี่ห้อ/รูปแบบ"?: string;
  "ยี่ห้อ/รายการ"?: string;
  รายการ: string;
  สภาพ: string;
  รายละเอียด: string;
  ขนาด: string;
  จำนวน: number;
  CV: string;
  เขตการทำงาน?: string;
  จัดส่งโดย: string;
  กำหนดส่ง: string;
  เวลานัดหมาย?: string;
  หมายเหตุ: string;
  "ผู้แจ้ง"?: string;
  "วันที่แจ้ง"?: string;
  "สาเหตุการคืน"?: string;
  "สภาพตู้"?: string;
  "เหตุผลการยกเลิก"?: string;
  "ยกเลิกโดย"?: string;
  serial_number?: string;
  distance_warning?: string;
  lat?: number;
  lng?: number;
}

export interface User {
  username: string;
  name: string;
  role: string;
}

export interface Zone {
  rowIndex?: number;
  name: string;
  description?: string;
}

export interface Customer {
  rowIndex?: number;
  cv: string;
  CV?: string;
  name: string;
  phone: string;
  address: string;
  subdistrict: string;
  sub_district?: string;
  district: string;
  province: string;
  zipcode: string;
  lat: string;
  lng: string;
  latitude?: string | number;
  longitude?: string | number;
  inventory?: any;
  image_url?: string;
}
