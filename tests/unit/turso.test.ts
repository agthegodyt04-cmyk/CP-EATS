/**
 * Unit tests for src/turso.ts
 * Covers: initializeDatabase, getUserById, createUser, getAllMeals, createMeal
 *
 * src/turso.ts creates the libsql client once at module scope, so these tests
 * drive the shared `turso.execute` mock directly. (Re-importing an
 * already-evaluated ESM module returns the same instance, so re-mocking
 * `createClient` per test never takes effect.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { turso, initializeDatabase, getUserById, createUser, getAllMeals, createMeal } from '../../src/turso';

vi.mock('@libsql/client', () => ({
  createClient: vi.fn(() => ({
    execute: vi.fn(),
  })),
}));

const executeMock = vi.mocked(turso.execute);

describe('turso', () => {
  beforeEach(() => {
    executeMock.mockReset();
  });

  describe('initializeDatabase', () => {
    it('should execute all CREATE TABLE statements', async () => {
      executeMock.mockResolvedValue({ rows: [] } as any);

      await initializeDatabase();

      const createTableCalls = executeMock.mock.calls.filter(
        ([statement]) => String(statement).includes('CREATE TABLE IF NOT EXISTS')
      );
      expect(createTableCalls.length).toBeGreaterThan(0);
    });

    it('should throw and log error on initialization failure', async () => {
      executeMock.mockRejectedValue(new Error('Connection failed'));

      await expect(initializeDatabase()).rejects.toThrow('Connection failed');
    });
  });

  describe('getUserById', () => {
    it('should return user row when found', async () => {
      executeMock.mockResolvedValue({
        rows: [{ id: 'user-1', email: 'test@test.com', name: 'Test User' }],
      } as any);

      const result = await getUserById('user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@test.com');
      expect(executeMock).toHaveBeenCalledWith({
        sql: 'SELECT * FROM users WHERE id = ?',
        args: ['user-1'],
      });
    });

    it('should return undefined when user not found', async () => {
      executeMock.mockResolvedValue({ rows: [] } as any);

      const result = await getUserById('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('createUser', () => {
    it('should insert a user with provided fields', async () => {
      executeMock.mockResolvedValue({ rows: [] } as any);

      await createUser({ id: 'user-1', email: 'test@test.com', name: 'Test User' });

      expect(executeMock).toHaveBeenCalledWith({
        sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
        args: ['user-1', 'test@test.com', 'Test User'],
      });
    });

    it('should insert null for optional name when not provided', async () => {
      executeMock.mockResolvedValue({ rows: [] } as any);

      await createUser({ id: 'user-1', email: 'test@test.com' });

      expect(executeMock).toHaveBeenCalledWith({
        sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
        args: ['user-1', 'test@test.com', null],
      });
    });
  });

  describe('getAllMeals', () => {
    it('should return all meals ordered by created_at DESC', async () => {
      const mockRows = [
        { id: 'meal-1', user_id: 'user-1', name: 'Meal 1', price: 10, created_at: '2024-01-02T00:00:00Z' },
        { id: 'meal-2', user_id: 'user-1', name: 'Meal 2', price: 15, created_at: '2024-01-01T00:00:00Z' },
      ];
      executeMock.mockResolvedValue({ rows: mockRows } as any);

      const result = await getAllMeals();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Meal 1');
      expect(executeMock).toHaveBeenCalledWith('SELECT * FROM meals ORDER BY created_at DESC');
    });

    it('should return empty array when no meals exist', async () => {
      executeMock.mockResolvedValue({ rows: [] } as any);

      const result = await getAllMeals();

      expect(result).toEqual([]);
    });
  });

  describe('createMeal', () => {
    it('should insert a meal with all required fields', async () => {
      executeMock.mockResolvedValue({ rows: [] } as any);

      await createMeal({
        id: 'meal-1',
        user_id: 'user-1',
        name: 'Pasta',
        description: 'Delicious pasta',
        price: 12.99,
      });

      expect(executeMock).toHaveBeenCalledWith({
        sql: 'INSERT INTO meals (id, user_id, name, description, price) VALUES (?, ?, ?, ?, ?)',
        args: ['meal-1', 'user-1', 'Pasta', 'Delicious pasta', 12.99],
      });
    });

    it('should insert null for optional description when not provided', async () => {
      executeMock.mockResolvedValue({ rows: [] } as any);

      await createMeal({
        id: 'meal-1',
        user_id: 'user-1',
        name: 'Pasta',
        price: 12.99,
      });

      expect(executeMock).toHaveBeenCalledWith({
        sql: 'INSERT INTO meals (id, user_id, name, description, price) VALUES (?, ?, ?, ?, ?)',
        args: ['meal-1', 'user-1', 'Pasta', null, 12.99],
      });
    });
  });
});
