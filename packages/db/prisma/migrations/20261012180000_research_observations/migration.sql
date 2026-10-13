BEGIN;
CREATE TABLE "research_observations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "summary" TEXT,
  "validUntil" TIMESTAMP(3),
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "research_observations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "research_observations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "research_observations_userId_idempotencyKey_key" ON "research_observations"("userId", "idempotencyKey");
CREATE INDEX "research_observations_userId_createdAt_idx" ON "research_observations"("userId", "createdAt");
COMMIT;
