import { z } from 'zod';

export const startTransferSchema = z.object({
  reservationId: z.string().min(1),
  conductorId: z.string().min(1),
  vehicleId: z.string().min(1),
  deviceId: z.string().min(1),
});

export const finishTransferSchema = z.object({
  reservationId: z.string().min(1),
  conductorId: z.string().min(1),
  deviceId: z.string().min(1),
});
