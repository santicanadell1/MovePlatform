import { z } from 'zod';

export const createCategorySchema = z.object({
  nameEs: z.string().min(1).max(100),
  nameEn: z.string().min(1).max(100),
  description: z.string().min(1),
  examples: z.array(z.unknown()).default([]),
  requiresMonitoring: z.boolean().default(false),
  generatesAlerts: z.boolean().default(false),
  surchargePercent: z.number().min(0).max(100).default(0),
});

export const updateCategorySchema = z
  .object({
    nameEs: z.string().min(1).max(100).optional(),
    nameEn: z.string().min(1).max(100).optional(),
    description: z.string().min(1).optional(),
    examples: z.array(z.unknown()).optional(),
    requiresMonitoring: z.boolean().optional(),
    generatesAlerts: z.boolean().optional(),
    surchargePercent: z.number().min(0).max(100).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Al menos un campo debe ser provisto',
  });
