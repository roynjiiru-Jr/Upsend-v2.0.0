import { Hono } from 'hono';
import type { Bindings } from '../types';

const auth = new Hono<{ Bindings: Bindings }>();

// Helper: generate random token
function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// POST /api/auth/magic-link - Request a magic link
auth.post('/magic-link', async (c) => {
  try {
    const { email, name } = await c.req.json<{ email: string; name?: string }>();

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    const db = c.env.DB;

    // Check if user exists
    let user: any = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

    if (!user) {
      // New user - name is required
      if (!name) {
        return c.json({ error: 'Name is required for new users' }, 400);
      }

      const result = await db.prepare(
        'INSERT INTO users (email, name) VALUES (?, ?)'
      ).bind(email, name).run();

      user = { id: result.meta.last_row_id, email, name };
    }

    // Generate magic link token (expires in 15 minutes)
    const token = generateToken(48);
    const expiresAt = Math.floor(Date.now() / 1000) + 900;

    await db.prepare(
      'INSERT INTO magic_links (user_id, email, token, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(user.id, email, token, expiresAt).run();

    const reqUrl = new URL(c.req.url);
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
    const verifyUrl = `${baseUrl}/auth?token=${token}`;

    return c.json({
      success: true,
      message: 'Magic link sent! Check your email.',
      // For development/MVP testing - expose the link directly
      dev_link: verifyUrl,
      dev_token: token,
    });
  } catch (err: any) {
    console.error('Magic link error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// POST /api/auth/verify - Verify magic link token
auth.post('/verify', async (c) => {
  try {
    const { token } = await c.req.json<{ token: string }>();

    if (!token) {
      return c.json({ error: 'Token is required' }, 400);
    }

    const db = c.env.DB;
    const now = Math.floor(Date.now() / 1000);

    const magicLink: any = await db.prepare(
      'SELECT * FROM magic_links WHERE token = ? AND used = 0 AND expires_at > ?'
    ).bind(token, now).first();

    if (!magicLink) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Mark token as used
    await db.prepare('UPDATE magic_links SET used = 1 WHERE id = ?').bind(magicLink.id).run();

    // Get or create user
    const user: any = await db.prepare('SELECT * FROM users WHERE id = ?').bind(magicLink.user_id).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Create session (expires in 30 days)
    const sessionToken = generateToken(64);
    const sessionExpiry = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

    await db.prepare(
      'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, sessionToken, sessionExpiry).run();

    return c.json({
      success: true,
      session_token: sessionToken,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err: any) {
    console.error('Verify error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// GET /api/auth/me - Get current user
auth.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const sessionToken = authHeader.slice(7);
    const db = c.env.DB;
    const now = Math.floor(Date.now() / 1000);

    const session: any = await db.prepare(
      'SELECT * FROM sessions WHERE session_token = ? AND expires_at > ?'
    ).bind(sessionToken, now).first();

    if (!session) {
      return c.json({ error: 'Session expired or invalid' }, 401);
    }

    const user: any = await db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?')
      .bind(session.user_id).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user });
  } catch (err: any) {
    console.error('Me error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const sessionToken = authHeader.slice(7);
      await c.env.DB.prepare('DELETE FROM sessions WHERE session_token = ?').bind(sessionToken).run();
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default auth;
