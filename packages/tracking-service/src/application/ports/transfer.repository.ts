import { Transfer } from '../../domain/entities/transfer.entity';

export interface ITransferRepository {
  findByReservationId(reservationId: string): Promise<Transfer | null>;
  findActiveByVehicleId(vehicleId: string): Promise<Transfer | null>;
  save(transfer: Transfer): Promise<Transfer>;
  update(transfer: Transfer): Promise<Transfer>;
}
