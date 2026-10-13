CREATE TABLE "finance_event_cursors" (
  "userId" TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "issuer" TEXT NOT NULL,
  "streamId" TEXT,
  "sequence" BIGINT NOT NULL DEFAULT 0 CHECK ("sequence" >= 0),
  "status" TEXT NOT NULL DEFAULT 'ready',
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "finance_event_inbox" (
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "eventId" TEXT NOT NULL,
  "streamId" TEXT NOT NULL,
  "sequence" BIGINT NOT NULL CHECK ("sequence" > 0),
  "kind" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "eventId"),
  UNIQUE ("userId", "streamId", "sequence")
);
CREATE TABLE "finance_notifications" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "eventId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "readAt" TIMESTAMP(3),
  UNIQUE ("userId", "eventId")
);
CREATE INDEX "finance_notifications_userId_recordedAt_idx" ON "finance_notifications"("userId", "recordedAt");
