-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "ai_consent_at" TIMESTAMPTZ(3),
ADD COLUMN     "ai_suggestions" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ai_usage" (
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateTable
CREATE TABLE "ai_extraction_cache" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "cache_key" CHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_extraction_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_day_idx" ON "ai_usage"("day");

-- CreateIndex
CREATE INDEX "ai_extraction_cache_expires_at_idx" ON "ai_extraction_cache"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_extraction_cache_user_id_cache_key_key" ON "ai_extraction_cache"("user_id", "cache_key");

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_extraction_cache" ADD CONSTRAINT "ai_extraction_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraints (not modelled by Prisma; Prisma Migrate leaves them alone)
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_counts_check" CHECK (
  "requests" >= 0 AND "input_tokens" >= 0 AND "output_tokens" >= 0
);
