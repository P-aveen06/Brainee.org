-- Preserve company IDs and all foreign-key relationships during the rebrand.
UPDATE companies
SET name = 'Brainee.org', code = 'Brainee.org', updated_at = unixepoch()
WHERE is_internal = 1 AND code = 'TCC';
--> statement-breakpoint
UPDATE companies SET contact_email = 'admin@brainee.org'
WHERE code = 'Brainee.org' AND contact_email = 'admin@thecloudcompany.com';
--> statement-breakpoint
UPDATE asset_assignments SET return_destination = 'brainee_inventory'
WHERE return_destination = 'tcc_inventory';
--> statement-breakpoint
UPDATE asset_history SET details = replace(details, 'tcc_inventory', 'brainee_inventory')
WHERE details LIKE '%tcc_inventory%';
--> statement-breakpoint
UPDATE assets SET asset_tag = replace(asset_tag, 'TCC-', 'Brainee.org-')
WHERE asset_tag LIKE 'TCC-%';
--> statement-breakpoint
UPDATE projects SET name = replace(name, 'TCC ', 'Brainee.org ')
WHERE name IN ('TCC Cloud Cost & FinOps Optimization', 'TCC Single Sign-On & Zero Trust Security');
--> statement-breakpoint
UPDATE notifications
SET title = replace(replace(title, 'TCC Tower', 'Brainee.org'), 'TCC Brain', 'Brainee.org Brain'),
    body = replace(replace(body, 'TCC Tower', 'Brainee.org'), 'TCC Brain', 'Brainee.org Brain')
WHERE title LIKE '%TCC Tower%' OR title LIKE '%TCC Brain%'
   OR body LIKE '%TCC Tower%' OR body LIKE '%TCC Brain%';
--> statement-breakpoint
UPDATE ai_conversations SET title = replace(title, 'TCC Brain', 'Brainee.org Brain')
WHERE title = 'TCC Brain';
