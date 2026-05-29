import express from 'express';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock Analysis Endpoint
  app.post('/api/analyze', upload.single('document'), (req, res) => {
    const threshold = parseFloat(req.body.threshold || '0.5');
    
    // Simulate processing delay
    setTimeout(() => {
      // Generate some dummy detections for visual testing
      const detections = [
        {
          id: 'd1',
          page: 1,
          x: 100, y: 150, width: 40, height: 40,
          type: 'NF',
          confidence: 0.92,
          status: 'PASS',
          note: 'NF 1',
        },
        {
          id: 'd2',
          page: 1,
          x: 200, y: 250, width: 40, height: 40,
          type: 'FF',
          confidence: 0.88,
          status: 'FAIL',
          reason: 'Hollow grout tube detected (Text note missing)',
          note: '',
        },
        {
          id: 'd3',
          page: 1,
          x: 350, y: 100, width: 40, height: 40,
          type: 'UNKNOWN',
          confidence: 0.45,
          status: 'WARN',
          reason: 'Ambiguous detection',
        }
      ].filter(d => d.confidence >= threshold);

      const passCount = detections.filter(d => d.status === 'PASS').length;
      const passRate = detections.length > 0 ? Math.round((passCount / detections.length) * 100) : 100;

      res.json({
        success: true,
        passRate,
        detections
      });
    }, 4000);
  });

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
