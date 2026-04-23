-- Pesapal payments table
CREATE TABLE IF NOT EXISTS pesapal_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  contributor_name TEXT,
  contributor_email TEXT,
  contributor_phone TEXT,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'KES',
  merchant_reference TEXT UNIQUE NOT NULL,
  order_tracking_id TEXT,
  pesapal_status TEXT DEFAULT 'PENDING',
  payment_method TEXT,
  description TEXT,
  redirect_url TEXT,
  ipn_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pesapal_payments_event_id ON pesapal_payments(event_id);
CREATE INDEX IF NOT EXISTS idx_pesapal_payments_merchant_reference ON pesapal_payments(merchant_reference);
CREATE INDEX IF NOT EXISTS idx_pesapal_payments_order_tracking_id ON pesapal_payments(order_tracking_id);
