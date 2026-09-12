import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AuthTokens, AuthUser } from '@foodbook/shared';
import { api, setOnAuthLost, setTokens } from '../lib/api';

const TOKENS_KEY = 'foodbook.tokens';

interface AuthState {
  user: AuthUser | null;
  tokens: { accessToken: string; refreshToken: string } | null;
  /** true cat timp citim sesiunea de pe disc la pornirea aplicatiei. */
  restoring: boolean;
  restore: () => Promise<void>;
  signIn: (user: AuthUser, tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

async function persist(tokens: AuthState['tokens']): Promise<void> {
  if (tokens) {
    await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
  } else {
    await SecureStore.deleteItemAsync(TOKENS_KEY);
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  restoring: true,

  /**
   * Tokenul de acces traieste 15 minute, deci dupa repornire e aproape mereu
   * expirat. Il lasam pe clientul API sa il reimprospateze din refresh token.
   */
  async restore() {
    try {
      const raw = await SecureStore.getItemAsync(TOKENS_KEY);
      if (!raw) {
        set({ restoring: false });
        return;
      }
      const tokens = JSON.parse(raw) as AuthState['tokens'];
      setTokens(tokens);
      const user = await api.me();
      set({ user, tokens, restoring: false });
    } catch {
      setTokens(null);
      await persist(null);
      set({ user: null, tokens: null, restoring: false });
    }
  },

  async signIn(user, tokens) {
    const pair = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    setTokens(pair);
    await persist(pair);
    set({ user, tokens: pair });
  },

  async signOut() {
    const refreshToken = get().tokens?.refreshToken;
    if (refreshToken) await api.logout(refreshToken).catch(() => undefined);
    setTokens(null);
    await persist(null);
    set({ user: null, tokens: null });
  },

  setUser(user) {
    set({ user });
  },
}));

// Cand refresh-ul esueaza definitiv, clientul API ne anunta si golim sesiunea.
setOnAuthLost(() => {
  void persist(null);
  useAuth.setState({ user: null, tokens: null });
});
