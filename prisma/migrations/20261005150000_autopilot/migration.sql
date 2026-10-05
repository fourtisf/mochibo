-- CreateEnum
CREATE TYPE "AutopilotEvery" AS ENUM ('HOURS6', 'DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "Autopilot" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "agentId" TEXT,
    "exampleId" VARCHAR(20),
    "name" VARCHAR(32) NOT NULL,
    "skillId" VARCHAR(20) NOT NULL,
    "task" VARCHAR(2000) NOT NULL,
    "every" "AutopilotEvery" NOT NULL,
    "minute" INTEGER NOT NULL,
    "weekday" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pausedReason" VARCHAR(200),
    "failures" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Autopilot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutopilotResult" (
    "id" TEXT NOT NULL,
    "autopilotId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "runId" TEXT,
    "status" VARCHAR(10) NOT NULL,
    "text" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutopilotResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Autopilot_enabled_nextRunAt_idx" ON "Autopilot"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "Autopilot_ownerId_idx" ON "Autopilot"("ownerId");

-- CreateIndex
CREATE INDEX "AutopilotResult_ownerId_createdAt_idx" ON "AutopilotResult"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "AutopilotResult_autopilotId_createdAt_idx" ON "AutopilotResult"("autopilotId", "createdAt");

-- AddForeignKey
ALTER TABLE "Autopilot" ADD CONSTRAINT "Autopilot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutopilotResult" ADD CONSTRAINT "AutopilotResult_autopilotId_fkey" FOREIGN KEY ("autopilotId") REFERENCES "Autopilot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

