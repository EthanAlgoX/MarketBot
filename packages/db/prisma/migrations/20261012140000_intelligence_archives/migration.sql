BEGIN;

-- CreateTable
CREATE TABLE "intelligence_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "nextPollAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceId" TEXT,
    "includeTerms" TEXT[],
    "excludeTerms" TEXT[],
    "revision" INTEGER NOT NULL DEFAULT 1,
    "configHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_contents" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "sourceName" TEXT NOT NULL,
    "author" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "subscriptionSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "matchedTerms" TEXT[],
    "feedback" TEXT NOT NULL DEFAULT 'unread',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_feedback" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_briefs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'daily',
    "timezone" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "intelligence_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intelligence_sources_enabled_nextPollAt_idx" ON "intelligence_sources"("enabled", "nextPollAt");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_sources_userId_url_key" ON "intelligence_sources"("userId", "url");

-- CreateIndex
CREATE INDEX "intelligence_subscriptions_userId_enabled_idx" ON "intelligence_subscriptions"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_subscriptions_userId_configHash_key" ON "intelligence_subscriptions"("userId", "configHash");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_contents_sourceId_externalKey_hash_key" ON "intelligence_contents"("sourceId", "externalKey", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_contents_sourceId_externalKey_revision_key" ON "intelligence_contents"("sourceId", "externalKey", "revision");

-- CreateIndex
CREATE INDEX "intelligence_recommendations_userId_createdAt_idx" ON "intelligence_recommendations"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_recommendations_userId_contentId_key" ON "intelligence_recommendations"("userId", "contentId");

-- CreateIndex
CREATE INDEX "intelligence_briefs_userId_publishedAt_idx" ON "intelligence_briefs"("userId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_briefs_userId_date_kind_version_key" ON "intelligence_briefs"("userId", "date", "kind", "version");

-- AddForeignKey
ALTER TABLE "intelligence_sources" ADD CONSTRAINT "intelligence_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_subscriptions" ADD CONSTRAINT "intelligence_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_contents" ADD CONSTRAINT "intelligence_contents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "intelligence_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_recommendations" ADD CONSTRAINT "intelligence_recommendations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_recommendations" ADD CONSTRAINT "intelligence_recommendations_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "intelligence_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_feedback" ADD CONSTRAINT "intelligence_feedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "intelligence_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_briefs" ADD CONSTRAINT "intelligence_briefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
