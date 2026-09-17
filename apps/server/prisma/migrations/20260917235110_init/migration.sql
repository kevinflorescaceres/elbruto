-- CreateTable
CREATE TABLE "Keeper" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keeper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "keeperId" TEXT,
    "claimTokenHash" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "endurance" INTEGER NOT NULL,
    "strength" INTEGER NOT NULL,
    "agility" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "weapons" TEXT[],
    "skills" TEXT[],
    "pets" TEXT[],
    "appearance" JSONB NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "fightsToday" INTEGER NOT NULL DEFAULT 0,
    "lastFightDay" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelUpChoice" (
    "id" TEXT NOT NULL,
    "bruteId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "options" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelUpChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fight" (
    "id" TEXT NOT NULL,
    "bruteAId" TEXT NOT NULL,
    "bruteBId" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "engineVersion" INTEGER NOT NULL,
    "snapshotA" JSONB NOT NULL,
    "snapshotB" JSONB NOT NULL,
    "log" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "bruteId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Keeper_tokenHash_key" ON "Keeper"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Brute_slug_key" ON "Brute"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Brute_claimTokenHash_key" ON "Brute"("claimTokenHash");

-- CreateIndex
CREATE INDEX "Brute_level_idx" ON "Brute"("level");

-- CreateIndex
CREATE INDEX "Brute_isBot_level_idx" ON "Brute"("isBot", "level");

-- CreateIndex
CREATE UNIQUE INDEX "LevelUpChoice_bruteId_key" ON "LevelUpChoice"("bruteId");

-- CreateIndex
CREATE INDEX "Fight_bruteAId_createdAt_idx" ON "Fight"("bruteAId", "createdAt");

-- CreateIndex
CREATE INDEX "Fight_bruteBId_createdAt_idx" ON "Fight"("bruteBId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_bruteId_idx" ON "Report"("bruteId");

-- AddForeignKey
ALTER TABLE "Brute" ADD CONSTRAINT "Brute_keeperId_fkey" FOREIGN KEY ("keeperId") REFERENCES "Keeper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelUpChoice" ADD CONSTRAINT "LevelUpChoice_bruteId_fkey" FOREIGN KEY ("bruteId") REFERENCES "Brute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_bruteAId_fkey" FOREIGN KEY ("bruteAId") REFERENCES "Brute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_bruteBId_fkey" FOREIGN KEY ("bruteBId") REFERENCES "Brute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Brute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_bruteId_fkey" FOREIGN KEY ("bruteId") REFERENCES "Brute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
