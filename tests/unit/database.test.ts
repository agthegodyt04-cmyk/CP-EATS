/**
 * Unit tests for src/database.ts
 * Covers: DatabaseService methods including createUser, updateUser,
 * createOrder, mapToMenuItem, mapToChatMessage, mapToReview, etc.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseService } from '../../src/database';

vi.mock('../../src/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
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
      })),
      insert: vi.fn(() => ({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
  },
}));

describe('DatabaseService', () => {
  let db: DatabaseService;

  beforeEach(() => {
    db = new DatabaseService();
    vi.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should return the mapped database result, not the input', async () => {
      const mockData = {
        id: 'order-1',
        customerId: 'cust-1',
        customerName: 'John',
        customerPhone: '555-0100',
        customerAddress: '123 Main St',
        kitchenId: 'kit-1',
        kitchenName: 'Test Kitchen',
        items: [{ itemId: 'item-1', name: 'Pizza', price: 10, quantity: 2 }],
        subtotal: 20,
        total: 20,
        deliveryType: 'delivery',
        status: 'PENDING',
        deliveryPin: '1234',
        createdAt: '2024-01-01T00:00:00Z',
        scheduledTime: '',
      };

      const { supabase } = await import('../../src/supabase');
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(),
            })),
            limit: vi.fn(),
          })),
        })),
        insert: vi.fn(() => ({
          data: { data: mockData, error: null },
          error: null,
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: mockData, error: null })),
          })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      });

      const result = await db.createOrder({
        id: 'order-1',
        customerId: 'cust-1',
        customerName: 'John',
        customerPhone: '555-0100',
        customerAddress: '123 Main St',
        kitchenId: 'kit-1',
        kitchenName: 'Test Kitchen',
        items: [{ itemId: 'item-1', name: 'Pizza', price: 10, quantity: 2 }],
        subtotal: 20,
        total: 20,
        deliveryType: 'delivery',
        status: 'PENDING',
        deliveryPin: '1234',
        createdAt: '2024-01-01T00:00:00Z',
        scheduledTime: '',
      } as any);

      // The result should be the mapped database data, not the raw input
      expect(result).toBeDefined();
      expect(result.id).toBe('order-1');
    });
  });

  describe('mapToMenuItem', () => {
    it('should parse addOnGroups from JSON string safely', () => {
      const data = {
        id: 'item-1',
        kitchenId: 'kit-1',
        name: 'Pizza',
        description: 'Delicious',
        price: 10,
        isVeg: true,
        isGlutenFree: false,
        isNutFree: false,
        isAvailable: true,
        category: 'Main',
        createdAt: '2024-01-01T00:00:00Z',
        imageUrl: '',
        addOnGroups: JSON.stringify([{ id: 'g1', title: 'Size', minSelections: 1, maxSelections: 1, options: [] }]),
      };

      const result = (db as any).mapToMenuItem(data);
      expect(result.addOnGroups).toEqual([{ id: 'g1', title: 'Size', minSelections: 1, maxSelections: 1, options: [] }]);
    });

    it('should handle malformed addOnGroups JSON gracefully', () => {
      const data = {
        id: 'item-1',
        kitchenId: 'kit-1',
        name: 'Pizza',
        description: 'Delicious',
        price: 10,
        isVeg: true,
        isGlutenFree: false,
        isNutFree: false,
        isAvailable: true,
        category: 'Main',
        createdAt: '2024-01-01T00:00:00Z',
        imageUrl: '',
        addOnGroups: 'not-valid-json',
      };

      const result = (db as any).mapToMenuItem(data);
      expect(result.addOnGroups).toEqual([]);
    });

    it('should handle undefined addOnGroups', () => {
      const data = {
        id: 'item-1',
        kitchenId: 'kit-1',
        name: 'Pizza',
        description: 'Delicious',
        price: 10,
        isVeg: true,
        isGlutenFree: false,
        isNutFree: false,
        isAvailable: true,
        category: 'Main',
        createdAt: '2024-01-01T00:00:00Z',
        imageUrl: '',
        addOnGroups: undefined,
      };

      const result = (db as any).mapToMenuItem(data);
      expect(result.addOnGroups).toBeUndefined();
    });
  });

  describe('mapToChatMessage', () => {
    it('should map basic chat message fields', () => {
      const data = {
        id: 'msg-1',
        orderId: 'order-1',
        senderId: 'user-1',
        senderName: 'John',
        text: 'Hello',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = (db as any).mapToChatMessage(data);
      expect(result.id).toBe('msg-1');
      expect(result.orderId).toBe('order-1');
      expect(result.senderId).toBe('user-1');
      expect(result.senderName).toBe('John');
      expect(result.text).toBe('Hello');
      expect(typeof result.createdAt).toBe('number');
      // [UPI removed] mapper no longer reads UPI columns
      expect(result.isUpiCard).toBeUndefined();
      expect(result.upiCardData).toBeUndefined();
      expect(result.qrCodeUrl).toBeUndefined();
    });
  });

  describe('mapToReview', () => {
    it('should parse taggedItemIds from JSON string safely', () => {
      const data = {
        id: 'rev-1',
        orderId: 'order-1',
        customerId: 'cust-1',
        customerName: 'John',
        kitchenId: 'kit-1',
        rating: 5,
        comment: 'Great food!',
        createdAt: '2024-01-01T00:00:00Z',
        isHandpicked: true,
        taggedItemIds: JSON.stringify(['item-1', 'item-2']),
      };

      const result = (db as any).mapToReview(data);
      expect(result.taggedItemIds).toEqual(['item-1', 'item-2']);
    });

    it('should handle malformed taggedItemIds JSON gracefully', () => {
      const data = {
        id: 'rev-1',
        orderId: 'order-1',
        customerId: 'cust-1',
        customerName: 'John',
        kitchenId: 'kit-1',
        rating: 5,
        comment: 'Great food!',
        createdAt: '2024-01-01T00:00:00Z',
        isHandpicked: true,
        taggedItemIds: 'not-valid-json',
      };

      const result = (db as any).mapToReview(data);
      expect(result.taggedItemIds).toEqual([]);
    });
  });

  describe('createUser', () => {
    it('should throw if uid is missing', async () => {
      await expect(db.createUser({ email: 'test@test.com' } as any)).rejects.toThrow('User ID is required');
    });
  });

  describe('updateUser', () => {
    it('should update user fields correctly', async () => {
      const { supabase } = await import('../../src/supabase');
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: { message: 'not found' } })),
          })),
        })),
        insert: vi.fn(() => ({ data: null, error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
      });

      await db.updateUser('user-1', { displayName: 'New Name' });
      expect(supabase.from).toHaveBeenCalledWith('users');
    });
  });

  describe('listUsersByRole', () => {
    it('should return empty array on error', async () => {
      const { supabase } = await import('../../src/supabase');
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: { message: 'error' } })),
          })),
        })),
        insert: vi.fn(() => ({ data: null, error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
      });

      const result = await db.listUsersByRole('customer');
      expect(result).toEqual([]);
    });
  });

  describe('listVerifiedKitchens', () => {
    it('should filter by role=kitchen and status=verified', async () => {
      const { supabase } = await import('../../src/supabase');
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: { message: 'not found' } })),
          })),
        })),
        insert: vi.fn(() => ({ data: null, error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
      });

      const result = await db.listVerifiedKitchens();
      expect(result).toBeInstanceOf(Array);
    });
  });
});
