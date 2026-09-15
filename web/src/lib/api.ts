import type {
  AdminUserStatusFilter,
  AdminUserSummary,
  AppNotification,
  AppSettings,
  AuthTokens,
  AuthUser,
  Category,
  Comment,
  CreateCategoryInput,
  CreateCommentInput,
  FeedScope,
  Page,
  PublicUser,
  RecipeDetail,
  RecipeSummary,
  CreateRecipeInput,
  RegisterResult,
  UpdateCategoryInput,
  UpdateProfileInput,
  UpdateRecipeInput,
} from '@foodbook/shared';

function resolveBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return 'http://localhost:3000/v1';
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  status: number;
  fieldErrors?: { field: string; message: string }[];

  constructor(status: number, message: string, fieldErrors?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** Mesajul pentru un camp anume din formular, daca serverul l-a semnalat. */
  forField(field: string): string | undefined {
    return this.fieldErrors?.find((e) => e.field === field)?.message;
  }
}

type TokenPair = { accessToken: string; refreshToken: string };

let tokens: TokenPair | null = null;
let onAuthLost: (() => void) | null = null;
let refreshing: Promise<TokenPair | null> | null = null;

export function setTokens(next: TokenPair | null): void {
  tokens = next;
}

export function setOnAuthLost(handler: () => void): void {
  onAuthLost = handler;
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const b = body as { message?: unknown; errors?: { field: string; message: string }[] };
    const message = Array.isArray(b.message)
      ? b.message.join(', ')
      : typeof b.message === 'string'
        ? b.message
        : 'A aparut o eroare';
    return new ApiError(status, message, b.errors);
  }
  return new ApiError(status, 'A aparut o eroare');
}

/** Un singur refresh in zbor, oricate cereri ar pica simultan pe 401. */
async function refreshTokens(): Promise<TokenPair | null> {
  if (!tokens?.refreshToken) return null;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens!.refreshToken }),
      });
      if (!res.ok) return null;
      const next = (await res.json()) as AuthTokens;
      tokens = { accessToken: next.accessToken, refreshToken: next.refreshToken };
      return tokens;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  skipAuth?: boolean;
  retry?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, form, skipAuth, retry = true } = options;

  const headers: Record<string, string> = {};
  if (!skipAuth && tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (err) {
    console.error('[api] fetch esuat pentru', `${API_URL}${path}`, err);
    throw new ApiError(0, 'Nu am putut contacta serverul. Verifica internetul.');
  }

  if (res.status === 401 && !skipAuth && retry) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, { ...options, retry: false });
    }
    tokens = null;
    onAuthLost?.();
    throw new ApiError(401, 'Sesiune expirata. Autentifica-te din nou.');
  }

  const payload = await parse(res);
  if (!res.ok) throw toError(res.status, payload);
  return payload as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export const api = {
  register: (body: { username: string; displayName: string; email: string; password: string }) =>
    request<RegisterResult>('/auth/register', {
      method: 'POST',
      body,
      skipAuth: true,
    }),

  login: (body: { email: string; password: string }) =>
    request<{ user: AuthUser; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body,
      skipAuth: true,
    }),

  logout: (refreshToken: string) =>
    request<null>('/auth/logout', { method: 'POST', body: { refreshToken }, skipAuth: true }),

  me: () => request<AuthUser>('/me'),

  updateProfile: (body: UpdateProfileInput) =>
    request<AuthUser>('/me', { method: 'PATCH', body }),

  uploadAvatar: (form: FormData) => request<AuthUser>('/me/avatar', { method: 'POST', form }),

  uploadImage: (form: FormData) =>
    request<{ key: string; width: number; height: number; url: string; thumbUrl: string }>(
      '/uploads/image',
      { method: 'POST', form },
    ),

  feed: (scope: FeedScope = 'all', cursor?: string, limit = 10) =>
    request<Page<RecipeSummary>>(`/feed${qs({ scope, cursor, limit })}`),

  recipe: (id: string) => request<RecipeDetail>(`/recipes/${id}`),

  createRecipe: (body: CreateRecipeInput) =>
    request<RecipeDetail>('/recipes', { method: 'POST', body }),

  updateRecipe: (id: string, body: UpdateRecipeInput) =>
    request<RecipeDetail>(`/recipes/${id}`, { method: 'PATCH', body }),

  deleteRecipe: (id: string) => request<null>(`/recipes/${id}`, { method: 'DELETE' }),

  user: (username: string) => request<PublicUser>(`/users/${username}`),

  userRecipes: (username: string, cursor?: string, limit = 12) =>
    request<Page<RecipeSummary>>(`/users/${username}/recipes${qs({ cursor, limit })}`),

  like: (recipeId: string) =>
    request<{ likesCount: number }>(`/recipes/${recipeId}/like`, { method: 'POST' }),
  unlike: (recipeId: string) =>
    request<{ likesCount: number }>(`/recipes/${recipeId}/like`, { method: 'DELETE' }),

  save: (recipeId: string) =>
    request<{ savesCount: number }>(`/recipes/${recipeId}/save`, { method: 'POST' }),
  unsave: (recipeId: string) =>
    request<{ savesCount: number }>(`/recipes/${recipeId}/save`, { method: 'DELETE' }),
  savedRecipes: (cursor?: string, limit = 12) =>
    request<Page<RecipeSummary>>(`/me/saved${qs({ cursor, limit })}`),

  comments: (recipeId: string, cursor?: string, limit = 20) =>
    request<Page<Comment>>(`/recipes/${recipeId}/comments${qs({ cursor, limit })}`),
  addComment: (recipeId: string, body: CreateCommentInput) =>
    request<Comment>(`/recipes/${recipeId}/comments`, { method: 'POST', body }),
  deleteComment: (commentId: string) =>
    request<null>(`/comments/${commentId}`, { method: 'DELETE' }),

  follow: (username: string) => request<null>(`/users/${username}/follow`, { method: 'POST' }),
  unfollow: (username: string) => request<null>(`/users/${username}/follow`, { method: 'DELETE' }),
  followers: (username: string, cursor?: string, limit = 30) =>
    request<Page<PublicUser>>(`/users/${username}/followers${qs({ cursor, limit })}`),
  following: (username: string, cursor?: string, limit = 30) =>
    request<Page<PublicUser>>(`/users/${username}/following${qs({ cursor, limit })}`),

  categories: () => request<Category[]>('/categories'),
  categoryRecipes: (slug: string, cursor?: string, limit = 12) =>
    request<Page<RecipeSummary>>(`/categories/${slug}/recipes${qs({ cursor, limit })}`),

  searchRecipes: (q: string, cursor?: string, limit = 20) =>
    request<Page<RecipeSummary>>(`/search/recipes${qs({ q, cursor, limit })}`),
  searchUsers: (q: string, cursor?: string, limit = 20) =>
    request<Page<PublicUser>>(`/search/users${qs({ q, cursor, limit })}`),

  notifications: (cursor?: string, limit = 30) =>
    request<Page<AppNotification>>(`/notifications${qs({ cursor, limit })}`),
  unreadNotificationsCount: () => request<{ count: number }>('/notifications/unread-count'),
  markNotificationsRead: () => request<null>('/notifications/read', { method: 'POST' }),

  adminSettings: () => request<AppSettings>('/admin/settings'),
  updateAdminSettings: (body: AppSettings) =>
    request<AppSettings>('/admin/settings', { method: 'PATCH', body }),
  adminUsers: (status: AdminUserStatusFilter = 'all', cursor?: string, limit = 30) =>
    request<Page<AdminUserSummary>>(`/admin/users${qs({ status, cursor, limit })}`),
  approveUser: (id: string) =>
    request<AdminUserSummary>(`/admin/users/${id}/approve`, { method: 'POST' }),
  rejectUser: (id: string) =>
    request<AdminUserSummary>(`/admin/users/${id}/reject`, { method: 'POST' }),

  createCategory: (body: CreateCategoryInput) =>
    request<Category>('/admin/categories', { method: 'POST', body }),
  updateCategory: (slug: string, body: UpdateCategoryInput) =>
    request<Category>(`/admin/categories/${slug}`, { method: 'PATCH', body }),
  deleteCategory: (slug: string) =>
    request<null>(`/admin/categories/${slug}`, { method: 'DELETE' }),
};
