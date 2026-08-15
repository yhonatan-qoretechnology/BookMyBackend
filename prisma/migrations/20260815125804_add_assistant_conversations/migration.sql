-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT,
    "tool_name" VARCHAR(100),
    "tool_call_id" TEXT,
    "tool_arguments" TEXT,
    "provider" VARCHAR(20),
    "model" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_conversations_user_id_idx" ON "assistant_conversations"("user_id");

-- CreateIndex
CREATE INDEX "assistant_conversations_created_at_idx" ON "assistant_conversations"("created_at");

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
