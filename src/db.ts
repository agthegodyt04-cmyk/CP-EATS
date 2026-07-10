import { supabase } from './supabase';
import { turso } from './turso';

type Listener = () => void;

const supabaseChannels = new Map<string, ReturnType<typeof supabase.channel>>();
const listeners = new Map<string, Set<Listener>>();

function notify(table: string) {
  const set = listeners.get(table);
  if (set) set.forEach(fn => fn());
}

export function deleteField() {
  return { __delete: true } as const;
}

export function collection(_db: any, table: string) {
  return { ref: () => table, table };
}

export function doc(_db: any, table: string, id: string) {
  return { ref: () => `${table}/${id}`, table, id };
}

function isConstraint(obj: any): obj is { type: string } {
  return obj && typeof obj === 'object' && obj.type;
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(fieldPath: string, directionStr?: string) {
  const ascending = directionStr === 'asc' || directionStr === undefined || directionStr === 'desc' ? true : false;
  return { type: 'orderBy', field: fieldPath, ascending };
}

export function limit(n: number) {
  return { type: 'limit', n };
}

export function buildQuery(collectionRef: any, ...constraints: any[]) {
  const base = collectionRef.ref ? collectionRef : { ref: () => collectionRef, table: collectionRef };
  const normalized = constraints.map(c => isConstraint(c) ? c : { type: 'where', field: c.field, op: c.op, value: c.value });
  const q: any = { ...base, constraints: normalized };
  return q;
}

async function applyConstraints(table: string, constraints: any[]): Promise<any> {
  let q: any = supabase.from(table).select('*');
  let orderField: string | null = null;
  let orderAsc = true;
  let limitCount: number | null = null;

  for (const c of constraints) {
    if (c.type === 'where') {
      if (c.op === '==') q = q.eq(c.field, c.value);
      else if (c.op === 'array-contains') q = q.contains(c.field, [c.value]);
      else if (c.op === '!=') q = q.neq(c.field, c.value);
      else q = q.eq(c.field, c.value);
    } else if (c.type === 'orderBy') {
      orderField = c.field;
      orderAsc = c.ascending !== false;
    } else if (c.type === 'limit') {
      limitCount = c.n;
    }
  }

  if (orderField) q = q.order(orderField, { ascending: orderAsc });
  if (limitCount) q = q.limit(limitCount);

  return q;
}

export async function getDoc(ref: any): Promise<{ exists: () => boolean; data: () => any; id: string } | null> {
  const table = ref.table;
  const id = ref.id;
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return {
    exists: () => true,
    data: () => data,
    id: data.id
  };
}

export async function getDocs(q: any): Promise<{ docs: any[]; empty: boolean; forEach: (fn: (d: any) => void) => void }> {
  const table = q.table;
  const queryBuilder = await applyConstraints(table, q.constraints || []);
  const { data, error } = await queryBuilder;
  if (error) return { docs: [], empty: true, forEach: () => {} };
  const docs = (data || []).map((row: any) => ({
    id: row.id,
    data: () => row,
    ref: () => doc(null, table, row.id)
  }));
  return {
    docs,
    empty: docs.length === 0,
    forEach: (fn: (d: any) => void) => docs.forEach(fn)
  };
}

export async function setDoc(ref: any, data: any): Promise<void> {
  const table = ref.table;
  const id = ref.id || data.id;
  const payload = { ...data, id };
  const { error } = await supabase.from(table).upsert(payload);
  if (error) throw error;
  notify(table);
}

export async function updateDoc(ref: any, data: any): Promise<void> {
  const table = ref.table;
  const id = ref.id;
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && (value as any).__delete === true) {
      continue;
    }
    cleaned[key] = value;
  }
  const { error } = await supabase.from(table).update(cleaned).eq('id', id);
  if (error) throw error;
  notify(table);
}

export async function deleteDoc(ref: any): Promise<void> {
  const table = ref.table;
  const id = ref.id;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  notify(table);
}

export function onSnapshot(q: any, callback: (snapshot: any) => void, errorCb?: (err: any) => void): () => void {
  const table = q.table;

  if (!listeners.has(table)) {
    listeners.set(table, new Set());
  }
  const set = listeners.get(table)!;
  const listener = () => {
    getDocs(q).then(snap => {
      callback({
        docs: snap.docs,
        empty: snap.empty,
        forEach: snap.forEach,
        docChanges: () => snap.docs.map((d: any) => ({ type: 'added' as const, doc: d }))
      });
    }).catch(err => errorCb?.(err));
  };
  set.add(listener);

  listener();

  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(table);
      const ch = supabaseChannels.get(table);
      if (ch) {
        supabase.removeChannel(ch);
        supabaseChannels.delete(table);
      }
    }
  };
}

export function writeBatch(_db: any) {
  return {
    set: (ref: any, data: any) => ({ type: 'set', ref, data }),
    update: (ref: any, data: any) => ({ type: 'update', ref, data }),
    delete: (ref: any) => ({ type: 'delete', ref }),
    commit: async () => {
      throw new Error('writeBatch commit: not implemented. Use individual setDoc/updateDoc/deleteDoc instead.');
    }
  };
}

export const db = {
  from: (table: string) => ({
    select: (cols?: string) => supabase.from(table).select(cols || '*'),
    insert: (rows: any[]) => supabase.from(table).insert(rows),
    update: (data: any) => ({
      eq: (field: string, value: any) => supabase.from(table).update(data).eq(field, value)
    }),
    delete: () => ({
      eq: (field: string, value: any) => supabase.from(table).delete().eq(field, value)
    })
  })
};

export const storage = {
  ref: (path: string) => ({ path }),
  getDownloadURL: async (ref: { path: string }) => {
    const { data, error } = await supabase.storage.from('media').createSignedUrl(ref.path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },
  uploadBytes: async (ref: { path: string }, file: File) => {
    const { error } = await supabase.storage.from('media').upload(ref.path, file, { upsert: true });
    if (error) throw error;
  }
};

export async function uploadBytes(storageRef: { path: string }, file: File): Promise<void> {
  const { error } = await supabase.storage.from('media').upload(storageRef.path, file, { upsert: true });
  if (error) throw error;
}

export async function getDownloadURL(storageRef: { path: string }): Promise<string> {
  const { data, error } = await supabase.storage.from('media').createSignedUrl(storageRef.path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export function ref(_storage: any, path: string) {
  return { path };
}
