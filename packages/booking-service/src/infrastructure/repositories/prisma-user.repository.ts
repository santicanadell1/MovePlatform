import type { ClientType, UserRole } from '@move/shared';

import { User } from '../../domain/entities/user.entity';
import type { IUserRepository } from '../../domain/ports/user.repository.port';
import type { PrismaClient } from '../../generated/client';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? this.toEntity(row) : null;
  }

  async findByFirebaseUid(uid: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
    return row ? this.toEntity(row) : null;
  }

  async save(user: User): Promise<User> {
    const row = await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        role: user.role,
        type: user.type,
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        phone: user.phone,
      },
      update: {
        name: user.name,
        companyName: user.companyName,
        phone: user.phone,
        updatedAt: user.updatedAt,
      },
    });
    return this.toEntity(row);
  }

  private toEntity(row: {
    id: string;
    firebaseUid: string;
    role: string;
    type: string;
    name: string;
    email: string;
    companyName: string | null;
    phone: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return new User({
      id: row.id,
      firebaseUid: row.firebaseUid,
      role: row.role as UserRole,
      type: row.type as ClientType,
      name: row.name,
      email: row.email,
      companyName: row.companyName,
      phone: row.phone,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
