import { Hono } from 'hono';
import type { Bindings } from '../types';

const events = new Hono<{ Bindings: Bindings }>();

// Helper: get user from session
async function getUserFromSession(db: D1Database, authHeader: string | undefined): Promise<any> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const sessionToken = authHeader.slice(7);
  const now = Math.floor(Date.now() / 1000);
  const session: any = await db.prepare(
    'SELECT * FROM sessions WHERE session_token = ? AND expires_at > ?'
  ).bind(sessionToken, now).first();
  if (!session) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first();
}

// Helper: generate shareable link
function generateShareableLink(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 10; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// ─── POST /api/events/create ─────────────────────────────────────────────────
events.post('/create', async (c) => {
  try {
    const user = await getUserFromSession(c.env.DB, c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const body: any = await c.req.json();
    const {
      title,
      description,
      event_date,
      cover_image,
      images,
      // payment fields
      payment_method,
      payment_phone,
      payment_name,
      payment_paybill,
      payment_account,
      payment_till,
      payment_link,
    } = body;

    if (!title || !event_date) {
      return c.json({ error: 'Title and event date are required' }, 400);
    }

    const shareableLink = generateShareableLink();
    const db = c.env.DB;

    const result = await db.prepare(`
      INSERT INTO events
        (user_id, title, description, event_date, cover_image, shareable_link,
         payment_method, payment_phone, payment_name, payment_paybill,
         payment_account, payment_till, payment_link)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.id,
      title,
      description || null,
      event_date,
      cover_image || null,
      shareableLink,
      payment_method  || null,
      payment_phone   || null,
      payment_name    || null,
      payment_paybill || null,
      payment_account || null,
      payment_till    || null,
      payment_link    || null,
    ).run();

    const eventId = result.meta.last_row_id;

    // Save event images if provided
    if (images && Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        await db.prepare(`
          INSERT INTO event_images (event_id, image_url, image_key, is_cover, display_order)
          VALUES (?, ?, ?, ?, ?)
        `).bind(eventId, img.url, img.key, img.is_cover ? 1 : 0, img.display_order || 0).run();
      }
    }

    return c.json({ success: true, event_id: eventId, shareable_link: shareableLink });
  } catch (err: any) {
    console.error('Create event error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ─── GET /api/events/creator/list ────────────────────────────────────────────
events.get('/creator/list', async (c) => {
  try {
    const user = await getUserFromSession(c.env.DB, c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = c.env.DB;
    const result = await db.prepare(`
      SELECT e.*,
        COUNT(DISTINCT m.id)  AS message_count,
        COUNT(DISTINCT co.id) AS contribution_count,
        COALESCE(SUM(co.amount), 0) AS total_contributions
      FROM events e
      LEFT JOIN messages m       ON m.event_id  = e.id
      LEFT JOIN contributions co ON co.event_id = e.id
      WHERE e.user_id = ?
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `).bind(user.id).all();

    return c.json({ events: result.results });
  } catch (err: any) {
    console.error('List events error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ─── GET /api/events/creator/:eventId ────────────────────────────────────────
events.get('/creator/:eventId', async (c) => {
  try {
    const user = await getUserFromSession(c.env.DB, c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const eventId = parseInt(c.req.param('eventId'));
    const db = c.env.DB;

    const event: any = await db.prepare(
      'SELECT * FROM events WHERE id = ? AND user_id = ?'
    ).bind(eventId, user.id).first();

    if (!event) return c.json({ error: 'Event not found' }, 404);

    const messages = await db.prepare(
      'SELECT * FROM messages WHERE event_id = ? ORDER BY created_at DESC'
    ).bind(eventId).all();

    const contributions = await db.prepare(
      'SELECT id, contributor_name, amount, message, created_at FROM contributions WHERE event_id = ? ORDER BY created_at DESC'
    ).bind(eventId).all();

    const totalContributions = (contributions.results as any[]).reduce(
      (sum, row) => sum + (row.amount ? parseFloat(row.amount) : 0),
      0,
    );

    return c.json({
      event,
      messages: messages.results,
      contributions: contributions.results,
      total_contributions: totalContributions,
    });
  } catch (err: any) {
    console.error('Get creator event error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ─── GET /api/events/info/:eventId ───────────────────────────────────────────
// Lightweight public endpoint — returns id, title, shareable_link only.
events.get('/info/:eventId', async (c) => {
  try {
    const eventId = parseInt(c.req.param('eventId'));
    const db = c.env.DB;
    const event: any = await db.prepare(
      'SELECT id, title, shareable_link FROM events WHERE id = ?'
    ).bind(eventId).first();
    if (!event) return c.json({ error: 'Event not found' }, 404);
    return c.json({ id: event.id, title: event.title, shareable_link: event.shareable_link });
  } catch (err: any) {
    console.error('Get event info error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ─── GET /api/events/:shareableLink ──────────────────────────────────────────
// Public event page data
events.get('/:shareableLink', async (c) => {
  try {
    const shareableLink = c.req.param('shareableLink');
    const db = c.env.DB;

    const event: any = await db.prepare(`
      SELECT e.*, u.name AS creator_name
      FROM events e
      JOIN users u ON u.id = e.user_id
      WHERE e.shareable_link = ?
    `).bind(shareableLink).first();

    if (!event) return c.json({ error: 'Event not found' }, 404);

    const messages = await db.prepare(
      'SELECT * FROM messages WHERE event_id = ? ORDER BY created_at ASC'
    ).bind(event.id).all();

    // Fetch images
    const images = await db.prepare(
      'SELECT * FROM event_images WHERE event_id = ? ORDER BY display_order ASC'
    ).bind(event.id).all();

    // Fetch contributions (for public display — no amounts shown publicly)
    const contributions = await db.prepare(
      'SELECT id, contributor_name, amount, message, created_at FROM contributions WHERE event_id = ? ORDER BY created_at DESC'
    ).bind(event.id).all();

    return c.json({
      event: { ...event, images: images.results },
      messages: messages.results,
      contributions: contributions.results,
    });
  } catch (err: any) {
    console.error('Get public event error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default events;
