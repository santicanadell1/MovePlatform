import { z } from 'zod';

export const assignReservationBodySchema = z.object({
  vehicleId: z.string().min(1),
  conductorId: z.string().min(1),
});

export type AssignReservationBody = z.infer<typeof assignReservationBodySchema>;

export const listTransfersQuerySchema = z.object({
  status: z.string().optional(),
  vehicleId: z.string().optional(),
  conductorId: z.string().optional(),
  categoryId: z.string().optional(),
  hasAlerts: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type ListTransfersQuery = z.infer<typeof listTransfersQuerySchema>;
