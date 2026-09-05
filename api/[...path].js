// Vercel serverless function — catch-all for /api/*.
//
// Re-exports the pre-bundled Express app (built by `pnpm --filter
// @workspace/api-server run build` into dist/serverless.mjs). Vercel's Node.js
// runtime detects the Express app and serves it as a serverless function.
import app from '../artifacts/api-server/dist/serverless.mjs';

export default app;
