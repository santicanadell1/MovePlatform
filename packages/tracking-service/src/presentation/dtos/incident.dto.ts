import { z } from 'zod';

export const reportIncidentSchema = z.object({
  description: z.string().min(1).max(2000),
});

export type ReportIncidentDto = z.infer<typeof reportIncidentSchema>;
