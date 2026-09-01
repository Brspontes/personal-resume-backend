-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('ARTICLE_VIEW', 'ARTICLE_PROGRESS', 'ARTICLE_READ');

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "eventType" "AnalyticsEventType" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "progress" INTEGER,
    "durationSeconds" INTEGER,
    "maxProgress" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_articleId_sessionId_eventType_createdAt_idx" ON "AnalyticsEvent"("articleId", "sessionId", "eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
