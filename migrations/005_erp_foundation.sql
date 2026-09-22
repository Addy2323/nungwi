CREATE TABLE suppliers (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '',
 phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
 payment_days INTEGER NOT NULL DEFAULT 30 CHECK(payment_days BETWEEN 0 AND 365),
 active BOOLEAN NOT NULL DEFAULT true, created_at TEXT NOT NULL
);
CREATE TABLE purchase_orders (
 id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, supplier_id TEXT NOT NULL REFERENCES suppliers(id),
 status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Approved','Partially received','Received','Cancelled')),
 notes TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL REFERENCES users(id), approved_by TEXT REFERENCES users(id),
 created_at TEXT NOT NULL, approved_at TEXT
);
CREATE TABLE purchase_items (
 id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL REFERENCES purchase_orders(id), product_id TEXT NOT NULL REFERENCES products(id),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 1000000), received INTEGER NOT NULL DEFAULT 0,
 unit_cost BIGINT NOT NULL CHECK(unit_cost BETWEEN 0 AND 1000000000),
 CHECK(received BETWEEN 0 AND quantity), UNIQUE(purchase_id,product_id)
);
CREATE TABLE purchase_receipts (
 id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES purchase_items(id), batch_id TEXT UNIQUE NOT NULL REFERENCES batches(id),
 quantity INTEGER NOT NULL CHECK(quantity>0), reference TEXT UNIQUE NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE supplier_bills (
 id TEXT PRIMARY KEY, purchase_id TEXT UNIQUE NOT NULL REFERENCES purchase_orders(id),
 reference TEXT NOT NULL, amount BIGINT NOT NULL CHECK(amount BETWEEN 1 AND 9007199254740991),
 due_date DATE NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE supplier_payments (
 id TEXT PRIMARY KEY, bill_id TEXT NOT NULL REFERENCES supplier_bills(id),
 amount BIGINT NOT NULL CHECK(amount BETWEEN 1 AND 9007199254740991),
 method TEXT NOT NULL CHECK(method IN ('cash','bank_transfer','mobile_money','card')),
 reference TEXT UNIQUE NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE customer_terms (
 user_id TEXT PRIMARY KEY REFERENCES users(id), payment_days INTEGER NOT NULL CHECK(payment_days BETWEEN 0 AND 365)
);
CREATE TABLE customer_invoices (
 id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, order_id TEXT UNIQUE NOT NULL REFERENCES orders(id),
 due_date DATE NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE finance_reconciliations (
 id TEXT PRIMARY KEY, source TEXT NOT NULL CHECK(source IN ('customer_payment','supplier_payment','expense','commission_payout')),
 source_id TEXT NOT NULL, statement_reference TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL, UNIQUE(source,source_id)
);
CREATE INDEX purchase_items_purchase_idx ON purchase_items(purchase_id);
CREATE INDEX supplier_payments_bill_idx ON supplier_payments(bill_id);
CREATE INDEX supplier_bills_due_idx ON supplier_bills(due_date);
CREATE INDEX customer_invoices_due_idx ON customer_invoices(due_date);
