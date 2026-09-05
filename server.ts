import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './server/controllers/apiRoutes.js';
import { errorHandler } from './server/middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp(): Promise<express.Express> {
  const app = express();

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'PowerWatch API',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api', createApiRouter());

  app.use(errorHandler);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isDirectRun) {
  createApp()
    .then(app => {
      const PORT = 3000;
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[PowerWatch Server] Running at http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error('Fatal server startup error:', err);
      process.exit(1);
    });
}