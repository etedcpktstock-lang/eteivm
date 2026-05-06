-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ip_address" TEXT,
    "location" TEXT,
    "last_seen" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "role" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "Customer" (
    "cv" TEXT NOT NULL DEFAULT 'A100001',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "sub_district" TEXT,
    "district" TEXT,
    "province" TEXT,
    "zipcode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "image_url" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("cv")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItem" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "item_name" TEXT,
    "condition" TEXT,
    "details" TEXT,
    "size" TEXT,

    CONSTRAINT "MasterItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseStock" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "repair_qty" INTEGER NOT NULL DEFAULT 0,
    "scrap_qty" INTEGER NOT NULL DEFAULT 0,
    "lost_qty" INTEGER NOT NULL DEFAULT 0,
    "quarantine_qty" INTEGER NOT NULL DEFAULT 0,
    "transit_qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInventory" (
    "id" SERIAL NOT NULL,
    "customer_cv" TEXT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "job_id" TEXT NOT NULL,
    "customer_cv" TEXT,
    "job_type" TEXT NOT NULL,
    "operator_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivery_by" TEXT,
    "notification_date" TIMESTAMP(3),
    "notifier" TEXT,
    "appointment_date" TIMESTAMP(3),
    "warehouse_id" INTEGER,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "job_id" TEXT,
    "item_id" INTEGER,
    "operator_id" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "zone_name" TEXT,
    "return_reason" TEXT,
    "cabinet_status" TEXT,
    "cancel_reason" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serial_number" TEXT,
    "distance_warning" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "delivery_by" TEXT,
    "to_warehouse_id" INTEGER,
    "warehouse_id" INTEGER,
    "note" TEXT,
    "activity_name" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "name" TEXT NOT NULL,
    "details" TEXT,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "ip_address" TEXT,
    "location" TEXT,
    "user_agent" TEXT,
    "action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");

-- CreateIndex
CREATE INDEX "MasterItem_category_idx" ON "MasterItem"("category");

-- CreateIndex
CREATE INDEX "WarehouseStock_item_id_idx" ON "WarehouseStock"("item_id");

-- CreateIndex
CREATE INDEX "WarehouseStock_warehouse_id_idx" ON "WarehouseStock"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseStock_item_id_warehouse_id_key" ON "WarehouseStock"("item_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "CustomerInventory_item_id_idx" ON "CustomerInventory"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInventory_customer_cv_item_id_key" ON "CustomerInventory"("customer_cv", "item_id");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_customer_cv_idx" ON "Job"("customer_cv");

-- CreateIndex
CREATE INDEX "Job_created_at_idx" ON "Job"("created_at");

-- CreateIndex
CREATE INDEX "Transaction_job_id_idx" ON "Transaction"("job_id");

-- CreateIndex
CREATE INDEX "Transaction_item_id_idx" ON "Transaction"("item_id");

-- CreateIndex
CREATE INDEX "Transaction_operator_id_idx" ON "Transaction"("operator_id");

-- CreateIndex
CREATE INDEX "Transaction_created_at_idx" ON "Transaction"("created_at");

-- CreateIndex
CREATE INDEX "Transaction_action_type_idx" ON "Transaction"("action_type");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInventory" ADD CONSTRAINT "CustomerInventory_customer_cv_fkey" FOREIGN KEY ("customer_cv") REFERENCES "Customer"("cv") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInventory" ADD CONSTRAINT "CustomerInventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "MasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customer_cv_fkey" FOREIGN KEY ("customer_cv") REFERENCES "Customer"("cv") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "MasterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("job_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_zone_name_fkey" FOREIGN KEY ("zone_name") REFERENCES "Zone"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
