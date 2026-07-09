import { injectable, inject } from 'inversify';
import type { Pool } from 'pg';

import type {
  IReservationAssignmentRepository,
  ReservationData,
  ConductorData,
  VehicleData,
  AssignInput,
  AssignOutput,
} from '../../domain/ports/reservation-assignment.repository.port';
import {
  VehicleNotAvailableError,
  ScheduleConflictError,
  ReservationNotFoundError,
} from '../../domain/errors/reservation-assignment.errors';
import { TYPES } from '../../types';

interface ReservationProjectionRow {
  id: string;
  status: string;
  scheduled_date: Date;
  goods_summary: Array<{ size: string; quantity: number }>;
}

interface ConductorRow {
  id: string;
  role: string;
  status: string;
}

interface VehicleRow {
  id: string;
  capacity: string | number;
  available: boolean;
}

@injectable()
export class PgReservationAssignmentRepository implements IReservationAssignmentRepository {
  constructor(
    @inject(TYPES.PgPool)
    private readonly pool: Pool,
  ) {}

  async findReservation(id: string): Promise<ReservationData | null> {
    const result = await this.pool.query<ReservationProjectionRow>(
      `SELECT id, status, scheduled_date, goods_summary
       FROM operations.reservations_projection
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const goodsSummary = Array.isArray(row.goods_summary) ? row.goods_summary : [];
    const goods = goodsSummary.map((g) => ({
      size: g.size as ReservationData['goods'][number]['size'],
      quantity: g.quantity,
    }));

    return {
      id: row.id,
      status: row.status,
      scheduledDate: new Date(row.scheduled_date),
      goods,
    };
  }

  async findConductor(id: string): Promise<ConductorData | null> {
    const result = await this.pool.query<ConductorRow>(
      `SELECT id, role, status FROM users WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return { id: row.id, role: row.role, status: row.status };
  }

  async findVehicle(id: string): Promise<VehicleData | null> {
    const result = await this.pool.query<VehicleRow>(
      `SELECT id, capacity, available FROM vehicles WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return { id: row.id, capacity: Number(row.capacity), available: row.available };
  }

  async assignWithLock(input: AssignInput): Promise<AssignOutput> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Bloquear fila del vehículo y verificar disponibilidad
      const vehicleResult = await client.query(
        `SELECT id FROM vehicles WHERE id = $1 AND available = true FOR UPDATE`,
        [input.vehicleId],
      );
      if (vehicleResult.rowCount === 0) {
        throw new VehicleNotAvailableError(input.vehicleId);
      }

      // 2. Obtener scheduled_date desde la proyección local
      const projResult = await client.query<{ scheduled_date: Date }>(
        `SELECT scheduled_date FROM operations.reservations_projection WHERE id = $1`,
        [input.reservationId],
      );
      if (projResult.rowCount === 0) {
        throw new ReservationNotFoundError(input.reservationId);
      }
      const scheduledDate = projResult.rows[0].scheduled_date;

      // 3. Verificar conflicto de horario — solo operations.vehicle_assignments
      const conflictResult = await client.query(
        `SELECT 1 FROM operations.vehicle_assignments
         WHERE vehicle_id = $1 AND scheduled_date = $2 AND reservation_id != $3`,
        [input.vehicleId, scheduledDate, input.reservationId],
      );
      if ((conflictResult.rowCount ?? 0) > 0) {
        throw new ScheduleConflictError(input.vehicleId);
      }

      // 4. Marcar vehículo como no disponible
      await client.query(
        `UPDATE vehicles SET available = false, updated_at = NOW() WHERE id = $1`,
        [input.vehicleId],
      );

      // 5. Registrar la asignación (para conflict checks futuros, sin cross-schema)
      await client.query(
        `INSERT INTO operations.vehicle_assignments (vehicle_id, reservation_id, scheduled_date)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [input.vehicleId, input.reservationId, scheduledDate],
      );

      // 6. Actualizar la proyección local (booking se entera vía reservation.assigned)
      await client.query(
        `UPDATE operations.reservations_projection
         SET vehicle_id = $1, conductor_id = $2, status = 'ASSIGNED' WHERE id = $3`,
        [input.vehicleId, input.conductorId, input.reservationId],
      );

      await client.query('COMMIT');

      return {
        reservationId: input.reservationId,
        vehicleId: input.vehicleId,
        conductorId: input.conductorId,
        assignedAt: new Date(),
      };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignorar error de rollback */
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
