export const MOBILE_DATABASE_NAME = 'factoryos_mobile';

export const mobileSchemaSql = `
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id TEXT NOT NULL,
  invoice_no TEXT NOT NULL,
  date TEXT NOT NULL,
  customer_id TEXT,
  due_date TEXT,
  total_amount REAL,
  amount_paid REAL,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  balance_due REAL,
  factory_id TEXT DEFAULT 'factory_1'
);

CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  credit_limit REAL,
  balance_due REAL,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  remarks TEXT,
  factory_id TEXT DEFAULT 'factory_1',
  email TEXT
);

CREATE TABLE IF NOT EXISTS vendors (
  vendor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  payment_terms TEXT,
  current_payable REAL,
  remarks TEXT,
  factory_id TEXT DEFAULT 'factory_1',
  email TEXT
);

CREATE TABLE IF NOT EXISTS machines (
  machine_id TEXT NOT NULL,
  model TEXT,
  name TEXT,
  capacity_per_hr TEXT,
  status TEXT,
  last_service TEXT,
  factory_id TEXT DEFAULT 'factory_1'
);

CREATE TABLE IF NOT EXISTS products (
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  sale_price REAL,
  current_stock INTEGER,
  reorder_level INTEGER,
  status TEXT,
  material_id TEXT,
  units_per_bag REAL,
  rm_ratio_qty REAL,
  product_ratio_qty REAL,
  remarks TEXT,
  factory_id TEXT DEFAULT 'factory_1'
);

CREATE TABLE IF NOT EXISTS invoice_items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  invoice_id TEXT,
  product_id TEXT,
  quantity INTEGER,
  unit_price REAL,
  line_total REAL,
  factory_id TEXT
);

CREATE TABLE IF NOT EXISTS raw_materials (
  material_id TEXT NOT NULL,
  name TEXT NOT NULL,
  vendor_id TEXT,
  unit TEXT,
  current_stock REAL,
  reorder_level REAL,
  cost_per_unit REAL,
  remarks TEXT,
  factory_id TEXT DEFAULT 'factory_1'
);

CREATE TABLE IF NOT EXISTS production_logs (
  log_id TEXT NOT NULL,
  date TEXT NOT NULL,
  shift TEXT,
  machine_id TEXT,
  product_id TEXT,
  material_id TEXT,
  bags_consumed INTEGER,
  mat_cost REAL,
  units_produced INTEGER,
  elec_units REAL,
  elec_cost REAL,
  shift_expense REAL,
  other_expense REAL,
  total_sale_value REAL,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  net_profit REAL,
  factory_id TEXT DEFAULT 'factory_1'
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT NOT NULL,
  invoice_id TEXT,
  customer_id TEXT,
  date TEXT NOT NULL,
  amount REAL,
  method TEXT,
  receipt_no TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  factory_id TEXT DEFAULT 'factory_1'
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  movement_id TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT,
  item_type TEXT,
  item_id TEXT,
  quantity REAL,
  unit TEXT,
  reference TEXT,
  notes TEXT,
  factory_id TEXT DEFAULT 'factory_1',
  unit_price NUMERIC(14,2),
  total_amount NUMERIC(14,2),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_ledger (
  customer_id TEXT,
  customer_name TEXT,
  date TEXT,
  description TEXT,
  debit REAL,
  credit REAL,
  running_balance REAL,
  factory_id TEXT DEFAULT 'factory_1'
);

CREATE TABLE IF NOT EXISTS factories (
  factory_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS global_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT DEFAULT 'Factory Management System',
  logo_url TEXT DEFAULT '/uploads/logo.png',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  role TEXT,
  factory_id TEXT,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id TEXT,
  module TEXT NOT NULL,
  can_view INTEGER,
  can_add INTEGER,
  can_edit INTEGER,
  can_delete INTEGER
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  resource TEXT NOT NULL,
  record_id TEXT,
  payload TEXT,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL UNIQUE,
  last_pulled_at TEXT,
  last_pushed_at TEXT,
  last_remote_change_at TEXT
);
`;
