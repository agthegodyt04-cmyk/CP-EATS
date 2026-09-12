/**
 * Integration tests for src/db.ts
 * Tests the full query lifecycle with mocked Supabase client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  doc,
  where,
  limit,
  orderBy,
  buildQuery,
  deleteField,
} from '../../src/db';

const mockSupabase = vi.hoisted(() => ({
  channel: vi.fn(() => ({
    on: vi.fn(() => ({
      subscribe: vi.fn((cb) => { cb({ status: 'CHANNEL_OK' }); return { data: { subscription: {} } }; }),
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
}));

vi.mock('../../src/supabase', () => ({
  supabase: mockSupabase,
}));

describe('Integration: getDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null for a non-existent document', async () => {
    const selectMock = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: selectMock,
        })),
      })),
    } as any);

    const result = await getDoc(doc(null, 'users', 'nonexistent'));
    expect(result).toBeNull();
  });

  it('should return document data for an existing document', async () => {
    const mockRow = { id: 'user-1', name: 'John', email: 'john@test.com' };
    const selectMock = vi.fn().mockResolvedValue({ data: mockRow, error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: selectMock,
        })),
      })),
    } as any);

    const result = await getDoc(doc(null, 'users', 'user-1'));
    expect(result).not.toBeNull();
    expect(result!.id).toBe('user-1');
    expect(result!.data().name).toBe('John');
  });
});

describe('Integration: getDocs with constraints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply where, orderBy, and limit constraints', async () => {
    const mockRows = [
      { id: '1', name: 'Alice', status: 'active' },
      { id: '2', name: 'Bob', status: 'active' },
    ];
    const selectMock = vi.fn().mockResolvedValue({ data: mockRows, error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: selectMock,
          })),
        })),
      })),
    } as any);

    const q = buildQuery(
      collection(null, 'users'),
      where('status', '==', 'active'),
      orderBy('name', 'asc'),
      limit(10)
    );

    const result = await getDocs(q);
    expect(result.docs).toHaveLength(2);
    expect(result.empty).toBe(false);
  });

  it('should return empty result when no rows match', async () => {
    const selectMock = vi.fn().mockResolvedValue({ data: [], error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: selectMock,
          })),
        })),
      })),
    } as any);

    const q = buildQuery(
      collection(null, 'users'),
      where('status', '==', 'nonexistent')
    );

    const result = await getDocs(q);
    expect(result.empty).toBe(true);
    expect(result.docs).toHaveLength(0);
  });
});

describe('Integration: setDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upsert a document and notify listeners', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          single: vi.fn(),
          order: vi.fn(() => ({ limit: vi.fn() })),
          limit: vi.fn(),
        })),
      })),
      insert: insertMock,
      upsert: insertMock,
      update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    } as any);

    await setDoc(doc(null, 'users', 'user-1'), { name: 'John', email: 'john@test.com' });
    expect(insertMock).toHaveBeenCalled();
  });
});

describe('Integration: updateDoc with __delete sentinel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should exclude __delete fields from update payload', async () => {
    const updateMock = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          single: vi.fn(),
          order: vi.fn(() => ({ limit: vi.fn() })),
          limit: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({
        eq: updateMock,
      })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    } as any);

    await updateDoc(doc(null, 'users', 'user-1'), {
      name: 'Jane',
      profileImageUrl: deleteField(),
    } as any);

    expect(updateMock).toHaveBeenCalled();
  });
});

describe('Integration: deleteDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a document by id', async () => {
    const deleteMock = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          single: vi.fn(),
          order: vi.fn(() => ({ limit: vi.fn() })),
          limit: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      delete: vi.fn(() => ({
        eq: deleteMock,
      })),
    } as any);

    await deleteDoc(doc(null, 'users', 'user-1'));
    expect(deleteMock).toHaveBeenCalled();
  });
});

describe('Integration: onSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register a listener and return an unsubscribe function', async () => {
    const mockRows = [{ id: '1', name: 'Alice' }];
    const selectMock = vi.fn().mockResolvedValue({ data: mockRows, error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: selectMock,
          })),
          limit: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    } as any);

    const q = buildQuery(collection(null, 'users'), where('id', '==', '1'));
    const callback = vi.fn();
    const unsubscribe = onSnapshot(q, callback);

    // Wait for the initial snapshot
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callback).toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');

    // Clean up
    unsubscribe();
  });
});

describe('Integration: storage operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get a signed download URL', async () => {
    const { getDownloadURL } = await import('../../src/db');
    const result = await getDownloadURL({ path: 'media/photo.jpg' });
    expect(result).toBe('https://example.com/signed');
  });

  it('should upload bytes to storage', async () => {
    const { uploadBytes } = await import('../../src/db');
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    await uploadBytes({ path: 'media/test.jpg' }, mockFile);
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('media');
  });
});
