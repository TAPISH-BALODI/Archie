"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const promise_1 = __importDefault(require("mysql2/promise"));
const crypto_1 = require("crypto");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT ?? 4000);
const ORIGIN = process.env.ORIGIN;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'my-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
app.use((0, cors_1.default)({ origin: [ORIGIN, "http://localhost:5173"] }));
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Please set it to your MySQL connection string.');
}
function createPoolFromUrl(urlString) {
    const url = new URL(urlString);
    if (url.protocol !== 'mysql:') {
        throw new Error(`Unsupported DB protocol: ${url.protocol}. Expected mysql://`);
    }
    const sslMode = url.searchParams.get('sslmode') || url.searchParams.get('ssl') || '';
    const ssl = sslMode === 'require' || sslMode === 'true'
        ? { rejectUnauthorized: false }
        : undefined;
    return promise_1.default.createPool({
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
app.use((0, compression_1.default)());
app.use(express_1.default.json());
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.substring(7);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
async function recomputeProgressIfAuto(projectId) {
    const [rows] = await pool.query('SELECT auto_progress, progress FROM projects WHERE id = ?', [projectId]);
    if (!rows[0])
        return;
    if (!rows[0].auto_progress)
        return;
    const [stats] = await pool.query('SELECT COUNT(*) AS total, SUM(completed = 1) AS completed FROM tasks WHERE project_id = ?', [projectId]);
    const total = Number(stats[0]?.total ?? 0);
    const completed = Number(stats[0]?.completed ?? 0);
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    await pool.query('UPDATE projects SET progress = ? WHERE id = ?', [progress, projectId]);
}
function mapProjectRow(p) {
    let tags = [];
    try {
        if (p.tags) {
            tags = typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags;
        }
    }
    catch {
        tags = [];
    }
    return {
        id: p.id,
        name: p.name,
        progress: Number(p.progress),
        autoProgress: Boolean(p.auto_progress),
        tags: Array.isArray(tags) ? tags : [],
        priority: p.priority || 'medium',
        deadline: p.deadline || null,
        tasks: []
    };
}
function mapTaskRow(t) {
    let comments = [];
    try {
        if (t.comments) {
            comments = typeof t.comments === 'string' ? JSON.parse(t.comments) : t.comments;
        }
    }
    catch {
        comments = [];
    }
    return {
        id: t.id,
        name: t.name,
        completed: Boolean(t.completed),
        projectId: t.project_id,
        assigneeId: t.assignee_id ?? null,
        status: t.status || 'active',
        description: t.description || null,
        comments: Array.isArray(comments) ? comments : []
    };
}
app.get('/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message });
    }
});
app.post('/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const id = (0, crypto_1.randomUUID)();
        await pool.query('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)', [id, email, passwordHash, name]);
        const token = jsonwebtoken_1.default.sign({ userId: id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.status(201).json({ token, user: { id, email, name } });
    }
    catch (e) {
        console.error('Registration error:', e);
        res.status(500).json({ error: 'Registration failed' });
    }
});
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
        const [users] = await pool.query('SELECT id, email, password_hash, name FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = users[0];
        const isValid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    }
    catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Login failed' });
    }
});
app.get('/auth/me', authMiddleware, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, email, name FROM users WHERE id = ?', [req.userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user: users[0] });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
app.get('/projects', authMiddleware, async (_req, res) => {
    const [projectRows] = await pool.query('SELECT * FROM projects ORDER BY name ASC');
    const result = projectRows.map(p => ({ ...mapProjectRow(p), tasks: [] }));
    res.json(result);
});
app.post('/projects', authMiddleware, async (req, res) => {
    const { name, tags, priority, deadline } = req.body;
    const id = (0, crypto_1.randomUUID)();
    const nm = (name ?? 'Untitled Project').trim() || 'Untitled Project';
    const tagsJson = tags && Array.isArray(tags) ? JSON.stringify(tags) : null;
    const priorityVal = priority && ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium';
    const deadlineVal = deadline || null;
    await pool.query('INSERT INTO projects (id, name, progress, auto_progress, tags, priority, deadline) VALUES (?, ?, 0, 1, ?, ?, ?)', [id, nm, tagsJson, priorityVal, deadlineVal]);
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE project_id = ?', [id]);
    const [pRows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json({ ...mapProjectRow(pRows[0]), tasks: tasks.map(mapTaskRow) });
});
app.put('/projects/:id', authMiddleware, async (req, res) => {
    const id = req.params.id;
    const { name, progress, autoProgress, tags, priority, deadline } = req.body;
    const sets = [];
    const vals = [];
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
    if (tags !== undefined) {
        sets.push('tags = ?');
        vals.push(Array.isArray(tags) ? JSON.stringify(tags) : null);
    }
    if (priority !== undefined) {
        sets.push('priority = ?');
        vals.push(['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium');
    }
    if (deadline !== undefined) {
        sets.push('deadline = ?');
        vals.push(deadline || null);
    }
    if (sets.length) {
        vals.push(id);
        await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, vals);
    }
    await recomputeProgressIfAuto(id);
    const [pRows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    const [tRows] = await pool.query('SELECT * FROM tasks WHERE project_id = ?', [id]);
    const p = pRows[0];
    res.json({ ...mapProjectRow(p), tasks: tRows.map(mapTaskRow) });
});
app.delete('/projects/:id', authMiddleware, async (req, res) => {
    const id = req.params.id;
    await pool.query('DELETE FROM tasks WHERE project_id = ?', [id]);
    await pool.query('DELETE FROM projects WHERE id = ?', [id]);
    res.status(204).end();
});
app.get('/projects/:id/tasks', authMiddleware, async (req, res) => {
    const id = req.params.id;
    const [rows] = await pool.query('SELECT * FROM tasks WHERE project_id = ?', [id]);
    res.json(rows.map(mapTaskRow));
});
app.post('/projects/:id/tasks', authMiddleware, async (req, res) => {
    const id = req.params.id;
    const { name, assigneeId, status, description } = req.body;
    const taskId = (0, crypto_1.randomUUID)();
    const nm = (name ?? 'Untitled Task').trim() || 'Untitled Task';
    const statusVal = status && ['draft', 'version', 'active'].includes(status) ? status : 'active';
    const descVal = description || null;
    await pool.query('INSERT INTO tasks (id, name, completed, project_id, assignee_id, status, description, comments) VALUES (?, ?, 0, ?, ?, ?, ?, ?)', [taskId, nm, id, assigneeId ?? null, statusVal, descVal, JSON.stringify([])]);
    await recomputeProgressIfAuto(id);
    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.status(201).json(mapTaskRow(rows[0]));
});
app.put('/projects/:id/tasks/:taskId', authMiddleware, async (req, res) => {
    const { id, taskId } = req.params;
    const { name, completed, assigneeId, status, description } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const sets = [];
        const vals = [];
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
        if (status !== undefined) {
            sets.push('status = ?');
            vals.push(['draft', 'version', 'active'].includes(status) ? status : 'active');
        }
        if (description !== undefined) {
            sets.push('description = ?');
            vals.push(description || null);
        }
        if (sets.length) {
            vals.push(taskId);
            await conn.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, vals);
        }
        await conn.query(`UPDATE projects p
       SET p.progress = (
         SELECT IFNULL(ROUND(SUM(t.completed = 1) / NULLIF(COUNT(*),0) * 100), 0)
         FROM tasks t
         WHERE t.project_id = p.id
       )
       WHERE p.id = ? AND p.auto_progress = 1`, [id]);
        await conn.commit();
    }
    catch (e) {
        await conn.rollback();
        throw e;
    }
    finally {
        conn.release();
    }
    const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.json(mapTaskRow(rows[0]));
});
app.delete('/projects/:id/tasks/:taskId', authMiddleware, async (req, res) => {
    const { id, taskId } = req.params;
    await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);
    await recomputeProgressIfAuto(id);
    res.status(204).end();
});
app.post('/projects/:id/tasks/:taskId/comments', authMiddleware, async (req, res) => {
    const { id, taskId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Comment text is required' });
    }
    const [taskRows] = await pool.query('SELECT comments FROM tasks WHERE id = ?', [taskId]);
    if (!taskRows[0]) {
        return res.status(404).json({ error: 'Task not found' });
    }
    let comments = [];
    try {
        if (taskRows[0].comments) {
            comments = typeof taskRows[0].comments === 'string' ? JSON.parse(taskRows[0].comments) : taskRows[0].comments;
        }
    }
    catch {
        comments = [];
    }
    const newComment = {
        id: (0, crypto_1.randomUUID)(),
        text: text.trim(),
        createdAt: new Date().toISOString(),
        authorId: null
    };
    comments.push(newComment);
    await pool.query('UPDATE tasks SET comments = ? WHERE id = ?', [
        JSON.stringify(comments),
        taskId
    ]);
    res.status(201).json(newComment);
});
app.delete('/projects/:id/tasks/:taskId/comments/:commentId', authMiddleware, async (req, res) => {
    const { id, taskId, commentId } = req.params;
    const [taskRows] = await pool.query('SELECT comments FROM tasks WHERE id = ?', [taskId]);
    if (!taskRows[0]) {
        return res.status(404).json({ error: 'Task not found' });
    }
    let comments = [];
    try {
        if (taskRows[0].comments) {
            comments = typeof taskRows[0].comments === 'string' ? JSON.parse(taskRows[0].comments) : taskRows[0].comments;
        }
    }
    catch {
        comments = [];
    }
    comments = comments.filter((c) => c.id !== commentId);
    await pool.query('UPDATE tasks SET comments = ? WHERE id = ?', [
        JSON.stringify(comments),
        taskId
    ]);
    res.status(204).end();
});
app.get('/team', authMiddleware, async (_req, res) => {
    const [rows] = await pool.query('SELECT * FROM team_members ORDER BY name ASC');
    res.json(rows.map(r => ({ id: r.id, name: r.name })));
});
app.post('/team', authMiddleware, async (req, res) => {
    const { name } = req.body;
    const id = (0, crypto_1.randomUUID)();
    const nm = (name ?? 'Unnamed Member').trim() || 'Unnamed Member';
    await pool.query('INSERT INTO team_members (id, name) VALUES (?, ?)', [id, nm]);
    res.status(201).json({ id, name: nm });
});
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${PORT}`);
});
