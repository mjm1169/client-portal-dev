-- Segmentation Explorer has no blob/file behind it (personas are bundled into the
-- frontend, and its chat calls Google's Generative Language API directly with a
-- key the user supplies) — so /api/access/{product} (api/access/__init__.py) only
-- checks for *membership* in ProductAccess, it doesn't hand back a SAS url the way
-- /api/reports/{product} does. ProductAccess still requires non-null client/blob_name
-- per row, so grants use the sentinel pair below rather than a real file.

-- Grants for Segmentation Explorer (replace placeholders and run):
INSERT INTO ProductAccess (email, product, client, blob_name, granted_by) VALUES
    ('<user_email>', 'segmentation', 'all', 'segmentation', '<granted_by_email>');
