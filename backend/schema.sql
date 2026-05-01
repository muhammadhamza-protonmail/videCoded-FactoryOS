CREATE TABLE invoices (
  invoice_id TEXT NOT NULL,
  invoice_no TEXT NOT NULL,
  date TEXT NOT NULL,
  customer_id TEXT,
  due_date TEXT,
  total_amount REAL,
  amount_paid REAL,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  balance_due REAL
);

CREATE TABLE customers (
  customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_limit REAL,
  balance_due REAL,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  remarks TEXT,
  factory_id TEXT DEFAULT 'factory_1'
);

CREATE TABLE vendors (
  vendor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  payment_terms TEXT,
  current_payable REAL,
  remarks TEXT,
  factory_id TEXT DEFAULT 'factory_1'
);

CREATE TABLE machines (
  machine_id TEXT NOT NULL,
  model TEXT,
  name TEXT,
  capacity_per_hr TEXT,
  status TEXT,
  last_service TEXT
);

CREATE TABLE products (
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
  remarks TEXT
);

CREATE TABLE invoice_items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  invoice_id TEXT,
  product_id TEXT,
  quantity INTEGER,
  unit_price REAL,
  line_total REAL
);

CREATE TABLE raw_materials (
  material_id TEXT NOT NULL,
  name TEXT NOT NULL,
  vendor_id TEXT,
  unit TEXT,
  current_stock REAL,
  reorder_level REAL,
  cost_per_unit REAL,
  remarks TEXT
);

CREATE TABLE production_logs (
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
  net_profit REAL
);

CREATE TABLE payments (
  payment_id TEXT NOT NULL,
  invoice_id TEXT,
  customer_id TEXT,
  date TEXT NOT NULL,
  amount REAL,
  method TEXT,
  receipt_no TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_movements (
  movement_id TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT,
  item_type TEXT,
  item_id TEXT,
  quantity REAL,
  unit TEXT,
  reference TEXT,
  notes TEXT
);

CREATE TABLE customer_ledger (
  customer_id TEXT,
  customer_name TEXT,
  date TEXT,
  description TEXT,
  debit REAL,
  credit REAL,
  running_balance REAL
);

CREATE TABLE factories (
  factory_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  role TEXT,
  factory_id TEXT,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id TEXT,
  module TEXT NOT NULL,
  can_view INTEGER,
  can_add INTEGER,
  can_edit INTEGER,
  can_delete INTEGER
);
