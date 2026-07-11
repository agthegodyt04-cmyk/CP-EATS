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

const COLUMN_ALIASES: Record<string, Partial<Record<string, string>>> = {
  favorites: { userId: 'userid', menuItemId: 'menuitemid', kitchenId: 'kitchenid' },
  notifications: { userId: 'userid' },
  follows: { followerId: 'followerid', kitchenId: 'kitchenid' },
  comments: { postId: 'postid', userId: 'userid', userName: 'username', userRole: 'userrole', kitchenId: 'kitchenid' },
  reviews: { orderId: 'orderid', customerId: 'customerid', customerName: 'customername', kitchenId: 'kitchenid', isHandpicked: 'ishandpicked', taggedItemIds: 'taggeditemids' },
  chats: { orderId: 'orderid', senderId: 'senderid', senderName: 'sendername', isUpiCard: 'isupicard', qrCodeUrl: 'qrcodeurl' },
  kitchen_chats: { conversationId: 'conversationid', senderId: 'senderid', senderName: 'sendername', senderHandle: 'senderhandle', recipientId: 'recipientid', recipientName: 'recipientname', recipientHandle: 'recipienthandle' },
  address_registry: { flatAddress: 'flataddress' },
  users: { createdAt: 'created_at' },
};

export function resolveColumn(table: string, column: string): string {
  if (column === 'id') return column;
  return COLUMN_ALIASES[table]?.[column] || column;
}

const TABLE_SPECIFIC_ALIASES: Record<string, Partial<Record<string, string>>> = {
  ...COLUMN_ALIASES,
  feed_posts: { kitchenId: 'kitchenid', kitchenName: 'kitchenname', createdAt: 'createdat', hasAiSparkle: 'hasaisparkle', aiSparkleImposed: 'aisparkleimposed', taggedItemIds: 'taggeditemids' },
  orders: { customerId: 'customerid', customerName: 'customername', customerPhone: 'customerphone', customerAddress: 'customeraddress', kitchenId: 'kitchenid', kitchenName: 'kitchenname', subtotal: 'subtotal', total: 'total', deliveryType: 'deliverytype', deliveryPin: 'deliverypin', createdAt: 'createdat', scheduledTime: 'scheduledtime' },
  kitchens: { kitchenId: 'kitchenid', kitchenName: 'kitchenname', profileImageUrl: 'profileimageurl', ringtoneMode: 'ringtonemode', ringtoneChoice: 'ringtonechoice', ringtoneUrl: 'ringtoneurl', vegType: 'vegtype', isOnline: 'isonline', restingUntil: 'restinguntil', operatingMode: 'operatingmode', deliveryLocations: 'deliverylocations', customCategories: 'customcategories' },
  menu_items: { kitchenId: 'kitchenid', imageUrl: 'imageurl', isGlutenFree: 'isglutenfree', isNutFree: 'isnutfree', isAvailable: 'isavailable', postId: 'postid' },
  comments: { postId: 'postid', userId: 'userid', userName: 'username', userRole: 'userrole', kitchenId: 'kitchenid', createdAt: 'createdat' },
  reviews: { orderId: 'orderid', customerId: 'customerid', customerName: 'customername', kitchenId: 'kitchenid', isHandpicked: 'ishandpicked', taggedItemIds: 'taggeditemids', createdAt: 'createdat' },
  chats: { orderId: 'orderid', senderId: 'senderid', senderName: 'sendername', isUpiCard: 'isupicard', qrCodeUrl: 'qrcodeurl', createdAt: 'createdat' },
  kitchen_chats: { conversationId: 'conversationid', senderId: 'senderid', senderName: 'sendername', senderHandle: 'senderhandle', recipientId: 'recipientid', recipientName: 'recipientname', recipientHandle: 'recipienthandle', createdAt: 'createdat' },
  notifications: { userId: 'userid', createdAt: 'createdat' },
  favorites: { userId: 'userid', menuItemId: 'menuitemid', kitchenId: 'kitchenid', createdAt: 'createdat' },
  follows: { followerId: 'followerid', kitchenId: 'kitchenid', createdAt: 'createdat' },
};

export { TABLE_SPECIFIC_ALIASES };

const REVERSE_ALIASES: Record<string, Record<string, string>> = {};
for (const [table, aliases] of Object.entries(TABLE_SPECIFIC_ALIASES)) {
  REVERSE_ALIASES[table] = {};
  for (const [camel, snake] of Object.entries(aliases)) {
    REVERSE_ALIASES[table][snake] = camel;
  }
}

export function denormalizeRow(table: string, row: any): any {
  if (!row || typeof row !== 'object') return row;
  const aliases = REVERSE_ALIASES[table] || {};
  const result: any = {};
  for (const [key, value] of Object.entries(row)) {
    const normalized = aliases[key] || key;
    result[normalized] = value;
  }
  return result;
}

export function normalizePayload(table: string, data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(item => normalizePayload(table, item));
  const result: any = {};
  const aliases = TABLE_SPECIFIC_ALIASES[table] || {};
  for (const [key, value] of Object.entries(data)) {
    const normalized = aliases[key] || key;
    result[normalized] = value;
  }
  return result;
}

async function applyConstraints(table: string, constraints: any[]): Promise<any> {
  let q: any = supabase.from(table).select('*');
  let orderField: string | null = null;
  let orderAsc = true;
  let limitCount: number | null = null;

  for (const c of constraints) {
    if (c.type === 'where') {
      const field = resolveColumn(table, c.field);
      if (c.op === '==') q = q.eq(field, c.value);
      else if (c.op === 'array-contains') q = q.contains(field, [c.value]);
      else if (c.op === '!=') q = q.neq(field, c.value);
      else q = q.eq(field, c.value);
    } else if (c.type === 'orderBy') {
      orderField = resolveColumn(table, c.field);
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
  const normalized = denormalizeRow(table, data);
  return {
    exists: () => true,
    data: () => normalized,
    id: normalized.id
  };
}

export async function getDocs(q: any): Promise<{ docs: any[]; empty: boolean; forEach: (fn: (d: any) => void) => void }> {
  const table = q.table;
  const queryBuilder = await applyConstraints(table, q.constraints || []);
  const { data, error } = await queryBuilder;
  if (error) return { docs: [], empty: true, forEach: () => {} };
  const docs = (data || []).map((row: any) => {
    const normalized = denormalizeRow(table, row);
    return {
      id: normalized.id,
      data: () => normalized,
      ref: () => doc(null, table, normalized.id)
    };
  });
  return {
    docs,
    empty: docs.length === 0,
    forEach: (fn: (d: any) => void) => docs.forEach(fn)
  };
}

export async function setDoc(ref: any, data: any): Promise<void> {
  const table = ref.table;
  const id = ref.id || data.id;
  const payload = normalizePayload(table, { ...data, id });
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
  const { error } = await supabase.from(table).update(normalizePayload(table, cleaned)).eq('id', id);
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
    insert: (rows: any[]) => supabase.from(table).insert(normalizePayload(table, rows)),
    update: (data: any) => ({
      eq: (field: string, value: any) => supabase.from(table).update(normalizePayload(table, data)).eq(resolveColumn(table, field), value)
    }),
    delete: () => ({
      eq: (field: string, value: any) => supabase.from(table).delete().eq(resolveColumn(table, field), value)
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
