import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marcheaza un endpoint ca accesibil fara token (guard-ul global e deny-by-default). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
