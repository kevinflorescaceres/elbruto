import { z } from 'zod';

/** Respuesta de GET /api/health. Primer DTO: valida el cableado del monorepo. */
export const healthSchema = z.object({
  ok: z.literal(true),
  engineVersion: z.number().int().positive(),
});

export type Health = z.infer<typeof healthSchema>;
export * from './fight.js';
