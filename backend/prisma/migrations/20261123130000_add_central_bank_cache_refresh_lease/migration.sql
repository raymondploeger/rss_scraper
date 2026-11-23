ALTER TABLE "central_bank_cache_state"
  ADD COLUMN "refreshGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX "central_bank_cache_state_leaseExpiresAt_idx"
  ON "central_bank_cache_state"("leaseExpiresAt");
