// Serverless entry point for Vercel.
//
// Unlike `index.ts` (which calls `app.listen()` for local dev), this module
// only exports the Express app so Vercel's Node.js runtime can serve it as a
// serverless function via `api/[...path].js`.
import app from "./app";

export default app;
