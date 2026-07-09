import { z } from 'zod';

export const createVehicleSchema = z.object({
  plate: z.string().min(1).max(20),
  type: z.string().min(1).max(50),
  capacity: z.number().int().positive(),
  gpsDeviceId: z.string().min(1).optional(),
});

export const updateVehicleSchema = z
  .object({
    plate: z.string().min(1).max(20).optional(),
    type: z.string().min(1).max(50).optional(),
    capacity: z.number().int().positive().optional(),
    gpsDeviceId: z.string().min(1).nullable().optional(),
    available: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Al menos un campo debe ser provisto',
  });

export const listVehiclesQuerySchema = z.object({
  available: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  type: z.string().optional(),
});
