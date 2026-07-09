import { Alert } from '../../domain/entities/alert.entity';

export interface IAlertRepository {
  save(alert: Alert): Promise<Alert | null>;
}
