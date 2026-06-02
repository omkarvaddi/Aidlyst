import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const app = express();
const PORT = Number(process.env.FRIDAY_SERVER_PORT || 8788);
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const allowedRoots = (process.env.FRIDAY_ALLOWED_ROOTS || `${os.homedir()}\\Desktop;${os.homedir()}\\Documents`)
  .split(';')
  .map((root) => path.resolve(root.trim()))
  .filter(Boolean);
const vaultPath = process.env.FRIDAY_OBSIDIAN_VAULT ? path.resolve(process.env.FRIDAY_OBSIDIAN_VAULT) : null;

app.use(cors({ origin: ['http://localhost:8787', 'http://127.0.0.1:8787'] }));
app.use(express.json({ limit: '5mb' }));

function isAllowed(targetPath) {
  const resolved = path.resolve(targetPath);
  return allowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
}

function safePath(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!isAllowed(resolved)) throw new Error(`Path blocked by Friday safety policy: ${resolved}`);
  return resolved;
}

async function walkMarkdown(dir, limit = 500, acc = []) {
  if (!dir || acc.length >= limit) return acc;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (acc.length >= limit) break;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (entry.isDirectory()) await walkMarkdown(full, limit, acc);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) acc.push(full);
  }
  return acc;
}

function scoreText(query, file) {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  const hay = `${file.name} ${file.content}`.toLowerCase();
  return terms.reduce((score, term) => score + (hay.includes(term) ? 1 : 0), 0);
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mode: 'local',
    port: PORT,
    allowedRoots,
    vaultConfigured: Boolean(vaultPath),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post('/api/brain/search', async (req, res) => {
  try {
    const { query = '', max = 8 } = req.body || {};
    if (!vaultPath) return res.json({ sources: [], note: 'FRIDAY_OBSIDIAN_VAULT is not configured.' });
    const safeVault = safePath(vaultPath);
    const files = await walkMarkdown(safeVault, 500);
    const loaded = [];
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      loaded.push({ name: path.relative(safeVault, file), path: file, content });
    }
    const sources = loaded
      .map((file) => {
        const score = scoreText(query, file);
        const excerpt = file.content.slice(0, 500).replace(/\s+/g, ' ').trim();
        return { name: file.name, path: file.path, score, excerpt };
      })
      .filter((file) => file.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max);
    res.json({ sources, indexed: loaded.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/ai/respond', async (req, res) => {
  try {
    const { prompt = '', agent = 'Friday', sources = [] } = req.body || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        offline: true,
        response: `${agent}: I can route the work locally, but the OpenAI API key is not configured yet. Add OPENAI_API_KEY to Friday/.env and restart me. Until then, I am clever wallpaper with opinions.`,
      });
    }

    const context = sources.map((source) => `${source.name}: ${source.excerpt}`).join('\n');
    const system = `You are ${agent}, a local-first Aidlyst command-center assistant. Be human, concise, slightly witty, and operational. Aidlyst is affiliate-first and must not give medical advice, diagnosis, treatment, prescriptions, emergency guidance, or unsupported FDA claims. Use the provided Obsidian context when relevant. Avoid AI-sounding numbered lists unless the user asks for a checklist.`;
    const payload = {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Obsidian context:\n${context || 'No retrieved vault context.'}\n\nUser request:\n${prompt}` },
      ],
      temperature: 0.55,
    };

    const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!apiResponse.ok) {
      const body = await apiResponse.text();
      throw new Error(`OpenAI request failed: ${body}`);
    }

    const data = await apiResponse.json();
    res.json({ response: data.choices?.[0]?.message?.content || 'No response returned.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/local/list', async (req, res) => {
  try {
    const requestedPath = safePath(req.body?.path || os.homedir());
    const entries = await fs.readdir(requestedPath, { withFileTypes: true });
    res.json({
      path: requestedPath,
      entries: entries.slice(0, 80).map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'folder' : 'file' })),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/local/open', async (req, res) => {
  try {
    const target = safePath(req.body?.path || '');
    const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', target] : [target];
    spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
    res.json({ ok: true, opened: target });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/local/app', async (req, res) => {
  try {
    const name = String(req.body?.name || '').toLowerCase();
    const allowed = {
      obsidian: 'obsidian://open',
      vscode: 'code',
      chrome: 'chrome',
      edge: 'msedge',
    };
    const command = allowed[name];
    if (!command) throw new Error('Application not allowlisted. Add it deliberately before launching.');
    if (name === 'obsidian') spawn('cmd', ['/c', 'start', '', command], { detached: true, stdio: 'ignore' }).unref();
    else spawn(command, [], { detached: true, stdio: 'ignore' }).unref();
    res.json({ ok: true, app: name });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Friday local control server listening at http://127.0.0.1:${PORT}`);
});
