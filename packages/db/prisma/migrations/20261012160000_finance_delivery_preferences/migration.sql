BEGIN;

ALTER TABLE "intelligence_briefs"
  ADD COLUMN "totalCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "truncated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "correctionReason" TEXT;
UPDATE "intelligence_briefs" SET "totalCount" = jsonb_array_length("snapshot");

ALTER TABLE "finance_notifications"
  ADD COLUMN "pushStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "pushAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextPushAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastPushAt" TIMESTAMP(3),
  ADD COLUMN "leaseUntil" TIMESTAMP(3),
  ADD COLUMN "leaseToken" TEXT;
UPDATE "finance_notifications" SET "pushStatus" = 'muted' WHERE "kind" = 'integration.test';
CREATE INDEX "finance_notifications_pushStatus_nextPushAt_idx" ON "finance_notifications"("pushStatus", "nextPushAt");

CREATE TABLE "finance_preferences" (
  "userId" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  "digestHour" INTEGER NOT NULL DEFAULT 8 CHECK ("digestHour" BETWEEN 0 AND 23),
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "quietStart" INTEGER NOT NULL DEFAULT 22 CHECK ("quietStart" BETWEEN 0 AND 23),
  "quietEnd" INTEGER NOT NULL DEFAULT 8 CHECK ("quietEnd" BETWEEN 0 AND 23),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "finance_preferences_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "finance_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "finance_push_attempts" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'started',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "finance_push_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_push_attempts_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "finance_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "finance_push_attempts_deliveryId_key" ON "finance_push_attempts"("deliveryId");
CREATE INDEX "finance_push_attempts_notificationId_startedAt_idx" ON "finance_push_attempts"("notificationId", "startedAt");

COMMIT;
