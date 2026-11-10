CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT');

ALTER TABLE "notifications"
  ADD COLUMN "email_status" "EmailDeliveryStatus" NOT NULL DEFAULT 'SENT',
  ADD COLUMN "email_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "email_next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "email_lease_until" TIMESTAMPTZ(6),
  ADD COLUMN "email_lease_id" VARCHAR(64),
  ADD COLUMN "email_sent_at" TIMESTAMPTZ(6),
  ADD COLUMN "email_last_error" VARCHAR(1000);

ALTER TABLE "notifications"
  ALTER COLUMN "email_status" SET DEFAULT 'PENDING';

CREATE INDEX "notifications_email_status_email_next_attempt_at_idx"
  ON "notifications"("email_status", "email_next_attempt_at");

CREATE UNIQUE INDEX "role_applications_one_pending_per_user_key"
  ON "role_applications"("user_id")
  WHERE "status" = 'PENDING';
