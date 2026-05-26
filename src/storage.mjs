export const storageKey = 'silvercare-mvp-state';
const backupVersion = 1;

export function getDefaultState() {
  return {
    profile: null,
    selectedPackageId: 'family-care',
    tickets: [],
    reminders: [],
    orders: [],
    leads: [],
    outreachContacts: [],
    chat: [
      {
        role: 'bot',
        text: '你好，我可以幫你整理防騙、覆診、食藥提醒和家庭待辦。請描述要跟進的事項，但不要提供密碼、OTP、銀行資料或身份證號碼。',
      },
    ],
  };
}

export function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

export function buildStateBackup(state, { exportedAt = new Date().toISOString() } = {}) {
  return JSON.stringify({
    version: backupVersion,
    exportedAt,
    state,
  }, null, 2);
}

export function parseStateBackup(payload) {
  const parsed = JSON.parse(payload);
  if (parsed.version !== backupVersion || !parsed.state || typeof parsed.state !== 'object') {
    throw new Error('Invalid SilverCare backup payload');
  }
  return parsed;
}

export function createWebStorageStateStore(storage, key = storageKey) {
  return {
    mode: 'local',
    async load() {
      const saved = storage.getItem(key);
      return saved ? JSON.parse(saved) : getDefaultState();
    },
    async save(state) {
      storage.setItem(key, JSON.stringify(state));
    },
    async reset() {
      storage.removeItem(key);
    },
  };
}

export function createSupabaseStateStore(client, workspaceId = 'default') {
  return {
    mode: 'supabase',
    async load() {
      const { data, error } = await client
        .from('app_states')
        .select('payload')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data?.payload ?? getDefaultState();
    },
    async save(state) {
      const { error } = await client
        .from('app_states')
        .upsert({
          workspace_id: workspaceId,
          payload: state,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
    },
    async reset() {
      await this.save(getDefaultState());
    },
  };
}

export function resolveStorageMode(config) {
  return config?.supabaseUrl && config?.supabaseAnonKey ? 'supabase' : 'local';
}

export async function createStateStore(config, browserStorage = localStorage) {
  if (resolveStorageMode(config) === 'local') {
    return createWebStorageStateStore(browserStorage);
  }

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const { createSupabaseRecordStore } = await import('./records.mjs');
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return createSupabaseRecordStore(client, config.workspaceId || 'silvercare-demo');
}
