-- RoleMaster — preset accounts. Apply once after schema.sql.
-- Apply with: wrangler d1 execute rolemaster-db --file=seed.sql --remote
--
-- Both passwords are "demo" — PBKDF2 SHA-256, 100k iterations, fixed salt below.
-- Suppliers self-register; only the curator + sales presets are seeded.

DELETE FROM users WHERE email IN ('grace@rolemaster.io', 'sales@rolemaster.io');

INSERT INTO users (id, email, password, salt, name, role, supplier_id) VALUES
  ('U-grace-rm', 'grace@rolemaster.io',
   '8ad15ed3c8a87945b3a1fa6b385f8337bd9fb6749094b0b55ad18602e25ae6b9',
   'f5d7ad77511a07ad74077a8ab180967b',
   'Grace Ho', 'curator', NULL),
  ('U-sales-rm', 'sales@rolemaster.io',
   '8ad15ed3c8a87945b3a1fa6b385f8337bd9fb6749094b0b55ad18602e25ae6b9',
   'f5d7ad77511a07ad74077a8ab180967b',
   'Sales Rep', 'sales', NULL);
