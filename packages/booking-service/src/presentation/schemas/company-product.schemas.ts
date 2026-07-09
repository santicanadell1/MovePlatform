import { z } from 'zod';

export const createCompanyProductSchema = z.object({
  name: z.string().min(1).max(100),
  categoryId: z.string().cuid(),
});

export const updateCompanyProductSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    categoryId: z.string().cuid().optional(),
  })
  .refine((data) => data.name !== undefined || data.categoryId !== undefined, {
    message: 'Debe proveer al menos un campo para actualizar',
  });

export type CreateCompanyProductDto = z.infer<typeof createCompanyProductSchema>;
export type UpdateCompanyProductDto = z.infer<typeof updateCompanyProductSchema>;
