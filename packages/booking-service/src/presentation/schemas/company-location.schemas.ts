import { z } from 'zod';

export const createCompanyLocationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(255),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const updateCompanyLocationSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    address: z.string().min(1).max(255).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Debe proveer al menos un campo para actualizar',
  });

export type CreateCompanyLocationDto = z.infer<typeof createCompanyLocationSchema>;
export type UpdateCompanyLocationDto = z.infer<typeof updateCompanyLocationSchema>;
