// ============================================================
// SUPABASE EDGE FUNCTION ENTRY
// npm run build:edge bundles this (with the whole API) into
// ../supabase/functions/api/server.bundle.js
// ============================================================

process.env.RUNTIME = 'edge';

const app = require('./server');

// Supabase routes /functions/v1/api/... here; our routes already start with /api
app.listen(Number(process.env.PORT) || 8000);
