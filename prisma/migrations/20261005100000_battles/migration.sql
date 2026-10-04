-- AlterEnum (IF NOT EXISTS: PostgreSQL 12+ allows this inside the migration transaction)
ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'BATTLE_DEBIT';
ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'BATTLE_REFUND';
ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'BATTLE_PRIZE';

-- CreateEnum
CREATE TYPE "BattleMode" AS ENUM ('ROAST', 'DEBATE');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('RUNNING', 'OPEN', 'CLOSED', 'FAILED');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "battleWins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "starterId" TEXT NOT NULL,
    "mode" "BattleMode" NOT NULL,
    "topic" VARCHAR(200) NOT NULL,
    "aAgentId" TEXT,
    "aExampleId" VARCHAR(20),
    "aName" VARCHAR(32) NOT NULL,
    "aCharacter" JSONB NOT NULL,
    "aSlug" TEXT,
    "aBaseId" VARCHAR(20) NOT NULL DEFAULT 'juni',
    "aThumb" TEXT,
    "bAgentId" TEXT,
    "bExampleId" VARCHAR(20),
    "bName" VARCHAR(32) NOT NULL,
    "bCharacter" JSONB NOT NULL,
    "bSlug" TEXT,
    "bBaseId" VARCHAR(20) NOT NULL DEFAULT 'juni',
    "bThumb" TEXT,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "status" "BattleStatus" NOT NULL DEFAULT 'RUNNING',
    "cost" BIGINT NOT NULL,
    "votesA" INTEGER NOT NULL DEFAULT 0,
    "votesB" INTEGER NOT NULL DEFAULT 0,
    "winner" TEXT,
    "endsAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleVote" (
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" VARCHAR(1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleVote_pkey" PRIMARY KEY ("battleId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Battle_slug_key" ON "Battle"("slug");

-- CreateIndex
CREATE INDEX "Battle_status_endsAt_idx" ON "Battle"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Battle_createdAt_idx" ON "Battle"("createdAt");

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_starterId_fkey" FOREIGN KEY ("starterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleVote" ADD CONSTRAINT "BattleVote_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleVote" ADD CONSTRAINT "BattleVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

