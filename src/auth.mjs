export const authStorageKey = 'silvercare-auth-session';

export function getDefaultSession() {
  return {
    user: null,
    role: 'guest',
    mode: 'signed-out',
  };
}

export function resolveAuthMode(config) {
  return config?.supabaseUrl && config?.supabaseAnonKey ? 'supabase' : 'local';
}

function buildLocalSession(email, config = {}) {
  return {
    user: {
      id: `local-${email.toLowerCase()}`,
      email,
    },
    role: email.toLowerCase() === config.adminEmail?.toLowerCase() ? 'admin' : 'operator',
    mode: 'local',
  };
}

export function createLocalAuthStore(storage, config = {}) {
  const demoPin = config.demoPin || '2468';

  return {
    mode: 'local',
    async getSession() {
      const saved = storage.getItem(authStorageKey);
      return saved ? JSON.parse(saved) : getDefaultSession();
    },
    async signIn({ email, pin }) {
      if (pin !== demoPin) {
        throw new Error('Invalid demo PIN');
      }

      const session = buildLocalSession(email.trim(), config);
      storage.setItem(authStorageKey, JSON.stringify(session));
      return session;
    },
    async signOut() {
      storage.removeItem(authStorageKey);
      return getDefaultSession();
    },
  };
}

export function createSupabaseAuthStore(client) {
  return {
    mode: 'supabase',
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) {
        throw new Error(error.message);
      }

      if (!data.session?.user) {
        return getDefaultSession();
      }

      return {
        user: data.session.user,
        role: 'admin',
        mode: 'supabase',
      };
    },
    async signIn({ email, password }) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(error.message);
      }

      return {
        user: data.user,
        role: 'admin',
        mode: 'supabase',
      };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }
      return getDefaultSession();
    },
  };
}

export async function createAuthStore(config, browserStorage = localStorage) {
  if (resolveAuthMode(config) === 'local') {
    return createLocalAuthStore(browserStorage, config);
  }

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return createSupabaseAuthStore(client);
}
