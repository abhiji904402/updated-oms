import express from 'express';
import path from 'path';
import fs from 'fs';
// Import the express app from the api folder
import apiApp from './api/index.ts';

const __dirname_resolved = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const PORT = 3000;

async function startServer() {
  // We use the apiApp which already has cors, express.json, and the /api routes attached
  const app = apiApp;

  // Health check endpoint for Cloud Run and external uptime probes
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (typeof __filename !== 'undefined' && __filename.endsWith('server.cjs'));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Resolve dist folder whether executed from root or within dist
    const cwdDist = path.join(process.cwd(), 'dist');
    const distPath = fs.existsSync(path.join(cwdDist, 'index.html'))
      ? cwdDist
      : (fs.existsSync(path.join(__dirname_resolved, 'index.html')) ? __dirname_resolved : cwdDist);
    
    // Serve static files with proper caching rules
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Never cache HTML files (especially index.html)
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          // Cache assets (js, css, images) for 1 year since Vite hashes their filenames
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    
    // Fallback for SPA routing
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('<!DOCTYPE html><html><head><title>Broomies OMS</title></head><body><div id="root"></div></body></html>');
      }
    });
  }

  // Bind to port 3000 required by container infrastructure and reverse proxy
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
