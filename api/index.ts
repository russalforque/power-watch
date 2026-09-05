import express from 'express';
import { createApiRouter } from '../server/controllers/apiRoutes.js'; // 👈 added .js
import { errorHandler } from '../server/middleware/errorHandler.js';     // 👈 added .js

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

// Mount your API router
app.use('/api', createApiRouter());

// Global error handler
app.use(errorHandler);

export default app;