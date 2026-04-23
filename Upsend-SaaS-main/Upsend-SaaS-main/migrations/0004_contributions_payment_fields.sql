-- Extend contributions table with payment tracking fields
ALTER TABLE contributions ADD COLUMN contributor_phone TEXT;
ALTER TABLE contributions ADD COLUMN contributor_email TEXT;
ALTER TABLE contributions ADD COLUMN message TEXT;
ALTER TABLE contributions ADD COLUMN transaction_id TEXT;
ALTER TABLE contributions ADD COLUMN payment_source TEXT DEFAULT 'direct'; -- 'direct' | 'pesapal'

-- Add unique index on transaction_id to prevent duplicate contributions
CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_transaction_id
  ON contributions(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- Also store contributor_message on pesapal_payments for passthrough
ALTER TABLE pesapal_payments ADD COLUMN contributor_message TEXT;
