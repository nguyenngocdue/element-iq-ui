import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load .env
dotenv.config();

// ─── Config ────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const BACKEND_URL = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || 'http://localhost:8001';
const USE_MOCK = process.env.USE_MOCK === 'true';

// ─── Proxy helper ──────────────────────────────────────────────────────────
function proxyToBackend(req: Request, res: Response) {
  const backendUrl = new URL(BACKEND_URL);
  const options: http.RequestOptions = {
    hostname: backendUrl.hostname,
    port: backendUrl.port || 80,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${backendUrl.hostname}:${backendUrl.port}`,
    },
  };

  const proxy = http.request(options, (backendRes) => {
    res.writeHead(backendRes.statusCode || 502, backendRes.headers);
    backendRes.pipe(res, { end: true });
  });

  proxy.on('error', () => {
    res.status(502).json({
      error: 'BACKEND_UNAVAILABLE',
      message: `Cannot reach backend at ${BACKEND_URL}. Is element-iq-server running?`,
    });
  });

  req.pipe(proxy, { end: true });
}

// ─── Mock fallback (dev without backend) ───────────────────────────────────
function mockAnalyze(req: Request, res: Response) {
  console.log('[MOCK] POST /api/v1/analyze');
  const jobId = crypto.randomUUID();

  // Immediately return 202
  res.status(202).json({
    job_id: jobId,
    status: 'PENDING',
    estimated_time: 3,
    status_url: `/api/v1/jobs/${jobId}`,
  });
}

function mockJob(req: Request, res: Response) {
  const { id } = req.params;
  console.log(`[MOCK] GET /api/v1/jobs/${id}`);
  res.json({
    job_id: id,
    status: 'COMPLETED',
    progress: 100,
    filename: 'mock.pdf',
    components: ['grout-tube'],
    result: {
      summary: { overall: 'PASS', total_components: 1, pass_rate: 85 },
      components: [
        {
          component_id: 'grout-tube',
          detected: 7,
          validated: 6,
          failures: 1,
          summary: { faces: { NF: 4, FF: 3 }, overall: 'PASS' },
          objects: [
            { id: 1, type: 'grout_tube', face: 'NF', bbox: [100, 150, 140, 240], confidence: 0.92 },
            { id: 2, type: 'grout_tube', face: 'FF', bbox: [200, 150, 240, 240], confidence: 0.88 },
            { id: 3, type: 'grout_tube', face: 'NF', bbox: [300, 150, 340, 240], confidence: 0.76 },
          ],
          report: [],
        },
      ],
      artifacts: {},
    },
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
}

function mockComponents(_req: Request, res: Response) {
  res.json({
    components: [
      { id: 'grout-tube', name: 'Grout Tube', description: 'NF/FF detection', classes: ['FF', 'NF'], status: 'ready' },
    ],
  });
}

function mockHealth(_req: Request, res: Response) {
  res.json({ status: 'healthy (mock)', timestamp: new Date().toISOString(), version: '0.1.0-mock' });
}

// ─── App setup ─────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();

  if (USE_MOCK) {
    // ── Mock mode (no backend needed) ──────────────────────────
    console.log('[server] Running in MOCK mode — no backend required');
    app.post('/api/v1/analyze', mockAnalyze);
    app.get('/api/v1/jobs/:id', mockJob);
    app.get('/api/v1/components', mockComponents);
    app.get('/api/v1/health', mockHealth);
  } else {
    // ── Proxy all /api/v1/* to element-iq-server ──────────────
    console.log(`[server] Proxying /api/v1/* → ${BACKEND_URL}`);
    app.use('/api/v1', proxyToBackend);
  }

  // ── Vite dev middleware ─────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ElementIQ UI  →  http://localhost:${PORT}`);
    console.log(`  Backend       →  ${USE_MOCK ? 'MOCK (no backend)' : BACKEND_URL}\n`);
  });
}

startServer();
