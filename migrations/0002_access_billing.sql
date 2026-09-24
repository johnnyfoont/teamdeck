PRAGMA foreign_keys=ON;

ALTER TABLE organizations ADD COLUMN legal_name TEXT;
ALTER TABLE organizations ADD COLUMN inn TEXT;
ALTER TABLE organizations ADD COLUMN kpp TEXT;
ALTER TABLE organizations ADD COLUMN legal_address TEXT;
ALTER TABLE organizations ADD COLUMN billing_email TEXT;
ALTER TABLE organizations ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE organizations ADD COLUMN company_source TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_inn_unique ON organizations(inn) WHERE inn IS NOT NULL AND inn <> '';

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  interval TEXT NOT NULL DEFAULT 'month',
  price_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RUB',
  max_employees INTEGER,
  features_json TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'pending_payment',
  provider TEXT,
  provider_subscription_id TEXT,
  current_period_end TEXT,
  trial_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_org_active ON subscriptions(organization_id) WHERE status IN ('trial','active','past_due');

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  job_title TEXT,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS invitations_org_email ON invitations(organization_id, email);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
  number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'requested',
  billing_email TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  inn TEXT NOT NULL,
  kpp TEXT,
  legal_address TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  due_date TEXT,
  pdf_key TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);

INSERT OR IGNORE INTO plans (id,code,name,interval,price_minor,currency,max_employees,features_json) VALUES
  ('plan-starter','starter','Старт','month',490000,'RUB',10,'{"team":true,"vacancies":true,"analytics":false}'),
  ('plan-business','business','Бизнес','month',990000,'RUB',50,'{"team":true,"vacancies":true,"analytics":true}'),
  ('plan-enterprise','enterprise','Enterprise','month',0,'RUB',NULL,'{"team":true,"vacancies":true,"analytics":true,"custom":true}');
