import { z } from 'zod';
import { GoodSize, ReservationStatus } from '@move/shared';

export const createEmpresaReservationSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  scheduledDate: z
    .string()
    .datetime()
    .refine((d) => new Date(d) > new Date(), { message: 'La fecha debe ser futura' }),
  goods: z
    .array(
      z.object({
        productId: z.string().min(1),
        description: z.string().min(1).optional(),
        value: z.number().positive().optional(),
        size: z.nativeEnum(GoodSize).optional(),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .min(1, { message: 'Debe incluir al menos un bien' }),
});

export type CreateEmpresaReservationDto = z.infer<typeof createEmpresaReservationSchema>;

export const createParticularReservationSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  scheduledDate: z
    .string()
    .datetime()
    .refine((d) => new Date(d) > new Date(), { message: 'La fecha debe ser futura' }),
  goods: z
    .array(
      z.object({
        description: z.string().min(1, { message: 'El bien debe tener una descripción' }),
        value: z.number().positive().optional(),
        size: z.nativeEnum(GoodSize).optional(),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .min(1, { message: 'Debe incluir al menos un bien' }),
});

export type CreateParticularReservationDto = z.infer<typeof createParticularReservationSchema>;

export const payReservationParamsSchema = z.object({
  id: z.string().min(1),
});

export const listReservationsQuerySchema = z.object({
  status: z.nativeEnum(ReservationStatus).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListReservationsQueryDto = z.infer<typeof listReservationsQuerySchema>;

export const classifyReservationBodySchema = z.object({
  categoryId: z.string().min(1),
});

export const reservationIdParamSchema = z.object({
  id: z.string().min(1),
});
