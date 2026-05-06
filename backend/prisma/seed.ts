import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create default admin (SUPER_ADMIN)
  const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: 'ผู้ดูแลระบบ',
        role: 'SUPER_ADMIN',
        access_level: 4
      }
    })
    console.log('  ✅ SUPER_ADMIN created (admin / admin123)')
  } else {
    // Update existing admin to SUPER_ADMIN if needed
    if (adminExists.role !== 'SUPER_ADMIN' || adminExists.access_level !== 4) {
      await prisma.user.update({
        where: { username: 'admin' },
        data: { role: 'SUPER_ADMIN', access_level: 4 }
      })
      console.log('  ✅ Admin updated to SUPER_ADMIN (access_level 4)')
    } else {
      console.log('  ⏭️  SUPER_ADMIN already exists')
    }
  }

  // Define full permission keys
  const ALL_PERMISSIONS = {
    // Dashboard & Overview
    dashboard_view: true,
    // Inventory
    inventory_view: true,
    inventory_edit: true,
    // Transactions
    receive: true,
    issue: true,
    return: true,
    transfer: true,
    void_transaction: true,
    // Job Request
    job_request: true,
    // Logistics
    logistics_view: true,
    logistics_manage: true,
    // History & Audit
    history_view: true,
    history_view_all: true,
    audit_view: true,
    // Reports & Export
    reports_view: true,
    reports_export: true,
    // Customer Management
    customers_view: true,
    customers_edit: true,
    // Repair Management
    repair_view: true,
    repair_manage: true,
    // Settings & System
    settings_view: true,
    settings_edit: true,
    // User & Role Management
    users_manage: true,
    permissions_manage: true,
    // Mobile Navigation
    btn_inventory: true,
    btn_receive: true,
    btn_issue: true,
    btn_return: true,
    btn_job_request: true,
    btn_history: true,
    btn_repair: true,
    btn_settings: true,
    nav_home: true,
    // History filters
    history_show_receive: true,
    history_show_issue: true,
    history_show_return: true,
    history_show_void: true,
    // Settings tabs
    set_items: true,
    set_zones: true,
    set_customers: true,
    set_users: true,
    set_notifications: true,
    set_ota: true,
  }

  const ADMIN_PERMISSIONS = {
    ...ALL_PERMISSIONS,
    users_manage: false,        // ADMIN can't manage other admins
    permissions_manage: false,  // ADMIN can't edit permissions
  }

  const OFFICER_PERMISSIONS = {
    dashboard_view: true,
    inventory_view: true,
    inventory_edit: false,
    receive: true,
    issue: true,
    return: true,
    transfer: true,
    void_transaction: true,
    job_request: true,
    logistics_view: true,
    logistics_manage: true,
    history_view: true,
    history_view_all: true,
    audit_view: false,
    reports_view: true,
    reports_export: true,
    customers_view: true,
    customers_edit: true,
    repair_view: true,
    repair_manage: true,
    settings_view: false,
    settings_edit: false,
    users_manage: false,
    permissions_manage: false,
    btn_inventory: true,
    btn_receive: true,
    btn_issue: true,
    btn_return: true,
    btn_job_request: true,
    btn_history: true,
    btn_repair: true,
    btn_settings: false,
    nav_home: true,
    history_show_receive: true,
    history_show_issue: true,
    history_show_return: true,
    history_show_void: true,
    set_items: false,
    set_zones: false,
    set_customers: false,
    set_users: false,
    set_notifications: false,
    set_ota: false,
  }

  const STAFF_PERMISSIONS = {
    dashboard_view: true,
    inventory_view: true,
    inventory_edit: false,
    receive: true,
    issue: true,
    return: true,
    transfer: false,
    void_transaction: false,
    job_request: true,
    logistics_view: true,
    logistics_manage: false,
    history_view: true,
    history_view_all: false,
    audit_view: false,
    reports_view: false,
    reports_export: false,
    customers_view: true,
    customers_edit: false,
    repair_view: true,
    repair_manage: false,
    settings_view: false,
    settings_edit: false,
    users_manage: false,
    permissions_manage: false,
    btn_inventory: true,
    btn_receive: true,
    btn_issue: true,
    btn_return: true,
    btn_job_request: true,
    btn_history: true,
    btn_repair: true,
    btn_settings: false,
    nav_home: true,
    history_show_receive: true,
    history_show_issue: true,
    history_show_return: true,
    history_show_void: false,
    set_items: false,
    set_zones: false,
    set_customers: false,
    set_users: false,
    set_notifications: false,
    set_ota: false,
  }

  // Create default role permissions
  const roles = [
    { role: 'SUPER_ADMIN', permissions: ALL_PERMISSIONS, description: 'ผู้ดูแลระบบสูงสุด — ทุกสิทธิ์', access_level: 4 },
    { role: 'ADMIN', permissions: ADMIN_PERMISSIONS, description: 'ผู้ดูแลระบบ — จัดการได้ทุกอย่างยกเว้นสิทธิ์', access_level: 3 },
    { role: 'OFFICER', permissions: OFFICER_PERMISSIONS, description: 'เจ้าหน้าที่ปฏิบัติการ — รับ/เบิก/คืน/ขนส่ง', access_level: 2 },
    { role: 'STAFF', permissions: STAFF_PERMISSIONS, description: 'พนักงานทั่วไป — ปฏิบัติงานพื้นฐาน', access_level: 1 },
  ]

  for (const r of roles) {
    await prisma.rolePermission.upsert({
      where: { role: r.role },
      update: { permissions: r.permissions, description: r.description },
      create: { role: r.role, permissions: r.permissions, description: r.description },
    })
    console.log(`  ✅ Role: ${r.role} (level ${r.access_level})`)
  }

  // Migrate existing users to proper access levels
  const allUsers = await prisma.user.findMany()
  for (const user of allUsers) {
    let newRole = user.role
    let newLevel = user.access_level || 1

    // Map old roles to new
    if (user.role === 'ADMIN' && user.access_level < 3) {
      // If user is admin but level < 3, check: admin user gets SUPER_ADMIN
      if (user.username === 'admin') {
        newRole = 'SUPER_ADMIN'
        newLevel = 4
      } else {
        newRole = 'ADMIN'
        newLevel = 3
      }
    } else if (user.role === 'OPERATOR') {
      newRole = 'OFFICER'
      newLevel = 2
    } else if (user.role === 'VIEWER') {
      newRole = 'STAFF'
      newLevel = 1
    }

    if (newRole !== user.role || newLevel !== (user.access_level || 1)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: newRole, access_level: newLevel }
      })
      console.log(`  🔄 Migrated user ${user.name} (${user.username}): ${user.role} → ${newRole} (level ${newLevel})`)
    }
  }

  // Create default warehouse if not exists
  const whExists = await prisma.warehouse.findUnique({ where: { name: 'คลังหลัก' } })
  if (!whExists) {
    await prisma.warehouse.create({
      data: { name: 'คลังหลัก', is_active: true }
    })
    console.log('  ✅ Default warehouse: คลังหลัก')
  }

  console.log('✅ Seeding complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
