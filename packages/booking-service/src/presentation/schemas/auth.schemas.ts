import { ClientType } from '@move/shared';
import { z } from 'zod';

export const RegisterSchema = z.object({
  type: z.nativeEnum(ClientType),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  companyName: z.string().min(1).max(200).optional(),
  phone: z.string().min(1).max(30).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
