/**
 * Lightweight in-memory database for Vercel deployment
 * WARNING: This is for development/testing only. Data is lost on restart.
 * For production, use Vercel Postgres, Turso, or PlanetScale.
 */

// In-memory store
const store = {
  users: new Map(),
  events: new Map(),
  messages: new Map(),
  contributions: new Map(),
  sessions: new Map(),
  event_images: new Map(),
};

let autoIncrementIds = {
  users: 1,
  events: 1,
  messages: 1,
  contributions: 1,
  sessions: 1,
  event_images: 1,
};

// D1-compatible interface for in-memory storage
class InMemoryDatabase {
  prepare(query) {
    const sql = query.toLowerCase();
    
    return {
      bind(...params) {
        return {
          async run() {
            try {
              const result = this._execute(sql, params);
              return {
                success: true,
                meta: {
                  last_row_id: result.lastInsertId || 0,
                  changes: result.changes || 0,
                  duration: 0,
                  rows_read: 0,
                  rows_written: result.changes || 0
                }
              };
            } catch (error) {
              console.error('Query error:', error);
              throw error;
            }
          },
          async first() {
            try {
              const result = this._execute(sql, params);
              return result.rows && result.rows[0] ? result.rows[0] : null;
            } catch (error) {
              console.error('Query error:', error);
              throw error;
            }
          },
          async all() {
            try {
              const result = this._execute(sql, params);
              return {
                success: true,
                results: result.rows || [],
                meta: {
                  duration: 0,
                  rows_read: result.rows ? result.rows.length : 0,
                  rows_written: 0
                }
              };
            } catch (error) {
              console.error('Query error:', error);
              throw error;
            }
          },
          _execute: (sql, params) => this._executeQuery(sql, params)
        };
      },
      async run() {
        const result = this._executeQuery(sql, []);
        return {
          success: true,
          meta: {
            last_row_id: result.lastInsertId || 0,
            changes: result.changes || 0,
            duration: 0,
            rows_read: 0,
            rows_written: result.changes || 0
          }
        };
      },
      async first() {
        const result = this._executeQuery(sql, []);
        return result.rows && result.rows[0] ? result.rows[0] : null;
      },
      async all() {
        const result = this._executeQuery(sql, []);
        return {
          success: true,
          results: result.rows || [],
          meta: {
            duration: 0,
            rows_read: result.rows ? result.rows.length : 0,
            rows_written: 0
          }
        };
      },
      _executeQuery: (sql, params) => this._executeQuery(sql, params)
    };
  }

  _executeQuery(sql, params) {
    // Simple SQL parser for common operations
    const insertMatch = sql.match(/insert into (\w+)\s*\((.*?)\)\s*values/i);
    const selectMatch = sql.match(/select (.*?) from (\w+)(?:\s+where (.*))?/i);
    const updateMatch = sql.match(/update (\w+) set (.*?)(?:\s+where (.*))?/i);
    const deleteMatch = sql.match(/delete from (\w+)(?:\s+where (.*))?/i);
    
    if (insertMatch) {
      return this._handleInsert(insertMatch, params);
    } else if (selectMatch) {
      return this._handleSelect(selectMatch, params);
    } else if (updateMatch) {
      return this._handleUpdate(updateMatch, params);
    } else if (deleteMatch) {
      return this._handleDelete(deleteMatch, params);
    } else if (sql.includes('create table')) {
      // Ignore table creation in memory mode
      return { success: true };
    }
    
    return { rows: [] };
  }

  _handleInsert(match, params) {
    const table = match[1];
    const id = autoIncrementIds[table]++;
    
    const row = { id, ...this._paramsToObject(params) };
    store[table].set(id, row);
    
    return {
      lastInsertId: id,
      changes: 1
    };
  }

  _handleSelect(match, params) {
    const table = match[2];
    const whereClause = match[3];
    
    let rows = Array.from(store[table].values());
    
    if (whereClause && params.length > 0) {
      rows = rows.filter(row => this._matchesWhere(row, whereClause, params));
    }
    
    return { rows };
  }

  _handleUpdate(match, params) {
    const table = match[1];
    const whereClause = match[3];
    
    let updated = 0;
    for (const [id, row] of store[table]) {
      if (!whereClause || this._matchesWhere(row, whereClause, params)) {
        Object.assign(row, this._paramsToObject(params.slice(0, -1)));
        updated++;
      }
    }
    
    return { changes: updated };
  }

  _handleDelete(match, params) {
    const table = match[1];
    const whereClause = match[2];
    
    let deleted = 0;
    for (const [id, row] of store[table]) {
      if (!whereClause || this._matchesWhere(row, whereClause, params)) {
        store[table].delete(id);
        deleted++;
      }
    }
    
    return { changes: deleted };
  }

  _matchesWhere(row, whereClause, params) {
    // Simple where matching - in production use real SQL parser
    const field = whereClause.split('=')[0].trim();
    return row[field] === params[params.length - 1];
  }

  _paramsToObject(params) {
    // Convert params array to object - this is simplified
    const obj = {};
    params.forEach((param, i) => {
      obj[`field_${i}`] = param;
    });
    return obj;
  }

  async exec(sql) {
    // Handle exec for multiple statements
    return {
      success: true,
      meta: { duration: 0 }
    };
  }
}

// R2 Bucket implementation (same as before)
class R2Bucket {
  constructor() {
    this.store = new Map();
  }

  async put(key, value) {
    const buffer = Buffer.from(await value.arrayBuffer());
    this.store.set(key, buffer);
    return {
      key,
      size: buffer.length,
      httpMetadata: value.type ? { contentType: value.type } : {}
    };
  }

  async get(key) {
    const buffer = this.store.get(key);
    if (!buffer) return null;
    
    return {
      key,
      body: buffer,
      httpMetadata: {
        contentType: 'application/octet-stream'
      }
    };
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list(options = {}) {
    const keys = Array.from(this.store.keys());
    const prefix = options.prefix || '';
    const filteredKeys = keys.filter(k => k.startsWith(prefix));
    
    return {
      objects: filteredKeys.map(key => ({
        key,
        size: this.store.get(key).length
      }))
    };
  }
}

export const d1Database = new InMemoryDatabase();
export const r2Bucket = new R2Bucket();

console.warn('⚠️  WARNING: Using in-memory database. Data will be lost on restart!');
console.warn('📝 For production, configure Vercel Postgres, Turso, or PlanetScale');
