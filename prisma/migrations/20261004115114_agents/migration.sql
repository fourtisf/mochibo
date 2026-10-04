-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "baseId" VARCHAR(20) NOT NULL DEFAULT 'juni',
ADD COLUMN     "deletedAt" TIMESTAMP(3);
