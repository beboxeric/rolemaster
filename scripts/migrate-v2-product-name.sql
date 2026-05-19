-- Move website to company-level (one-time per supplier).
-- Add product name to intakes (one per product entry).

ALTER TABLE supplier_company_info ADD COLUMN website TEXT;

-- Backfill: take the most-recently-updated intake's website per supplier.
UPDATE supplier_company_info AS sci
SET website = (
  SELECT website FROM intakes i
  WHERE i.supplier_id = sci.supplier_id
    AND i.website IS NOT NULL AND i.website != ''
  ORDER BY i.updated_at DESC LIMIT 1
)
WHERE website IS NULL;

ALTER TABLE intakes ADD COLUMN name TEXT;
