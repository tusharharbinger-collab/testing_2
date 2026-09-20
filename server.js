const express = require('express');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = '0.0.0.0';
const VERSION = '1.0.0';

// In-memory data store
let todos = [
  { id: '1', title: 'Deploy container to AWS ECS / EKS', completed: true, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: '2', title: 'Configure ALB target group health checks', completed: true, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: '3', title: 'Verify Mann-Whitney U latency rollback test', completed: false, createdAt: new Date().toISOString() },
  { id: '4', title: 'Verify Wald SPRT error spike rollback test', completed: false, createdAt: new Date().toISOString() }
];

// JSON body parser
app.use(express.json());

// Strip PATH_PREFIX when running behind ALB path-based routing (e.g. /api/v1/testing-2)
const pathPrefix = (process.env.PATH_PREFIX || '').replace(/\/+$/, '');
if (pathPrefix) {
  app.use((req, res, next) => {
    if (req.url.startsWith(pathPrefix)) {
      req.url = req.url.slice(pathPrefix.length) || '/';
    }
    next();
  });
}

// --- Health Check Endpoints (Crucial: Immediate response for AWS ALB / K8s probes) ---
const handleHealthCheck = (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).json({
    status: 'ok',
    version: VERSION
  });
};

app.get('/health', handleHealthCheck);
app.get('/healthz', handleHealthCheck);

// --- Chaos Engineering Middleware for CI/CD Testing ---
// Applied to /api routes to test rollback mechanisms without disrupting container health probes
const chaosMiddleware = (req, res, next) => {
  const chaosParam = (req.query.chaos || '').toLowerCase();
  const latencyEnabled = chaosParam === 'latency' || process.env.CHAOS_LATENCY === 'true';
  const errorEnabled = chaosParam === 'error' || process.env.CHAOS_ERROR === 'true';

  // Chaos Error Spike Simulation (Wald SPRT rollback test: 20% random failure rate)
  if (errorEnabled) {
    const isError = Math.random() < 0.20;
    if (isError) {
      res.setHeader('X-Chaos-Triggered', 'error-500');
      return res.status(500).json({
        error: 'Chaos Error: Simulated 20% internal server error spike (Wald SPRT test)'
      });
    }
  }

  // Chaos Latency Simulation (Mann-Whitney U test: 300ms artificial regression)
  if (latencyEnabled) {
    res.setHeader('X-Chaos-Triggered', 'latency-300ms');
    return setTimeout(() => {
      next();
    }, 300);
  }

  next();
};

app.use('/api', chaosMiddleware);

// --- REST API Endpoints ---

// GET /api/todos - Return all to-dos
app.get('/api/todos', (req, res) => {
  res.json({
    data: todos,
    total: todos.length,
    timestamp: new Date().toISOString()
  });
});

// POST /api/todos - Add a new to-do
app.post('/api/todos', (req, res) => {
  const { title } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Field "title" is required and cannot be empty' });
  }

  const newTodo = {
    id: Date.now().toString(),
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString()
  };

  todos.unshift(newTodo);
  return res.status(201).json(newTodo);
});

// PATCH /api/todos/:id - Toggle or update completion status
app.patch('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const todo = todos.find(item => item.id === id);

  if (!todo) {
    return res.status(404).json({ error: `Todo with ID "${id}" not found` });
  }

  if (typeof req.body.completed === 'boolean') {
    todo.completed = req.body.completed;
  } else {
    todo.completed = !todo.completed;
  }

  if (req.body.title && typeof req.body.title === 'string' && req.body.title.trim()) {
    todo.title = req.body.title.trim();
  }

  return res.json(todo);
});

// DELETE /api/todos/:id - Remove a to-do
app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = todos.length;
  todos = todos.filter(item => item.id !== id);

  if (todos.length === initialLength) {
    return res.status(404).json({ error: `Todo with ID "${id}" not found` });
  }

  return res.json({ message: 'Todo deleted successfully', id });
});

// Status metadata endpoint for CI/CD inspect
app.get('/api/chaos-status', (req, res) => {
  res.json({
    envChaosLatency: process.env.CHAOS_LATENCY === 'true',
    envChaosError: process.env.CHAOS_ERROR === 'true',
    version: VERSION
  });
});

// --- Static Frontend Serving ---
app.use(express.static(path.join(__dirname, 'public')));

// Root route fallback to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Fallback for any other route to index.html (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const server = app.listen(PORT, HOST, () => {
  console.log(`[READY] Server running on http://${HOST}:${PORT}`);
  console.log(`[INFO] ALB Health Check: http://${HOST}:${PORT}/health`);
  console.log(`[INFO] Chaos triggers: ?chaos=latency (300ms delay) | ?chaos=error (20% 500 error)`);
});

// Graceful shutdown handling for container termination
const gracefulShutdown = (signal) => {
  console.log(`[SHUTDOWN] Received ${signal}. Closing HTTP server...`);
  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed cleanly. Exiting.');
    process.exit(0);
  });

  // Force close if lingering connections take too long
  setTimeout(() => {
    console.error('[SHUTDOWN] Force closing process after timeout.');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
