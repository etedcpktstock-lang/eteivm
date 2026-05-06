import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const totals = await prisma.warehouseStock.aggregate({
  _sum: {
    stock_qty: true,
    repair_qty: true,
    scrap_qty: true,
    lost_qty: true,
    quarantine_qty: true,
    transit_qty: true,
  },
});

const master = await prisma.masterItem.aggregate({ _sum: { stock_qty: true }, _count: true });
const rows = await prisma.warehouseStock.findMany({
  include: { item: { select: { id: true, item_name: true, brand: true, category: true, stock_qty: true } }, warehouse: { select: { id: true, name: true } } },
  orderBy: [{ item_id: 'asc' }, { warehouse_id: 'asc' }],
  take: 10,
});

const driftItems = await prisma.$queryRaw`
  SELECT mi.id, mi.item_name, mi.brand, mi.category, mi.stock_qty AS master_stock,
         COALESCE(SUM(ws.stock_qty),0)::int AS wh_stock,
         COALESCE(SUM(ws.repair_qty),0)::int AS repair,
         COALESCE(SUM(ws.quarantine_qty),0)::int AS quarantine,
         COALESCE(SUM(ws.transit_qty),0)::int AS transit
  FROM "MasterItem" mi
  LEFT JOIN "WarehouseStock" ws ON ws.item_id = mi.id
  GROUP BY mi.id
  HAVING mi.stock_qty <> COALESCE(SUM(ws.stock_qty),0)
  ORDER BY mi.id
  LIMIT 20
`;

console.log(JSON.stringify({
  masterItemCount: master._count,
  masterStockSum: master._sum.stock_qty ?? 0,
  warehouseStockSums: totals._sum,
  driftCountShown: driftItems.length,
  driftItems,
  sampleWarehouseRows: rows.map(r => ({ item_id: r.item_id, item: `${r.item?.brand ?? ''} ${r.item?.item_name ?? r.item?.category ?? ''}`.trim(), warehouse: r.warehouse?.name, stock: r.stock_qty, repair: r.repair_qty, quarantine: r.quarantine_qty, transit: r.transit_qty, master_stock: r.item?.stock_qty }))
}, null, 2));
await prisma.$disconnect();
