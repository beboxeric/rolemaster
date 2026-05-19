-- Add contact-person fields to supplier_company_info.
-- These are personal data, not language-split.

ALTER TABLE supplier_company_info ADD COLUMN contact_name TEXT;
ALTER TABLE supplier_company_info ADD COLUMN contact_phone TEXT;
ALTER TABLE supplier_company_info ADD COLUMN contact_email TEXT;
