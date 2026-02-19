/**
 * ComfyUI Express bridge — entry point.
 *
 * Start with: pnpm start:service
 * Listens on http://127.0.0.1:3000
 * Targets ComfyUI at http://127.0.0.1:8188
 */
import express from 'express';
import { createJobRouter } from './router.js';

const app = express();
app.use(express.json());
app.use('/', createJobRouter());

const PORT = 3000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[service] ComfyUI Express bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`[service] ComfyUI target: http://127.0.0.1:8188`);
  console.log(`[service] Use Ctrl+C to stop`);
});
