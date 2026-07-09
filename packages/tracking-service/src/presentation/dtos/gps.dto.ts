import { z } from 'zod';

export const gpsPointSchema = z.object({
  deviceId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).max(300).nullable().optional().transform((v) => v ?? null),
  heading: z.number().min(0).max(360).nullable().optional().transform((v) => v ?? null),
  accuracy: z.number().min(0).nullable().optional().transform((v) => v ?? null),
  timestamp: z.string().datetime(),
});

export type GpsPointDto = z.infer<typeof gpsPointSchema>;
