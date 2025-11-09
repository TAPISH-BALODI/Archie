import express from 'express';
import cors from 'cors';
import compression from 'compression';
import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

const PORT = Number(process.env.PORT ?? 4000);
const ORIGIN = process.env.ORIGIN ;
const DATABASE_URL = process.env.DATABASE_URL;
app.use(cors({ origin: ORIGIN }));

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Please set it to your MySQL connection string.');
}

function createPoolFromUrl(urlString: string) {
  const url = new URL(urlString);
  if (url.protocol !== 'mysql:') {
    throw new Error(`Unsupported DB protocol: ${url.protocol}. Expected mysql://`);
  }
  const sslMode = url.searchParams.get('sslmode') || url.searchParams.get('ssl') || '';
  const ssl =
    sslMode === 'require' || sslMode === 'true'
      ? { rejectUnauthorized: false }
      : undefined;
  return mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    waitForConnections: true,
    connectionLimit: 10,
    ssl
  });
}

const pool = createPoolFromUrl(DATABASE_URL);

app.use(compression());
app.use(express.json());

async function recomputeProgressIfAuto(projectId: string) {
  const [rows] = await pool.query<any[]>(
    'SELECT auto_progress, progress FROM projects WHERE id = ?',
    [projectId]
  );
  if (!rows[0]) return;
  if (!rows[0].auto_progress) return;
  const [stats] = await pool.query<any[]>(
    'SELECT COUNT(*) AS total, SUM(completed = 1) AS completed FROM tasks WHERE project_id = ?',
    [projectId]
  );
  const total = Number(stats[0]?.total ?? 0);
  const completed = Number(stats[0]?.completed ?? 0);
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  await pool.query('UPDATE projects SET progress = ? WHERE id = ?', [progress, projectId]);
}

function mapProjectRow(p: any) {
  return {
    id: p.id,
    name: p.name,
    progress: Number(p.progress),
    autoProgress: Boolean(p.auto_progress),
    tasks: [] as any[]
  };
}

function mapTaskRow(t: any) {
  return {
    id: t.id,
    name: t.name,
    completed: Boolean(t.completed),
    projectId: t.project_id,
    assigneeId: t.assignee_id ?? null
  };
}

// Health
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message });
  }
});

// Projects
app.get('/projects', async (_req, res) => {
  const [projectRows] = await pool.query<any[]>('SELECT * FROM projects ORDER BY name ASC');
  const result = projectRows.map(p => ({ ...mapProjectRow(p), tasks: [] }));
  res.json(result);
});

app.post('/projects', async (req, res) => {
  const { name } = req.body as { name?: string };
  const id = randomUUID();
  const nm = (name ?? 'Untitled Project').trim() || 'Untitled Project';
  await pool.query('INSERT INTO projects (id, name, progress, auto_progress) VALUES (?, ?, 0, 1)', [
    id,
    nm
  ]);
  const [tasks] = await pool.query<any[]>('SELECT * FROM tasks WHERE project_id = ?', [id]);
  res.status(201).json({ id, name: nm, progress: 0, autoProgress: true, tasks: tasks.map(mapTaskRow) });
});

app.put('/projects/:id', async (req, res) => {
  const id = req.params.id;
  const { name, progress, autoProgress } = req.body as {
    name?: string;
    progress?: number;
    autoProgress?: boolean;
  };
  const sets: string[] = [];
  const vals: any[] = [];
  if (name !== undefined) {
    sets.push('name = ?');
    vals.push(String(name));
  }
  if (progress !== undefined) {
    sets.push('progress = ?');
    vals.push(Math.max(0, Math.min(100, Math.round(Number(progress)))));
  }
  if (autoProgress !== undefined) {
    sets.push('auto_progress = ?');
    vals.push(autoProgress ? 1 : 0);
  }
  if (sets.length) {
    vals.push(id);
    await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, vals);
  }
  await recomputeProgressIfAuto(id);
  const [pRows] = await pool.query<any[]>('SELECT * FROM projects WHERE id = ?', [id]);
  const [tRows] = await pool.query<any[]>('SELECT * FROM tasks WHERE project_id = ?', [id]);
  const p = pRows[0];
  res.json({ ...mapProjectRow(p), tasks: tRows.map(mapTaskRow) });
});

app.delete('/projects/:id', async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM tasks WHERE project_id = ?', [id]);
  await pool.query('DELETE FROM projects WHERE id = ?', [id]);
  res.status(204).end();
});

// Tasks
app.get('/projects/:id/tasks', async (req, res) => {
  const id = req.params.id;
  const [rows] = await pool.query<any[]>('SELECT * FROM tasks WHERE project_id = ?', [id]);
  res.json(rows.map(mapTaskRow));
});

app.post('/projects/:id/tasks', async (req, res) => {
  const id = req.params.id;
  const { name, assigneeId } = req.body as { name?: string; assigneeId?: string };
  const taskId = randomUUID();
  const nm = (name ?? 'Untitled Task').trim() || 'Untitled Task';
  await pool.query(
    'INSERT INTO tasks (id, name, completed, project_id, assignee_id) VALUES (?, ?, 0, ?, ?)',
    [taskId, nm, id, assigneeId ?? null]
  );
  await recomputeProgressIfAuto(id);
  res.status(201).json({ id: taskId, name: nm, completed: false, projectId: id, assigneeId: assigneeId ?? null });
});

app.put('/projects/:id/tasks/:taskId', async (req, res) => {
  const { id, taskId } = req.params;
  const { name, completed, assigneeId } = req.body as {
    name?: string;
    completed?: boolean;
    assigneeId?: string | null;
  };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const sets: string[] = [];
    const vals: any[] = [];
    if (name !== undefined) {
      sets.push('name = ?');
      vals.push(String(name));
    }
    if (completed !== undefined) {
      sets.push('completed = ?');
      vals.push(completed ? 1 : 0);
    }
    if (assigneeId !== undefined) {
      sets.push('assignee_id = ?');
      vals.push(assigneeId ?? null);
    }
    if (sets.length) {
      vals.push(taskId);
      await conn.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, vals);
    }
    // One-shot progress recompute if auto_progress = 1
    await conn.query(
      `UPDATE projects p
       SET p.progress = (
         SELECT IFNULL(ROUND(SUM(t.completed = 1) / NULLIF(COUNT(*),0) * 100), 0)
         FROM tasks t
         WHERE t.project_id = p.id
       )
       WHERE p.id = ? AND p.auto_progress = 1`,
      [id]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  const [rows] = await pool.query<any[]>('SELECT * FROM tasks WHERE id = ?', [taskId]);
  res.json(mapTaskRow(rows[0]));
});

app.delete('/projects/:id/tasks/:taskId', async (req, res) => {
  const { id, taskId } = req.params;
  await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);
  await recomputeProgressIfAuto(id);
  res.status(204).end();
});

// Team
app.get('/team', async (_req, res) => {
  const [rows] = await pool.query<any[]>('SELECT * FROM team_members ORDER BY name ASC');
  res.json(rows.map(r => ({ id: r.id, name: r.name })));
});

app.post('/team', async (req, res) => {
  const { name } = req.body as { name?: string };
  const id = randomUUID();
  const nm = (name ?? 'Unnamed Member').trim() || 'Unnamed Member';
  await pool.query('INSERT INTO team_members (id, name) VALUES (?, ?)', [id, nm]);
  res.status(201).json({ id, name: nm });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});