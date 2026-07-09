import { z } from 'zod';
import { UserRole } from '@move/shared';

import { UserStatus } from '../../domain/entities/user.entity';

export const listUsersQuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});
