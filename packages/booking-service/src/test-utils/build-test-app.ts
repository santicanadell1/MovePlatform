import 'reflect-metadata';

import express from 'express';
import { Container } from 'inversify';
import type { Application } from 'express';
import type { IAuthVerifier } from '@move/shared';
import type { AiCategorizationJob, DomainEvent } from '@move/shared';

import { PrismaClient } from '../generated/client';
import { TYPES } from '../types';
import type { IAuthService } from '../domain/ports/auth.service.port';
import type { IGeolocationService } from '../domain/ports/geolocation.service.port';
import type { IPaymentGateway } from '../domain/ports/payment-gateway.port';
import type { IJobQueue } from '../domain/ports/job-queue.port';
import type { IEventPublisher } from '../domain/ports/event-publisher.port';
import type { ISseNotifier } from '../domain/ports/sse-notifier.port';
import type { ITopClientsCache } from '../domain/ports/top-clients-cache.port';
import type { IEmailService } from '../domain/ports/email.service.port';
import type { IUserRepository } from '../domain/ports/user.repository.port';
import type { IReservationRepository } from '../domain/ports/reservation.repository.port';
import type { ICompanyProductRepository } from '../domain/ports/company-product.repository.port';
import type { IPaymentRepository } from '../domain/ports/payment.repository.port';
import type { IPricingRuleRepository } from '../domain/ports/pricing-rule.repository.port';
import type { ICategoryRepository } from '../domain/ports/category.repository.port';
import { MockGeolocationService } from '../infrastructure/geolocation/mock-geolocation.service';
import { MockPaymentGateway } from '../infrastructure/payment/mock-payment-gateway';
import { CircuitBreakerPaymentGateway } from '../infrastructure/payment/circuit-breaker-payment-gateway';
import { MockEmailService } from '../infrastructure/email/mock-email.service';
import { SseManager } from '../infrastructure/realtime/sse-manager';
import { PrismaUserRepository } from '../infrastructure/repositories/prisma-user.repository';
import { PrismaReservationRepository } from '../infrastructure/repositories/prisma-reservation.repository';
import { PrismaCompanyProductRepository } from '../infrastructure/repositories/prisma-company-product.repository';
import { PrismaPaymentRepository } from '../infrastructure/repositories/prisma-payment.repository';
import { PrismaPricingRuleRepository } from '../infrastructure/repositories/prisma-pricing-rule.repository';
import { PrismaCategoryRepository } from '../infrastructure/repositories/prisma-category.repository';
import { PricingService } from '../application/services/pricing.service';
import { ClassificationCascadeService } from '../application/services/classification-cascade.service';
import { QuoteReservationUseCase } from '../application/use-cases/quote-reservation.use-case';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { LoginUserUseCase } from '../application/use-cases/login-user.use-case';
import { CreateParticularReservationUseCase } from '../application/use-cases/create-particular-reservation.use-case';
import { CreateEmpresaReservationUseCase } from '../application/use-cases/create-empresa-reservation.use-case';
import { GetReservationsUseCase } from '../application/use-cases/get-reservations.use-case';
import { PayReservationUseCase } from '../application/use-cases/pay-reservation.use-case';
import { ClassifyReservationUseCase } from '../application/use-cases/classify-reservation.use-case';
import { RejectReservationUseCase } from '../application/use-cases/reject-reservation.use-case';
import { ResumeClassifiedReservationUseCase } from '../application/use-cases/resume-classified-reservation.use-case';
import { AuthController } from '../presentation/controllers/auth.controller';
import { ReservationController } from '../presentation/controllers/reservation.controller';
import { createAuthRouter } from '../presentation/routes/auth.routes';
import { createReservationRouter } from '../presentation/routes/reservation.routes';
import type { CompanyProduct } from '../domain/entities/company-product.entity';
import type { SseNotification } from '../domain/ports/sse-notifier.port';

import { FakeAuthService } from './fake-auth.service';
import { FakeAuthVerifier } from './fake-auth.verifier';

// ── No-op fakes para servicios externos ──────────────────────────────

class NoOpJobQueue implements IJobQueue {
  enqueue(_data: AiCategorizationJob): Promise<void> {
    return Promise.resolve();
  }
}

class NoOpEventPublisher implements IEventPublisher {
  publish(_exchange: string, _routingKey: string, _event: DomainEvent): Promise<void> {
    return Promise.resolve();
  }
}

class NoOpSseNotifier implements ISseNotifier {
  notify(_event: SseNotification): Promise<void> {
    return Promise.resolve();
  }
}

class NoOpTopClientsCache implements ITopClientsCache {
  getCachedProducts(_clientId: string): Promise<CompanyProduct[] | null> {
    return Promise.resolve(null);
  }
  setTopClients(
    _clientIds: readonly string[],
    _productsMap: ReadonlyMap<string, readonly CompanyProduct[]>,
  ): Promise<void> {
    return Promise.resolve();
  }
}

export interface TestAppResult {
  app: Application;
  prisma: PrismaClient;
}

export async function buildTestApp(): Promise<TestAppResult> {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env['DATABASE_URL'] } },
  });

  const container = new Container({ defaultScope: 'Singleton' });

  // ── Auth fakes ──────────────────────────────────────────────────────
  const fakeAuthService = new FakeAuthService();
  container.bind<IAuthService>(TYPES.AuthService).toConstantValue(fakeAuthService);
  container.bind<IAuthVerifier>(TYPES.AuthVerifier).toConstantValue(new FakeAuthVerifier());

  // ── Repositories (Prisma real) ──────────────────────────────────────
  const userRepo = new PrismaUserRepository(prisma);
  const reservationRepo = new PrismaReservationRepository(prisma);
  const productRepo = new PrismaCompanyProductRepository(prisma);
  const paymentRepo = new PrismaPaymentRepository(prisma);
  const pricingRuleRepo = new PrismaPricingRuleRepository(prisma);
  const categoryRepo = new PrismaCategoryRepository(prisma);

  container.bind<IUserRepository>(TYPES.UserRepository).toConstantValue(userRepo);
  container
    .bind<IReservationRepository>(TYPES.ReservationRepository)
    .toConstantValue(reservationRepo);
  container
    .bind<ICompanyProductRepository>(TYPES.CompanyProductRepository)
    .toConstantValue(productRepo);
  container.bind<IPaymentRepository>(TYPES.PaymentRepository).toConstantValue(paymentRepo);
  container
    .bind<IPricingRuleRepository>(TYPES.PricingRuleRepository)
    .toConstantValue(pricingRuleRepo);
  container.bind<ICategoryRepository>(TYPES.CategoryRepository).toConstantValue(categoryRepo);

  // ── No-op externos ──────────────────────────────────────────────────
  const noOpJobQueue = new NoOpJobQueue();
  const noOpEventPublisher = new NoOpEventPublisher();
  const noOpSseNotifier = new NoOpSseNotifier();
  container.bind<IJobQueue>(TYPES.AiJobQueue).toConstantValue(noOpJobQueue);
  container.bind<IEventPublisher>(TYPES.EventPublisher).toConstantValue(noOpEventPublisher);
  container.bind<ISseNotifier>(TYPES.SseNotifier).toConstantValue(noOpSseNotifier);
  container
    .bind<ITopClientsCache>(TYPES.TopClientsCache)
    .toConstantValue(new NoOpTopClientsCache());
  container.bind<IEmailService>(TYPES.EmailService).toConstantValue(new MockEmailService());

  // ── Servicios mock existentes ───────────────────────────────────────
  const geo = new MockGeolocationService();
  container.bind<IGeolocationService>(TYPES.GeolocationService).toConstantValue(geo);

  const paymentGateway = new CircuitBreakerPaymentGateway(new MockPaymentGateway());
  container.bind<IPaymentGateway>(TYPES.PaymentGateway).toConstantValue(paymentGateway);

  const sseManager = new SseManager();
  container.bind<SseManager>(TYPES.SseManager).toConstantValue(sseManager);

  // ── Application services ────────────────────────────────────────────
  const pricingService = new PricingService(pricingRuleRepo, {
    baseRate: 100,
    ratePerKm: 50,
    surchargePercent: 0,
  });
  await pricingService.loadAtBoot();
  container.bind<PricingService>(TYPES.PricingService).toConstantValue(pricingService);

  const quoteUseCase = new QuoteReservationUseCase(reservationRepo, pricingService, geo);
  container
    .bind<QuoteReservationUseCase>(TYPES.QuoteReservationUseCase)
    .toConstantValue(quoteUseCase);

  const cascade = new ClassificationCascadeService([]);
  container
    .bind<ClassificationCascadeService>(TYPES.ClassificationCascade)
    .toConstantValue(cascade);

  const resumeUseCase = new ResumeClassifiedReservationUseCase(reservationRepo, quoteUseCase);
  container
    .bind<ResumeClassifiedReservationUseCase>(TYPES.ResumeClassifiedReservationUseCase)
    .toConstantValue(resumeUseCase);

  // ── Use cases ───────────────────────────────────────────────────────
  container
    .bind<RegisterUserUseCase>(TYPES.RegisterUserUseCase)
    .toConstantValue(new RegisterUserUseCase(userRepo, fakeAuthService));
  container
    .bind<LoginUserUseCase>(TYPES.LoginUseCase)
    .toConstantValue(new LoginUserUseCase(userRepo, fakeAuthService));
  container
    .bind<CreateParticularReservationUseCase>(TYPES.CreateParticularReservationUseCase)
    .toConstantValue(
      new CreateParticularReservationUseCase(
        userRepo,
        reservationRepo,
        quoteUseCase,
        cascade,
        noOpEventPublisher,
        noOpJobQueue,
        noOpSseNotifier,
      ),
    );
  container
    .bind<CreateEmpresaReservationUseCase>(TYPES.CreateReservationUseCase)
    .toConstantValue(
      new CreateEmpresaReservationUseCase(
        userRepo,
        reservationRepo,
        productRepo,
        quoteUseCase,
        new NoOpTopClientsCache(),
      ),
    );
  container
    .bind<GetReservationsUseCase>(TYPES.GetReservationsUseCase)
    .toConstantValue(new GetReservationsUseCase(userRepo, reservationRepo));
  container
    .bind<PayReservationUseCase>(TYPES.PayReservationUseCase)
    .toConstantValue(
      new PayReservationUseCase(
        reservationRepo,
        paymentRepo,
        paymentGateway,
        userRepo,
        noOpEventPublisher,
      ),
    );
  container
    .bind<ClassifyReservationUseCase>(TYPES.ClassifyReservationUseCase)
    .toConstantValue(
      new ClassifyReservationUseCase(
        reservationRepo,
        categoryRepo,
        resumeUseCase,
        noOpEventPublisher,
      ),
    );
  container
    .bind<RejectReservationUseCase>(TYPES.RejectReservationUseCase)
    .toConstantValue(
      new RejectReservationUseCase(reservationRepo, userRepo, new MockEmailService()),
    );

  // ── Controllers ─────────────────────────────────────────────────────
  container.bind<AuthController>(TYPES.AuthController).to(AuthController);
  container.bind<ReservationController>(TYPES.ReservationController).to(ReservationController);

  // ── Express app mínima ──────────────────────────────────────────────
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/v1/auth', createAuthRouter(container));
  app.use('/v1/reservas', createReservationRouter(container));

  return { app, prisma };
}
