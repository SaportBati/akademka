import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';

const app = new Hono();

// CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Helper functions
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

// Public routes - Registration
app.post('/api/register', async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: 'Email и пароль обязательны' }, 400);
    }
    
    if (password.length < 6) {
      return c.json({ error: 'Пароль должен быть не менее 6 символов' }, 400);
    }
    
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return c.json({ error: 'Неверный формат email' }, 400);
    }
    
    const db = c.env.DB;
    
    // Check if user exists
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return c.json({ error: 'Пользователь с таким email уже существует' }, 409);
    }
    
    const userId = uid();
    const passwordHash = await hashPassword(password);
    const createdAt = Math.floor(Date.now() / 1000);
    
    await db.prepare(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, email.toLowerCase(), passwordHash, name || null, createdAt).run();
    
    return c.json({ 
      message: 'Регистрация успешна',
      user: { id: userId, email, name }
    });
  } catch (e) {
    console.error('Register error:', e);
    return c.json({ error: 'Ошибка сервера' }, 500);
  }
});

// Public routes - Login
app.post('/api/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: 'Email и пароль обязательны' }, 400);
    }
    
    const db = c.env.DB;
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).first();
    
    if (!user) {
      return c.json({ error: 'Неверный email или пароль' }, 401);
    }
    
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return c.json({ error: 'Неверный email или пароль' }, 401);
    }
    
    // Create JWT token
    const token = await jwt.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    }, c.env.JWT_SECRET);
    
    return c.json({
      message: 'Вход выполнен',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (e) {
    console.error('Login error:', e);
    return c.json({ error: 'Ошибка сервера' }, 500);
  }
});

// Auth middleware
const auth = jwt({ secret: (c) => c.env.JWT_SECRET });

// Protected routes - Get current user
app.get('/api/me', auth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const db = c.env.DB;
    const user = await db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').bind(payload.sub).first();
    
    if (!user) {
      return c.json({ error: 'Пользователь не найден' }, 404);
    }
    
    return c.json({ user });
  } catch (e) {
    console.error('Get user error:', e);
    return c.json({ error: 'Ошибка сервера' }, 500);
  }
});

// Protected routes - Reports CRUD
app.get('/api/reports', auth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const db = c.env.DB;
    
    const reports = await db.prepare(
      'SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(payload.sub).all();
    
    return c.json({ reports: reports.results || [] });
  } catch (e) {
    console.error('Get reports error:', e);
    return c.json({ error: 'Ошибка сервера' }, 500);
  }
});

app.post('/api/reports', auth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const { title } = await c.req.json();
    
    if (!title) {
      return c.json({ error: 'Название отчёта обязательно' }, 400);
    }
    
    const db = c.env.DB;
    const reportId = uid();
    const code = 'REP-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const createdAt = Math.floor(Date.now() / 1000);
    
    await db.prepare(
      'INSERT INTO reports (id, title, code, date, progress, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(reportId, title, code, new Date().toISOString().split('T')[0], 0, payload.sub, createdAt).run();
    
    const report = await db.prepare('SELECT * FROM reports WHERE id = ?').bind(reportId).first();
    
    return c.json({ report });
  } catch (e) {
    console.error('Create report error:', e);
    return c.json({ error: 'Ошибка сервера' }, 500);
  }
});

app.delete('/api/reports/:id', auth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const reportId = c.req.param('id');
    const db = c.env.DB;
    
    // Check ownership
    const report = await db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?').bind(reportId, payload.sub).first();
    if (!report) {
      return c.json({ error: 'Отчёт не найден' }, 404);
    }
    
    // Delete situations first
    await db.prepare('DELETE FROM situations WHERE report_id = ?').bind(reportId).run();
    // Delete report
    await db.prepare('DELETE FROM reports WHERE id = ?').bind(reportId).run();
    
    return c.json({ message: 'Отчёт удалён' });
  } catch (e) {
    console.error('Delete report error:', e);
    return c.json({ error: 'Ошибка сервера' }, 500);
  }
});

// Protected routes - Situations CRUD
app.get('/api/situations/:reportId', auth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const reportId = c.req.param('reportId');
    const db = c.env.DB;
    
    // Check ownership
    const report = await db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?').bind(reportId, payload.sub).first();
    if (!report) {
      return c.json({ error: 'Отчёт не найден' }, 404);
    }
    
    const situations = await db.prepare(
      'SELECT * FROM situations WHERE report_id = ? ORDER BY created_at DESC'
    ).bind(reportId).all();
    
    // Group by subsection
    const grouped = {};
    (situations.results || []).forEach(sit => {
      if (!grouped[sit.subsection]) grouped[sit.subsection] = [];
      grouped[sit.subsection].push(sit);
    });
    
    return c.json({ situations: grouped });
  } catch (e) {
    console.error('Get situations error:', e);
    return c.json({ error: 'Ошибка сервера' }, 500);
  }
});

app.post('/api/situations', auth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const { report_id, subsection, url, description } = await c.req.json();
    
    if (!report_id || !subsection || !url) {
      return c.json({ error: 'Все поля обязательны' }, 400);
    }
    
    const db = c.env.DB;
    
    // Check ownership
    const report = await db.prepare('SELECT * FROM reports WHERE id = ? AND user_id = ?').bind(report_id, payload.sub).first();
    if (!report) {
      return c.json({ error: 'Отчёт не найден' }, 404);
    }
    
    const situationId = uid();
    const createdAt = Math.floor(Date.now() / 1000);
    
    await db.prepare(
      'INSERT INTO situations (id, report_id, subsection, url, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(situationId, report_id, subsection, url, description || null, createdAt).run();
    
    const situation = await db.prepare('SELECT * FROM situations WHERE id = ?').bind(situationId).first();
    
    return c.json({ situation });
  } catch (e) {
    console.error('Create situation error:', e);
    return c.json({ error: 'Ошибка сервера' }, 500);
  }
});

app.put('/api/situations/:id', auth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const situationId = c.req.param('id');
    const { url, description } = await c.req.json();
    const db = c.env.DB;
    
    // Check ownership via report
    const situation = await db.prepare(`
      SELECT s.*, r.user_id FROM situations s 
      JOIN reports r ON s.report_id = r.id 
      WHERE s.id = ? AND r.user_id = ?
    `).bind(situationId, payload.sub).first();
    
    if (!situation) {
      return c.json({ error: 'Ситуация не найдена' }, 404);
    }
    
    await db.prepare(
      'UPDATE situations SET url = ?, description = ? WHERE id = ?'
    ).bind(url, description || null, situationId).run();
    
    const updated = await db.prepare('SELECT * FROM situations WHERE id = ?').bind(situationId).first();
    
    return c.json({ situation: updated });
  } catch (e) {
    console.error('Update situation error:', e);
    return c.json({ error: 'Ошибка сервера' }, 500);
  }
});

app.delete('/api/situations/:id', auth, async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const situationId = c.req.param('id');
    const db = c.env.DB;
    
    // Check ownership via report
    const situation = await db.prepare(`
      SELECT s.*, r.user_id FROM situations s 
      JOIN reports r ON s.report_id = r.id 
      WHERE s.id = ? AND r.user_id = ?
    `).bind(situationId, payload.sub).first();
    
    if (!situation) {
      return c.json({ error: 'Ситуация не найдена' }, 404);
    }
    
    await db.prepare('DELETE FROM situations WHERE id = ?').bind(situationId).run();
    
    return c.json({ message: 'Ситуация удалена' });
  } catch (e) {
    console.error('Delete situation error:', e);
    return c.json({ error: 'Ошибка сервера' }, 500);
  }
});

// Serve static HTML
app.get('/auth', async (c) => {
  const authHtml = await c.env.ASSETS.fetch(new Request('https://placeholder/auth.html')).then(r => r.text());
  return c.html(authHtml);
});

app.get('/', async (c) => {
  return c.html(await c.env.ASSETS.fetch(c.req.raw).then(r => r.text()));
});

app.get('/*', async (c) => {
  return c.html(await c.env.ASSETS.fetch(c.req.raw).then(r => r.text()));
});

export default app;
