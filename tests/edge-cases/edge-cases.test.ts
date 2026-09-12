/**
 * Edge-case tests for the application
 * Covers boundary conditions, error paths, and unexpected inputs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  orderBy,
  buildQuery,
  normalizePayload,
  denormalizeRow,
  resolveColumn,
  where,
  limit,
  deleteField,
  collection,
  doc,
} from '../../src/db';

describe('Edge Cases: orderBy', () => {
  it('should handle empty string direction', () => {
    const result = orderBy('field', '');
    expect(result.ascending).toBe(false);
  });

  it('should handle null direction', () => {
    const result = orderBy('field', null as any);
    expect(result.ascending).toBe(false);
  });

  it('should handle numeric direction', () => {
    const result = orderBy('field', 1 as any);
    expect(result.ascending).toBe(false);
  });

  it('should handle case-sensitive direction values', () => {
    const result = orderBy('field', 'DESC');
    expect(result.ascending).toBe(false);
  });

  it('should handle case-sensitive asc value', () => {
    const result = orderBy('field', 'ASC');
    expect(result.ascending).toBe(true);
  });
});

describe('Edge Cases: normalizePayload', () => {
  it('should handle empty object', () => {
    expect(normalizePayload('users', {})).toEqual({});
  });

  it('should handle null input', () => {
    expect(normalizePayload('users', null)).toBe(null);
  });

  it('should handle undefined input', () => {
    expect(normalizePayload('users', undefined)).toBe(undefined);
  });

  it('should handle string input', () => {
    expect(normalizePayload('users', 'hello')).toBe('hello');
  });

  it('should handle number input', () => {
    expect(normalizePayload('users', 42)).toBe(42);
  });

  it('should handle boolean input', () => {
    expect(normalizePayload('users', true)).toBe(true);
  });

  it('should handle array with mixed types', () => {
    const result = normalizePayload('users', [
      { createdAt: '2024-01-01' },
      'string',
      42,
      null,
    ]);
    expect(result[0].created_at).toBe('2024-01-01');
    expect(result[1]).toBe('string');
    expect(result[2]).toBe(42);
    expect(result[3]).toBe(null);
  });

  it('should handle nested objects (deep normalization is not expected)', () => {
    const result = normalizePayload('users', { createdAt: '2024-01-01', nested: { createdAt: '2024-01-01' } });
    expect(result.created_at).toBe('2024-01-01');
    // Nested objects are not recursively normalized
    expect(result.nested).toEqual({ createdAt: '2024-01-01' });
  });
});

describe('Edge Cases: denormalizeRow', () => {
  it('should handle empty object', () => {
    expect(denormalizeRow('users', {})).toEqual({});
  });

  it('should handle null input', () => {
    expect(denormalizeRow('users', null)).toBe(null);
  });

  it('should handle undefined input', () => {
    expect(denormalizeRow('users', undefined)).toBe(undefined);
  });

  it('should handle non-object input', () => {
    expect(denormalizeRow('users', 'string')).toBe('string');
  });

  it('should handle rows with no alias mappings', () => {
    const result = denormalizeRow('unknown_table', { someField: 'value' });
    expect(result.someField).toBe('value');
  });
});

describe('Edge Cases: resolveColumn', () => {
  it('should handle empty table name', () => {
    expect(resolveColumn('', 'createdAt')).toBe('createdAt');
  });

  it('should handle column not in any alias map', () => {
    expect(resolveColumn('users', 'nonexistent')).toBe('nonexistent');
  });

  it('should handle id column for any table', () => {
    expect(resolveColumn('users', 'id')).toBe('id');
    expect(resolveColumn('kitchens', 'id')).toBe('id');
    expect(resolveColumn('orders', 'id')).toBe('id');
  });
});

describe('Edge Cases: buildQuery', () => {
  it('should handle empty constraints', () => {
    const coll = collection(null, 'users');
    const query = buildQuery(coll);
    expect(query.constraints).toEqual([]);
  });

  it('should handle a string as a constraint (non-constraint object)', () => {
    const coll = collection(null, 'users');
    // This is an edge case where a non-object is passed as a constraint
    // The normalization will try to access .field, .op, .value on a string
    const query = buildQuery(coll, 'invalid' as any);
    expect(query.constraints[0].type).toBe('where');
    expect(query.constraints[0].field).toBeUndefined();
  });
});

describe('Edge Cases: deleteField', () => {
  it('should always return the same sentinel shape', () => {
    const result1 = deleteField();
    const result2 = deleteField();
    expect(result1).toEqual(result2);
    expect(result1).toEqual({ __delete: true });
  });
});

describe('Edge Cases: collection and doc', () => {
  it('should handle empty table name', () => {
    const result = collection(null, '');
    expect(result.ref()).toBe('');
    expect(result.table).toBe('');
  });

  it('should handle empty doc id', () => {
    const result = doc(null, 'users', '');
    expect(result.ref()).toBe('users/');
    expect(result.id).toBe('');
  });
});

describe('Edge Cases: where', () => {
  it('should handle null value', () => {
    const result = where('field', '==', null);
    expect(result.value).toBeNull();
  });

  it('should handle undefined value', () => {
    const result = where('field', '==', undefined);
    expect(result.value).toBeUndefined();
  });

  it('should handle complex operator', () => {
    const result = where('field', 'in', ['a', 'b', 'c']);
    expect(result.op).toBe('in');
    expect(result.value).toEqual(['a', 'b', 'c']);
  });
});

describe('Edge Cases: limit', () => {
  it('should handle zero limit', () => {
    const result = limit(0);
    expect(result.n).toBe(0);
  });

  it('should handle negative limit', () => {
    const result = limit(-1);
    expect(result.n).toBe(-1);
  });

  it('should handle very large limit', () => {
    const result = limit(Number.MAX_SAFE_INTEGER);
    expect(result.n).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('Edge Cases: DatabaseService mappers with unexpected data', () => {
  let db: any;

  beforeEach(async () => {
    const { DatabaseService } = await import('../../src/database');
    db = new DatabaseService();
  });

  it('mapToUserProfile should handle missing created_at', () => {
    const result = (db as any).mapToUserProfile({
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test',
    });
    expect(typeof result.createdAt).toBe('number');
    expect(result.createdAt).toBeGreaterThan(0);
  });

  it('mapToUserProfile should handle null name', () => {
    const result = (db as any).mapToUserProfile({
      id: 'user-1',
      email: 'test@test.com',
      name: null,
    });
    expect(result.displayName).toBe('User');
  });

  it('mapToMenuItem should handle string isVeg', () => {
    const result = (db as any).mapToMenuItem({
      id: 'item-1',
      kitchenId: 'kit-1',
      name: 'Pizza',
      price: 10,
      isVeg: 'true',
    });
    expect(result.isVeg).toBe(true);
  });

  it('mapToOrder should handle string items', () => {
    const result = (db as any).mapToOrder({
      id: 'order-1',
      customerId: 'cust-1',
      customerName: 'John',
      customerPhone: '',
      customerAddress: '',
      kitchenId: 'kit-1',
      kitchenName: 'Kitchen',
      items: '[{"itemId":"i1","name":"Pizza","price":10,"quantity":2}]',
      subtotal: 20,
      total: 20,
      deliveryType: 'delivery',
      status: 'PENDING',
      deliveryPin: '1234',
      createdAt: '2024-01-01T00:00:00Z',
      scheduledTime: '',
    });
    expect(result.items).toBeInstanceOf(Array);
    expect(result.items[0].name).toBe('Pizza');
  });

  it('mapToOrder should handle malformed items JSON', () => {
    const result = (db as any).mapToOrder({
      id: 'order-1',
      customerId: 'cust-1',
      customerName: 'John',
      customerPhone: '',
      customerAddress: '',
      kitchenId: 'kit-1',
      kitchenName: 'Kitchen',
      items: 'not-valid-json',
      subtotal: 20,
      total: 20,
      deliveryType: 'delivery',
      status: 'PENDING',
      deliveryPin: '1234',
      createdAt: '2024-01-01T00:00:00Z',
      scheduledTime: '',
    });
    expect(result.items).toEqual([]);
  });

  it('mapToFeedPost should handle string likes', () => {
    const result = (db as any).mapToFeedPost({
      id: 'post-1',
      kitchenId: 'kit-1',
      kitchenName: 'Kitchen',
      description: 'Test',
      imageUrl: '',
      likes: '["user-1", "user-2"]',
      taggedItemIds: [],
      createdAt: '2024-01-01T00:00:00Z',
      hasAiSparkle: 0,
      aiSparkleImposed: 0,
    });
    expect(result.likes).toEqual(['user-1', 'user-2']);
  });

  it('mapToFeedPost should handle malformed likes JSON', () => {
    const result = (db as any).mapToFeedPost({
      id: 'post-1',
      kitchenId: 'kit-1',
      kitchenName: 'Kitchen',
      description: 'Test',
      imageUrl: '',
      likes: 'not-valid-json',
      taggedItemIds: [],
      createdAt: '2024-01-01T00:00:00Z',
      hasAiSparkle: 0,
      aiSparkleImposed: 0,
    });
    expect(result.likes).toEqual([]);
  });
});
