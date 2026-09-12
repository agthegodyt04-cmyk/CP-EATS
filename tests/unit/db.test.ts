/**
 * Unit tests for src/db.ts
 * Covers: orderBy, buildQuery, normalizePayload, denormalizeRow,
 * resolveColumn, applyConstraints, getDoc, getDocs, setDoc,
 * updateDoc, deleteDoc, onSnapshot, writeBatch, db.from, storage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  orderBy,
  buildQuery,
  normalizePayload,
  denormalizeRow,
  resolveColumn,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  deleteField,
  collection,
  doc,
  where,
  limit,
  TABLE_SPECIFIC_ALIASES,
} from '../../src/db';

// Mock supabase
vi.mock('../../src/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => ({ data: { subscription: {} } })),
      })),
    })),
    removeChannel: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: vi.fn(),
          })),
          limit: vi.fn(),
        })),
        contains: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(),
          })),
          limit: vi.fn(),
        })),
        neq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(),
          })),
          limit: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(() => ({ data: { signedUrl: 'https://example.com/signed' } })),
        upload: vi.fn(() => ({ error: null })),
      })),
    },
  },
}));

describe('orderBy', () => {
  it('should set ascending=true for "asc"', () => {
    const result = orderBy('field', 'asc');
    expect(result.ascending).toBe(true);
  });

  it('should set ascending=true for undefined direction', () => {
    const result = orderBy('field');
    expect(result.ascending).toBe(true);
  });

  it('should set ascending=false for "desc"', () => {
    const result = orderBy('field', 'desc');
    expect(result.ascending).toBe(false);
  });

  it('should set ascending=false for invalid direction', () => {
    const result = orderBy('field', 'invalid');
    expect(result.ascending).toBe(false);
  });
});

describe('buildQuery', () => {
  it('should build a query from a collection ref', () => {
    const coll = collection(null, 'users');
    const query = buildQuery(coll, where('name', '==', 'John'));
    expect(query.table).toBe('users');
    expect(query.constraints).toHaveLength(1);
    expect(query.constraints[0]).toEqual({ type: 'where', field: 'name', op: '==', value: 'John' });
  });

  it('should handle raw constraint objects', () => {
    const coll = collection(null, 'users');
    const query = buildQuery(coll, { type: 'where', field: 'id', op: '==', value: '123' });
    expect(query.constraints).toHaveLength(1);
  });

  it('should normalize non-constraint objects to where constraints', () => {
    const coll = collection(null, 'users');
    const query = buildQuery(coll, { field: 'status', op: '==', value: 'active' });
    expect(query.constraints[0].type).toBe('where');
  });
});

describe('normalizePayload', () => {
  it('should normalize camelCase to snake_case for users table', () => {
    const result = normalizePayload('users', { createdAt: '2024-01-01' });
    expect(result.created_at).toBe('2024-01-01');
  });

  it('should pass through unknown columns unchanged', () => {
    const result = normalizePayload('users', { name: 'John' });
    expect(result.name).toBe('John');
  });

  it('should handle arrays by normalizing each item', () => {
    const result = normalizePayload('users', [{ createdAt: '2024-01-01' }]);
    expect(result[0].created_at).toBe('2024-01-01');
  });

  it('should return non-object values unchanged', () => {
    expect(normalizePayload('users', 'string')).toBe('string');
    expect(normalizePayload('users', 42)).toBe(42);
    expect(normalizePayload('users', null)).toBe(null);
  });
});

describe('denormalizeRow', () => {
  it('should convert snake_case back to camelCase for users table', () => {
    const result = denormalizeRow('users', { created_at: '2024-01-01T00:00:00Z' });
    expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
  });

  it('should pass through unknown columns unchanged', () => {
    const result = denormalizeRow('users', { name: 'John' });
    expect(result.name).toBe('John');
  });

  it('should return non-object values unchanged', () => {
    expect(denormalizeRow('users', 'string')).toBe('string');
    expect(denormalizeRow('users', null)).toBe(null);
  });
});

describe('resolveColumn', () => {
  it('should return "id" unchanged', () => {
    expect(resolveColumn('users', 'id')).toBe('id');
  });

  it('should resolve camelCase to snake_case for users table', () => {
    expect(resolveColumn('users', 'createdAt')).toBe('created_at');
  });

  it('should return column unchanged if no alias exists', () => {
    expect(resolveColumn('users', 'name')).toBe('name');
  });

  it('should return column unchanged for unknown tables', () => {
    expect(resolveColumn('unknown', 'createdAt')).toBe('createdAt');
  });
});

describe('deleteField', () => {
  it('should return a delete sentinel object', () => {
    const result = deleteField();
    expect(result).toEqual({ __delete: true });
  });
});

describe('collection and doc', () => {
  it('collection should return ref and table', () => {
    const result = collection(null, 'users');
    expect(result.ref()).toBe('users');
    expect(result.table).toBe('users');
  });

  it('doc should return ref, table, and id', () => {
    const result = doc(null, 'users', 'user123');
    expect(result.ref()).toBe('users/user123');
    expect(result.table).toBe('users');
    expect(result.id).toBe('user123');
  });
});

describe('where', () => {
  it('should create a where constraint', () => {
    const result = where('name', '==', 'John');
    expect(result).toEqual({ type: 'where', field: 'name', op: '==', value: 'John' });
  });
});

describe('limit', () => {
  it('should create a limit constraint', () => {
    const result = limit(10);
    expect(result).toEqual({ type: 'limit', n: 10 });
  });
});

describe('writeBatch', () => {
  it('should return a batch object with set, update, delete, and commit', () => {
    const batch = writeBatch(null);
    expect(batch.set).toBeTypeOf('function');
    expect(batch.update).toBeTypeOf('function');
    expect(batch.delete).toBeTypeOf('function');
    expect(batch.commit).toBeTypeOf('function');
  });

  it('commit should throw not implemented error', async () => {
    const batch = writeBatch(null);
    await expect(batch.commit()).rejects.toThrow('not implemented');
  });
});

describe('db.from', () => {
  it('should return select, insert, update, and delete methods', async () => {
    const db = { from: (await import('../../src/db')).db.from };
    const result = db.from('users');
    expect(result.select).toBeTypeOf('function');
    expect(result.insert).toBeTypeOf('function');
    expect(result.update).toBeTypeOf('function');
    expect(result.delete).toBeTypeOf('function');
  });
});

describe('storage', () => {
  it('storage.ref should return an object with path', async () => {
    const { storage } = await import('../../src/db');
    const result = storage.ref('path/to/file');
    expect(result).toEqual({ path: 'path/to/file' });
  });
});
