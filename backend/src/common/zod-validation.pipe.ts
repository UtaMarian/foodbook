import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Valideaza body/query cu o schema Zod din @foodbook/shared.
 * Sursa unica de adevar: aceeasi schema ruleaza si pe telefon.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'Date invalide',
          errors: err.issues.map((i) => ({
            field: i.path.join('.') || '_',
            message: i.message,
          })),
        });
      }
      throw err;
    }
  }
}
