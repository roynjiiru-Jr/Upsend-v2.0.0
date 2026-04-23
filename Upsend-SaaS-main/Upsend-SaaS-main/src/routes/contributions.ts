import { Hono } from 'hono';
import type { Bindings } from '../types';

const contributions = new Hono<{ Bindings: Bindings }>();

// ─── POST /api/contributions ─────────────────────────────────────────────────
// "I Have Contributed" submission — stores self-reported contribution.
contributions.post('/', async (c) => {
  try {
    const body: any = await c.req.json();
    const { event_id, name, amount, message } = body;

    if (!event_id) {
      return c.json({ error: 'event_id is required' }, 400);
    }
    if (!name || !name.trim()) {
      return c.json({ error: 'name is required' }, 400);
    }

    const db = c.env.DB;

    // Verify event exists
    const event: any = await db
      .prepare('SELECT id FROM events WHERE id = ?')
      .bind(event_id)
      .first();
    if (!event) return c.json({ error: 'Event not found' }, 404);

    const parsedAmount = amount ? parseFloat(amount) : null;
    if (parsedAmount !== null && (isNaN(parsedAmount) || parsedAmount < 0)) {
      return c.json({ error: 'Invalid amount' }, 400);
    }

    const result = await db.prepare(`
      INSERT INTO contributions (event_id, contributor_name, amount, message)
      VALUES (?, ?, ?, ?)
    `).bind(
      event_id,
      name.trim(),
      parsedAmount,
      message?.trim() || null,
    ).run();

    console.log(`[Contributions] Saved — event=${event_id}, name=${name}, amount=${parsedAmount}`);

    return c.json({ success: true, contribution_id: result.meta.last_row_id });
  } catch (err: any) {
    console.error('[Contributions] POST error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ─── GET /api/contributions/:eventId ─────────────────────────────────────────
contributions.get('/:eventId', async (c) => {
  try {
    const eventId = parseInt(c.req.param('eventId'));
    if (isNaN(eventId)) return c.json({ error: 'Invalid event ID' }, 400);

    const db = c.env.DB;
    const result = await db.prepare(
      'SELECT id, contributor_name, amount, message, created_at FROM contributions WHERE event_id = ? ORDER BY created_at DESC'
    ).bind(eventId).all();

    const total = (result.results as any[]).reduce(
      (sum, row) => sum + (row.amount ? parseFloat(row.amount) : 0),
      0,
    );

    return c.json({ contributions: result.results, total_contributions: total });
  } catch (err: any) {
    console.error('[Contributions] GET error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

export default contributions;
