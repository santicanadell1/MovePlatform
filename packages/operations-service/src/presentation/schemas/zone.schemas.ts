import { z } from 'zod';

const geoJsonPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.array(z.number()).min(2))).min(1),
});

export const createZoneSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['RED', 'PREFERRED']),
  geom: geoJsonPolygonSchema,
});

export const updateZoneSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    type: z.enum(['RED', 'PREFERRED']).optional(),
    geom: geoJsonPolygonSchema.optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Al menos un campo debe ser provisto',
  });
