-- Unified per-user access/entitlement table — replaces both UserDatasetAccess
-- and the earlier product-only ProductAccess design.
--
-- One row = one (email, product, client, blob_name) grant:
--   email       identity, matches the Azure AD userDetails claim
--   product     site section: 'radial', 'scrollytelling', 'industry_analytics', ...
--   client      storage folder segment separating client work (radial's old "project")
--   blob_name   the specific blob this grant unlocks (avoid "file"/"filename" — reserved
--               or built-in-function-shadowing in T-SQL)
--   attribute1  product-specific extra field. For 'radial' this is the old hierarchy-path
--               "role" (e.g. "/NHS"). Meaning varies by product.
--   attribute2/3  reserved for future per-product use — unused today
--
-- Storage layout: one blob CONTAINER per product, {client}/{blob_name} inside it.
--   radial              -> container "radial-project" (existing, unchanged), blob {client}/{blob_name}
--   scrollytelling       -> container "scrollytelling",       blob {client}/{blob_name}
--   industry_analytics   -> container "industry-analytics",   blob {client}/{blob_name}
--     (container names can't contain underscores in Azure, so the product id's "_"
--      becomes "-" for the container name — see _container_for_product() in
--      api/reports/__init__.py)

CREATE TABLE ProductAccess (
    email       NVARCHAR(255)  NOT NULL,
    product     NVARCHAR(100)  NOT NULL,
    client      NVARCHAR(100)  NOT NULL,
    blob_name   NVARCHAR(255)  NOT NULL,
    attribute1  NVARCHAR(255)  NULL,
    attribute2  NVARCHAR(255)  NULL,
    attribute3  NVARCHAR(255)  NULL,
    granted_at  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    granted_by  NVARCHAR(255)  NULL,
    CONSTRAINT PK_ProductAccess PRIMARY KEY (email, product, client, blob_name)
);

-- One-time backfill from the existing UserDatasetAccess table (radial's current
-- access model: email, project, role). Review before running.
INSERT INTO ProductAccess (email, product, client, blob_name, attribute1)
SELECT email, 'radial', project, 'data.csv', role
FROM UserDatasetAccess;

-- Grants for the new report products (replace placeholders and run):
INSERT INTO ProductAccess (email, product, client, blob_name, granted_by) VALUES
    ('<user_email>', 'scrollytelling',     '<client_folder>', '<report_file>', '<granted_by_email>'),
    ('<user_email>', 'industry_analytics', '<client_folder>', '<report_file>', '<granted_by_email>');

-- Once ProductAccess is confirmed working in place of UserDatasetAccess, retire the old table:
-- DROP TABLE UserDatasetAccess;
