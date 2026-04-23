import { Hono } from 'hono';
import type { Bindings } from '../types';

const messages = new Hono<{ Bindings: Bindings }>();

// POST /api/messages/create
messages.post('/create', async (c) => {
  try {
    const body: any = await c.req.json();
    const { event_id, user_name, message_text } = body;

    if (!event_id || !message_text) {
      return c.json({ error: 'event_id and message_text are required' }, 400);
    }

    const db = c.env.DB;

    // Verify event exists
    const event: any = await db.prepare('SELECT id FROM events WHERE id = ?').bind(event_id).first();
    if (!event) return c.json({ error: 'Event not found' }, 404);

    const result = await db.prepare(`
      INSERT INTO messages (event_id, user_name, message_text)
      VALUES (?, ?, ?)
    `).bind(event_id, user_name || null, message_text).run();

    return c.json({ success: true, message_id: result.meta.last_row_id });
  } catch (err: any) {
    console.error('Create message error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// GET /api/messages/:eventId - List messages for an event
messages.get('/:eventId', async (c) => {
  try {
    const eventId = parseInt(c.req.param('eventId'));
    const db = c.env.DB;

    const result = await db.prepare(
      'SELECT * FROM messages WHERE event_id = ? ORDER BY created_at ASC'
    ).bind(eventId).all();

    return c.json({ messages: result.results });
  } catch (err: any) {
    console.error('Get messages error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default messages;
