const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function importItems() {
  const workbook = XLSX.readFile('/home/worakan8326/.hermes/cache/documents/doc_0f849ea30f2a_MasterInventory_1776794385351.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log('Found ' + data.length + ' rows in Excel file');
  
  let imported = 0;
  let skipped = 0;
  let errors = [];
  
  for (const row of data) {
    try {
      const category = row['ประเภท'] || '';
      const brand = row['ยี่ห้อหรือรูปแบบ'] || '';
      const itemName = row['รายการ'] || '';
      const condition = row['สภาพ'] || '';
      const details = row['รายละเอียด'] || '';
      const size = row['ขนาด'] || '';
      
      if (!category) {
        skipped++;
        continue;
      }
      
      // Check if exists - use all fields to match
      const existing = await prisma.masterItem.findFirst({
        where: { 
          category: category,
          brand: brand || null,
          item_name: itemName || null,
          size: size || null
        }
      });
      
      if (existing) {
        await prisma.masterItem.update({
          where: { id: existing.id },
          data: { 
            condition: condition || existing.condition,
            details: details || existing.details
          }
        });
        console.log('Updated: ' + category + ' - ' + brand);
        imported++;
      } else {
        // Don't specify id - let it auto-increment
        await prisma.masterItem.create({
          data: {
            category: category,
            brand: brand || null,
            item_name: itemName || null,
            condition: condition || null,
            details: details || null,
            size: size || null
          }
        });
        console.log('Created: ' + category + ' - ' + brand);
        imported++;
      }
    } catch (err) {
      errors.push('Error: ' + err.message);
    }
  }
  
  console.log('\n=== Summary ===');
  console.log('Imported: ' + imported);
  console.log('Skipped: ' + skipped);
  console.log('Errors: ' + errors.length);
}

importItems()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
