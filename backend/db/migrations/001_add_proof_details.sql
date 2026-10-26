-- Private ownership details on a report. Only admins can see this column
-- (it is never returned by the public /api/items endpoints).
ALTER TABLE items ADD COLUMN IF NOT EXISTS proof_details TEXT;
