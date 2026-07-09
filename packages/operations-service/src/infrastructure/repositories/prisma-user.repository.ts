import { injectable, inject } from 'inversify';
import { UserRole } from '@move/shared';

import { User, UserStatus } from '../../domain/entities/user.entity';
import type { IUserRepository, UserFilters } from '../../domain/ports/user.repository.port';
import {
  PrismaClient,
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from '../../generated/client';

@injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async findAll(filters: UserFilters): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        ...(filters.role !== undefined && { role: filters.role as PrismaUserRole }),
        ...(filters.status !== undefined && { status: filters.status as PrismaUserStatus }),
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async update(user: User): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: user.status as PrismaUserStatus,
      },
    });
    return this.toEntity(row);
  }

  private toEntity(row: {
    id: string;
    firebaseUid: string;
    name: string;
    role: PrismaUserRole;
    status: PrismaUserStatus;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return User.create({
      id: row.id,
      firebaseUid: row.firebaseUid,
      name: row.name,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
