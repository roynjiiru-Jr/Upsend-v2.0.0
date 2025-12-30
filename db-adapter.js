import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create .data directory if it doesn't exist
const dataDir = join(__dirname, '.data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'upsend.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// D1-compatible interface for better-sqlite3
class D1Database {
  constructor(sqliteDb) {
    this.db = sqliteDb;
  }

  prepare(query) {
    const stmt = this.db.prepare(query);
    
    return {
      bind(...params) {
        return {
          async run() {
            try {
              const result = stmt.run(...params);
              return {
                success: true,
                meta: {
                  last_row_id: result.lastInsertRowid,
                  changes: result.changes,
                  duration: 0,
                  rows_read: 0,
                  rows_written: result.changes
                }
              };
            } catch (error) {
              throw error;
            }
          },
          async first() {
            try {
              const result = stmt.get(...params);
              return result || null;
            } catch (error) {
              throw error;
            }
          },
          async all() {
            try {
              const results = stmt.all(...params);
              return {
                success: true,
                results: results || [],
                meta: {
                  duration: 0,
                  rows_read: results.length,
                  rows_written: 0
                }
              };
            } catch (error) {
              throw error;
            }
          }
        };
      },
      async run() {
        try {
          const result = stmt.run();
          return {
            success: true,
            meta: {
              last_row_id: result.lastInsertRowid,
              changes: result.changes,
              duration: 0,
              rows_read: 0,
              rows_written: result.changes
            }
          };
        } catch (error) {
          throw error;
        }
      },
      async first() {
        try {
          const result = stmt.get();
          return result || null;
        } catch (error) {
          throw error;
        }
      },
      async all() {
        try {
          const results = stmt.all();
          return {
            success: true,
            results: results || [],
            meta: {
              duration: 0,
              rows_read: results.length,
              rows_written: 0
            }
          };
        } catch (error) {
          throw error;
        }
      }
    };
  }

  async batch(statements) {
    const transaction = this.db.transaction(() => {
      const results = [];
      for (const stmt of statements) {
        const result = stmt.run();
        results.push({
          success: true,
          meta: {
            last_row_id: result.lastInsertRowid,
            changes: result.changes
          }
        });
      }
      return results;
    });
    
    return transaction();
  }

  async exec(sql) {
    this.db.exec(sql);
    return {
      success: true,
      meta: {
        duration: 0
      }
    };
  }
}

// Simple in-memory storage for R2 (file storage)
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

export const d1Database = new D1Database(db);
export const r2Bucket = new R2Bucket();
export const sqliteDb = db;
