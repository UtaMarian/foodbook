-- CreateTable
CREATE TABLE "uploaded_images" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_images_object_key_key" ON "uploaded_images"("object_key");

-- CreateIndex
CREATE INDEX "uploaded_images_user_id_consumed_at_idx" ON "uploaded_images"("user_id", "consumed_at");

-- CreateIndex
CREATE INDEX "uploaded_images_consumed_at_created_at_idx" ON "uploaded_images"("consumed_at", "created_at");
