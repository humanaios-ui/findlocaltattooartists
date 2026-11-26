-- Development note only. Do not run this against production.
-- Cities, styles, and ZIP codes are already inserted by the migration.
-- Fictional artists for local preview live in src/lib/demo/seed.ts and are
-- never inserted here, so a hosted database cannot publish fake artists.
select 'no production seed rows' as note;
