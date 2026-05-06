-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "access_level" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "role" SET DEFAULT 'STAFF';
