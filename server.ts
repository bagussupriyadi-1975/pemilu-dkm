import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'epilketmas_server_state.json');

interface ServerSharedState {
  updatedAt: number;
  supabaseConfig?: {
    url: string;
    key: string;
  };
  school?: unknown;
  periods?: unknown[];
  committees?: unknown[];
  candidates?: unknown[];
  voters?: unknown[];
  votes?: unknown[];
  auditLogs?: unknown[];
  users?: unknown[];
}

function readServerState(): ServerSharedState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(raw) as ServerSharedState;
    }
  } catch (err) {
    console.warn('[Server State] Gagal membaca state:', err);
  }
  return null;
}

function writeServerState(partial: Partial<ServerSharedState>): ServerSharedState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const current = readServerState() || { updatedAt: 0 };
    const next: ServerSharedState = {
      ...current,
      ...partial,
      updatedAt: Date.now(),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), 'utf-8');
    return next;
  } catch (err) {
    console.warn('[Server State] Gagal menyimpan state:', err);
    return { updatedAt: Date.now(), ...partial };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Endpoint Real-Time Multi-Akun / Multi-Perangkat (Shared Server State)
  app.get('/api/state', (_req, res) => {
    const state = readServerState();
    res.json({
      ok: true,
      state: state || null,
    });
  });

  app.post('/api/state', (req, res) => {
    const body = req.body || {};
    const updated = writeServerState(body);
    res.json({
      ok: true,
      updatedAt: updated.updatedAt,
    });
  });

  const distPath = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server DKM Nurul Hidayah berjalan di http://0.0.0.0:${PORT}`);
  });
}

startServer();
