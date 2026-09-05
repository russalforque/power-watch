import express from 'express';
import { createApiRouter } from '../server/controllers/apiRoutes';
import { errorHandler } from '../server/middleware/errorHandler';

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PowerWatch API',
    timestamp: new Date().toISOString()
  });
});

// Mount your real API router
app.use('/api', createApiRouter());

// Global error handler
app.use(errorHandler);

// Vercel serverless handles Express exports directly
export default app;