-- CreateTable
CREATE TABLE "extension_tokens" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extension_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extension_tokens_token_hash_key" ON "extension_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "extension_tokens_user_id_created_at_idx" ON "extension_tokens"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "extension_tokens_user_id_id_key" ON "extension_tokens"("user_id", "id");

-- AddForeignKey
ALTER TABLE "extension_tokens" ADD CONSTRAINT "extension_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
