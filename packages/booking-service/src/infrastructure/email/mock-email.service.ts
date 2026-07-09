import { logger } from '../logger';
import type { IEmailService, RejectionEmailRequest } from '../../domain/ports/email.service.port';

export class MockEmailService implements IEmailService {
  // eslint-disable-next-line @typescript-eslint/require-await
  async sendRejection(request: RejectionEmailRequest): Promise<void> {
    logger.info('MockEmailService: sendRejection (no email sent)', { ...request });
  }
}
