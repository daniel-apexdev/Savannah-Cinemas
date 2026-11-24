// ============================================================
// SAVANNAH CINEMAS API on Supabase Edge Functions
//
// The whole Express API (backend/) bundled into server.bundle.js by
//   cd backend && npm run build:edge
// Deploy:
//   npx supabase functions deploy api --use-api --no-verify-jwt
// Public URL: https://<project>.supabase.co/functions/v1/api/...
// ============================================================

import './server.bundle.js';
