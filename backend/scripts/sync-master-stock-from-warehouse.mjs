import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const before = await prisma.$queryRaw`
  SELECT mi.id, mi.item_name, mi.brand, mi.category, mi.stock_qty AS master_stock,
         COALESCE(SUM(ws.stock_qty),0)::int AS wh_stock
  FROM "MasterItem" mi
  LEFT JOIN "WarehouseStock" ws ON ws.item_id = mi.id
  GROUP BY mi.id
  HAVING mi.stock_qty <> COALESCE(SUM(ws.stock_qty),0)
  ORDER BY mi.id
`;

await prisma.$executeRaw`
  UPDATE "MasterItem" mi
  SET stock_qty = src.wh_stock
  FROM (
    SELECT mi2.id, COALESCE(SUM(ws.stock_qty),0)::int AS wh_stock
    FROM "MasterItem" mi2
    LEFT JOIN "WarehouseStock" ws ON ws.item_id = mi2.id
    GROUP BY mi2.id
  ) src
  WHERE mi.id = src.id AND mi.stock_qty <> src.wh_stock
`;

const after = await prisma.$queryRaw`
  SELECT mi.id, mi.item_name, mi.brand, mi.category, mi.stock_qty AS master_stock,
         COALESCE(SUM(ws.stock_qty),0)::int AS wh_stock
  FROM "MasterItem" mi
  LEFT JOIN "WarehouseStock" ws ON ws.item_id = mi.id
  GROUP BY mi.id
  HAVING mi.stock_qty <> COALESCE(SUM(ws.stock_qty),0)
  ORDER BY mi.id
`;

console.log(JSON.stringify({ beforeCount: before.length, before, afterCount: after.length, after }, null, 2));
await prisma.$disconnect();
