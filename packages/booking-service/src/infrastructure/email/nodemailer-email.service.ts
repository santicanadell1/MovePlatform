import nodemailer from 'nodemailer';

import { logger } from '../logger';
import type { IEmailService, RejectionEmailRequest } from '../../domain/ports/email.service.port';

export interface NodemailerConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export class NodemailerEmailService implements IEmailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: NodemailerConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async sendRejection(request: RejectionEmailRequest): Promise<void> {
    const { to, clientName, reservationId, itemDescription } = request;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `MOVE — Reserva #${reservationId} no puede ser procesada`,
      html: `
        <p>Estimado/a <strong>${clientName}</strong>,</p>
        <p>
          Lamentablemente no podemos satisfacer su reserva <strong>#${reservationId}</strong>
          ya que los bienes indicados (<em>${itemDescription}</em>) no corresponden
          a ninguna categoría de traslados que MOVE opera.
        </p>
        <p>Si tiene consultas, puede contactarnos respondiendo este correo.</p>
        <p>Equipo MOVE</p>
      `,
    });

    logger.info('NodemailerEmailService: email de rechazo enviado', { to, reservationId });
  }
}
