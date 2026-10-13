BEGIN;
ALTER TABLE "research_observations" ADD COLUMN "invalidationCondition" TEXT;
CREATE UNIQUE INDEX "research_observations_id_userId_key" ON "research_observations"("id", "userId");
CREATE TABLE "research_rule_drafts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "observationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "configuration" JSONB NOT NULL,
  "rule" JSONB NOT NULL,
  "researchSnapshot" JSONB NOT NULL,
  "researchSnapshotDigest" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "research_rule_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "research_rule_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "research_rule_drafts_observationId_userId_fkey" FOREIGN KEY ("observationId", "userId") REFERENCES "research_observations"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "research_rule_drafts_userId_idempotencyKey_key" ON "research_rule_drafts"("userId", "idempotencyKey");
CREATE INDEX "research_rule_drafts_userId_createdAt_idx" ON "research_rule_drafts"("userId", "createdAt");
COMMIT;
