// ============================================================
// SUPABASE EDGE FUNCTION ENTRY
// npm run build:edge bundles this (with the whole API) into
// ../supabase/functions/api/server.bundle.js
// ============================================================

// Supabase's hosted runtime doesn't allow changing environment variables,
// so the edge flag is a global instead of process.env.RUNTIME
globalThis.SAVANNAH_RUNTIME = 'edge';

const app = require('./server');

// Supabase routes /functions/v1/api/... here; our routes already start with /api
app.listen(Number(process.env.PORT) || 8000);
