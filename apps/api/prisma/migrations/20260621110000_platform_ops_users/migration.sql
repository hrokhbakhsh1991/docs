-- P1-G: platform operator directory (phone + role).
CREATE TABLE "platform_ops_users" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_ops_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_ops_users_phone_key" ON "platform_ops_users"("phone");
