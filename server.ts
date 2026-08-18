import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db';
import { apiRouter } from './server/routes/api';
import { setupWebSocket } from './server/ws';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database (Neon PostgreSQL if DATABASE_URL configured or in-memory fallback)
  await initDatabase();

  app.use(cors());
  app.use(express.json());

  // Health check endpoint (for Render and uptime monitors)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'pool-cards-telegram-app',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API router
  app.use('/api', apiRouter);

  const server = http.createServer(app);

  // Attach WebSocket server
  setupWebSocket(server);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Pool Cards Game Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
