import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
// Import the express app from the api folder
import apiApp from './api/index.ts';

const getDirname = () => {
  try { return __dirname; } catch { return path.dirname(fileURLToPath(import.meta.url)); }
};
const __dirname_resolved = getDirname();

const PORT = 3000;

async function startServer() {
  // We use the apiApp which already has cors, express.json, and the /api routes attached
  const app = apiApp;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
