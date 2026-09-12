import { BadRequestException } from '@nestjs/common';

export interface Cursor {
  createdAt: Date;
  id: string;
}

/**
 * Cursor-based, nu offset: la feed cu continut nou offset-ul duplica si sare postari.
 */
export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

export function decodeCursor(raw?: string): Cursor | null {
  if (!raw) return null;
  try {
    const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime()) || !id) throw new Error('bad cursor');
    return { createdAt, id };
  } catch {
    throw new BadRequestException('Cursor invalid');
  }
}

/** Filtru keyset stabil pe (created_at DESC, id DESC). */
export function cursorWhere(cursor: Cursor | null) {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

export function buildPage<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}
