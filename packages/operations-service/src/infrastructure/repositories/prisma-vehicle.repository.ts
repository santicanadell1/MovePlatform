import { injectable, inject } from 'inversify';

import { Vehicle } from '../../domain/entities/vehicle.entity';
import type {
  IVehicleRepository,
  VehicleFilters,
} from '../../domain/ports/vehicle.repository.port';
import { PrismaClient } from '../../generated/client';

@injectable()
export class PrismaVehicleRepository implements IVehicleRepository {
  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async findAll(filters: VehicleFilters): Promise<Vehicle[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: {
        ...(filters.available !== undefined && { available: filters.available }),
        ...(filters.type !== undefined && { type: filters.type }),
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByPlate(plate: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({ where: { plate } });
    return row ? this.toEntity(row) : null;
  }

  async findByGpsDeviceId(gpsDeviceId: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({ where: { gpsDeviceId } });
    return row ? this.toEntity(row) : null;
  }

  async create(vehicle: Vehicle): Promise<Vehicle> {
    const row = await this.prisma.vehicle.create({
      data: {
        id: vehicle.id,
        plate: vehicle.plate,
        type: vehicle.type,
        capacity: vehicle.capacity,
        gpsDeviceId: vehicle.gpsDeviceId,
        available: vehicle.available,
      },
    });
    return this.toEntity(row);
  }

  async update(vehicle: Vehicle): Promise<Vehicle> {
    const row = await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        plate: vehicle.plate,
        type: vehicle.type,
        capacity: vehicle.capacity,
        gpsDeviceId: vehicle.gpsDeviceId,
        available: vehicle.available,
        updatedAt: vehicle.updatedAt,
      },
    });
    return this.toEntity(row);
  }

  private toEntity(row: {
    id: string;
    plate: string;
    type: string;
    capacity: number;
    gpsDeviceId: string | null;
    available: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Vehicle {
    return Vehicle.create({
      id: row.id,
      plate: row.plate,
      type: row.type,
      capacity: row.capacity,
      gpsDeviceId: row.gpsDeviceId,
      available: row.available,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
