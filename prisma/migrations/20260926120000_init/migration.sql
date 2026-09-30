-- CreateTable
CREATE TABLE "PoshRecord" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "act" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "totalEmployees" INTEGER,
    "completed" INTEGER,
    "lastTraining" TEXT,
    "comments" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoshRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUserRight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unit" TEXT,
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUserRight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT,
    "detail" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PoshRecord_year_idx" ON "PoshRecord"("year");

-- CreateIndex
CREATE UNIQUE INDEX "PoshRecord_year_act_unit_key" ON "PoshRecord"("year", "act", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE INDEX "AppUserRight_userId_idx" ON "AppUserRight"("userId");

-- CreateIndex
CREATE INDEX "AuditEvent_at_idx" ON "AuditEvent"("at");

-- CreateIndex
CREATE INDEX "AuditEvent_actorEmail_at_idx" ON "AuditEvent"("actorEmail", "at");

-- AddForeignKey
ALTER TABLE "AppUserRight" ADD CONSTRAINT "AppUserRight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

