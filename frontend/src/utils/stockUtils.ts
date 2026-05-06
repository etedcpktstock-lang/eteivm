/**
 * 🏠 หาสต็อกที่พร้อมใช้ — fallback อัตโนมัติ
 * 1. หาในคลังที่ระบุ → เจอ = return
 * 2. ไม่เจอ (หรือไม่ได้ระบุ) → รวมทุกคลัง
 * 3. ไม่มี warehouse_stocks เลย → item.จำนวน
 */
export function getAvailableStock(
  item: any,
  warehouseId?: number | string | null
): number {
  const stocks = Array.isArray(item?.warehouse_stocks) ? item.warehouse_stocks : [];

  if (stocks.length === 0) {
    return Number(item?.จำนวน ?? item?.stock_qty ?? 0);
  }

  const targetWhId = Number(warehouseId || 0);

  if (targetWhId > 0) {
    const ws = stocks.find(
      (s: any) => Number(s.warehouseId ?? s.warehouse_id) === targetWhId
    );
    if (ws) return Number(ws.stock ?? ws.stock_qty ?? 0);
  }

  // fallback: รวมทุกคลัง
  return stocks.reduce(
    (sum, s) => sum + Number(s.stock ?? s.stock_qty ?? 0),
    0
  );
}
