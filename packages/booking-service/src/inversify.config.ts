import 'reflect-metadata';

import * as admin from 'firebase-admin';
import amqplib from 'amqplib';
import type { Channel } from 'amqplib';
import Bull from 'bull';
import { Container } from 'inversify';
import Redis from 'ioredis';
import { Pool } from 'pg';
import type { IAuthVerifier } from '@move/shared';

import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { CreateCompanyProductUseCase } from './application/use-cases/company-products/create-company-product.use-case';
import { DeleteCompanyProductUseCase } from './application/use-cases/company-products/delete-company-product.use-case';
import { ListCompanyProductsUseCase } from './application/use-cases/company-products/list-company-products.use-case';
import { UpdateCompanyProductUseCase } from './application/use-cases/company-products/update-company-product.use-case';
import { CreateCompanyLocationUseCase } from './application/use-cases/company-locations/create-company-location.use-case';
import { DeleteCompanyLocationUseCase } from './application/use-cases/company-locations/delete-company-location.use-case';
import { ListCompanyLocationsUseCase } from './application/use-cases/company-locations/list-company-locations.use-case';
import { UpdateCompanyLocationUseCase } from './application/use-cases/company-locations/update-company-location.use-case';
import { CreateEmpresaReservationUseCase } from './application/use-cases/create-empresa-reservation.use-case';
import { CreateParticularReservationUseCase } from './application/use-cases/create-particular-reservation.use-case';
import { GetReservationsUseCase } from './application/use-cases/get-reservations.use-case';
import { PayReservationUseCase } from './application/use-cases/pay-reservation.use-case';
import { QuoteReservationUseCase } from './application/use-cases/quote-reservation.use-case';
import { ResumeClassifiedReservationUseCase } from './application/use-cases/resume-classified-reservation.use-case';
import { PricingService, type PricingDefaults } from './application/services/pricing.service';
import { ClassificationCascadeService } from './application/services/classification-cascade.service';
import { DbRuleBasedCategorizador } from './infrastructure/categorization/db-rule-based.categorizador';
import { EmbeddingsCategorizador } from './infrastructure/categorization/embeddings.categorizador';
import { OllamaEmbeddingService } from './infrastructure/embedding/ollama-embedding.service';
import { PgCategoryEmbeddingRepository } from './infrastructure/repositories/pg-category-embedding.repository';
import { ClassifyReservationUseCase } from './application/use-cases/classify-reservation.use-case';
import { RejectReservationUseCase } from './application/use-cases/reject-reservation.use-case';
import { MockEmailService } from './infrastructure/email/mock-email.service';
import { NodemailerEmailService } from './infrastructure/email/nodemailer-email.service';
import type { IEmailService } from './domain/ports/email.service.port';
import { BullAiJobQueue } from './infrastructure/jobs/bull-ai-job-queue';
import { PrismaCategoryRepository } from './infrastructure/repositories/prisma-category.repository';
import { RabbitMQEventPublisher } from './infrastructure/events/rabbitmq-event-publisher';
import { ReservationClassifiedConsumer } from './infrastructure/messaging/reservation-classified.consumer';
import { ReservationAssignedConsumer } from './infrastructure/messaging/reservation-assigned.consumer';
import { TransferCompletedConsumer } from './infrastructure/messaging/transfer-completed.consumer';
import { CompleteReservationUseCase } from './application/use-cases/complete-reservation.use-case';
import { RedisSseNotifier } from './infrastructure/realtime/redis-sse-notifier';
import { SseManager } from './infrastructure/realtime/sse-manager';
import { logger } from './infrastructure/logger';
import type { IEmbeddingService } from './domain/ports/embedding.service.port';
import type { ICategoryEmbeddingRepository } from './domain/ports/category-embedding.repository.port';
import type { IEventPublisher } from './domain/ports/event-publisher.port';
import type { ICategoryRepository } from './domain/ports/category.repository.port';
import type { IJobQueue } from './domain/ports/job-queue.port';
import type { ISseNotifier } from './domain/ports/sse-notifier.port';
import type { IAuthService } from './domain/ports/auth.service.port';
import type { IUserRepository } from './domain/ports/user.repository.port';
import type { ICompanyProductRepository } from './domain/ports/company-product.repository.port';
import type { ICompanyLocationRepository } from './domain/ports/company-location.repository.port';
import type { IReservationRepository } from './domain/ports/reservation.repository.port';
import type { IPricingRuleRepository } from './domain/ports/pricing-rule.repository.port';
import type { IPaymentGateway } from './domain/ports/payment-gateway.port';
import type { IPaymentRepository } from './domain/ports/payment.repository.port';
import type { IGeolocationService } from './domain/ports/geolocation.service.port';
import { CircuitBreakerAuthService } from './infrastructure/auth/circuit-breaker-auth.service';
import { CircuitBreakerAuthVerifier } from './infrastructure/auth/circuit-breaker-auth.verifier';
import { FirebaseAuthService } from './infrastructure/auth/firebase-auth.service';
import { FirebaseAuthVerifier } from './infrastructure/auth/firebase-auth.verifier';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { PrismaCompanyProductRepository } from './infrastructure/repositories/prisma-company-product.repository';
import { PrismaCompanyLocationRepository } from './infrastructure/repositories/prisma-company-location.repository';
import { PrismaReservationRepository } from './infrastructure/repositories/prisma-reservation.repository';
import { PrismaPricingRuleRepository } from './infrastructure/repositories/prisma-pricing-rule.repository';
import { PrismaPaymentRepository } from './infrastructure/repositories/prisma-payment.repository';
import { MockGeolocationService } from './infrastructure/geolocation/mock-geolocation.service';
import { OrsGeolocationService } from './infrastructure/geolocation/ors-geolocation.service';
import { MockPaymentGateway } from './infrastructure/payment/mock-payment-gateway';
import { CircuitBreakerPaymentGateway } from './infrastructure/payment/circuit-breaker-payment-gateway';
import { RedisTopClientsCache } from './infrastructure/cache/redis-top-clients-cache';
import { RecalculateTopClientsJob } from './infrastructure/jobs/recalculate-top-clients.job';
import type { ITopClientsCache } from './domain/ports/top-clients-cache.port';
import { AuthController } from './presentation/controllers/auth.controller';
import { CompanyProductController } from './presentation/controllers/company-product.controller';
import { CompanyLocationController } from './presentation/controllers/company-location.controller';
import { ReservationController } from './presentation/controllers/reservation.controller';
import { PrismaClient } from './generated/client';
import { TYPES } from './types';

export async function buildContainer(): Promise<Container> {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  const container = new Container({ defaultScope: 'Singleton' });

  const prisma = new PrismaClient();

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  container.bind<Redis>('RedisClient').toConstantValue(redis);

  // SSE — SseManager (singleton) + RedisSseNotifier
  const sseManager = new SseManager();
  const redisSubscriber = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  void sseManager.initialize(redisSubscriber);
  container.bind<SseManager>(TYPES.SseManager).toConstantValue(sseManager);
  const redisSseNotifier = new RedisSseNotifier(redis);
  container.bind<ISseNotifier>(TYPES.SseNotifier).toConstantValue(redisSseNotifier);

  container.bind<PrismaClient>(PrismaClient).toConstantValue(prisma);

  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: '-c search_path=booking,public',
  });
  container.bind<Pool>(TYPES.PgPool).toConstantValue(pgPool);

  // Repositories
  container
    .bind<IUserRepository>(TYPES.UserRepository)
    .toDynamicValue(() => new PrismaUserRepository(prisma));
  container
    .bind<ICompanyProductRepository>(TYPES.CompanyProductRepository)
    .to(PrismaCompanyProductRepository);
  container
    .bind<ICompanyLocationRepository>(TYPES.CompanyLocationRepository)
    .to(PrismaCompanyLocationRepository);
  container
    .bind<IReservationRepository>(TYPES.ReservationRepository)
    .to(PrismaReservationRepository);
  container
    .bind<IPricingRuleRepository>(TYPES.PricingRuleRepository)
    .to(PrismaPricingRuleRepository);
  container.bind<IPaymentRepository>(TYPES.PaymentRepository).to(PrismaPaymentRepository);

  // Category repository (usado al encolar jobs Bull)
  container
    .bind<ICategoryRepository>(TYPES.CategoryRepository)
    .toDynamicValue(() => new PrismaCategoryRepository(prisma));

  // AI Job Queue (Bull → ai-worker)
  container
    .bind<IJobQueue>(TYPES.AiJobQueue)
    .toDynamicValue(() => new BullAiJobQueue(process.env.REDIS_URL ?? 'redis://localhost:6379'));

  // Geolocation — ORS (Docker) si ORS_BASE_URL está definido, Haversine si no
  container.bind<IGeolocationService>(TYPES.GeolocationService).toDynamicValue(() => {
    const orsBaseUrl = process.env.ORS_BASE_URL ?? '';
    const orsApiKey = process.env.ORS_API_KEY ?? '';
    const fallback = new MockGeolocationService();
    if (orsBaseUrl) {
      return new OrsGeolocationService(orsBaseUrl, orsApiKey, fallback);
    }
    return fallback;
  });

  // Payment gateway (circuit breaker wrapping mock)
  container.bind<IPaymentGateway>(TYPES.PaymentGateway).toDynamicValue(() => {
    const mock = new MockPaymentGateway();
    return new CircuitBreakerPaymentGateway(mock);
  });

  // Cache
  container.bind<ITopClientsCache>(TYPES.TopClientsCache).to(RedisTopClientsCache);
  container.bind<RecalculateTopClientsJob>(TYPES.RecalculateTopClientsJob).toDynamicValue((ctx) => {
    const productRepo = ctx.container.get<ICompanyProductRepository>(
      TYPES.CompanyProductRepository,
    );
    const cache = ctx.container.get<ITopClientsCache>(TYPES.TopClientsCache);
    return new RecalculateTopClientsJob(prisma, productRepo, cache);
  });

  const recalculateQueue = new Bull(
    'recalculate-top-clients',
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );
  void recalculateQueue.process(async () => {
    const job = container.get<RecalculateTopClientsJob>(TYPES.RecalculateTopClientsJob);
    await job.execute();
  });
  void recalculateQueue.add({}, { repeat: { cron: '0 0 * * 0' } });

  // Auth
  container
    .bind<IAuthService>(TYPES.AuthService)
    .toDynamicValue(() => new CircuitBreakerAuthService(new FirebaseAuthService()));
  container
    .bind<IAuthVerifier>(TYPES.AuthVerifier)
    .toDynamicValue(() => new CircuitBreakerAuthVerifier(new FirebaseAuthVerifier()));

  // Auth use cases
  container.bind<RegisterUserUseCase>(TYPES.RegisterUserUseCase).toDynamicValue((ctx) => {
    const repo = ctx.container.get<IUserRepository>(TYPES.UserRepository);
    const auth = ctx.container.get<IAuthService>(TYPES.AuthService);
    return new RegisterUserUseCase(repo, auth);
  });

  container.bind<LoginUserUseCase>(TYPES.LoginUseCase).toDynamicValue((ctx) => {
    const repo = ctx.container.get<IUserRepository>(TYPES.UserRepository);
    const auth = ctx.container.get<IAuthService>(TYPES.AuthService);
    return new LoginUserUseCase(repo, auth);
  });

  // Company product use cases
  container
    .bind<CreateCompanyProductUseCase>(TYPES.CreateCompanyProductUseCase)
    .to(CreateCompanyProductUseCase);
  container
    .bind<ListCompanyProductsUseCase>(TYPES.ListCompanyProductsUseCase)
    .to(ListCompanyProductsUseCase);
  container
    .bind<UpdateCompanyProductUseCase>(TYPES.UpdateCompanyProductUseCase)
    .to(UpdateCompanyProductUseCase);
  container
    .bind<DeleteCompanyProductUseCase>(TYPES.DeleteCompanyProductUseCase)
    .to(DeleteCompanyProductUseCase);

  // Company location use cases
  container
    .bind<CreateCompanyLocationUseCase>(TYPES.CreateCompanyLocationUseCase)
    .to(CreateCompanyLocationUseCase);
  container
    .bind<ListCompanyLocationsUseCase>(TYPES.ListCompanyLocationsUseCase)
    .to(ListCompanyLocationsUseCase);
  container
    .bind<UpdateCompanyLocationUseCase>(TYPES.UpdateCompanyLocationUseCase)
    .to(UpdateCompanyLocationUseCase);
  container
    .bind<DeleteCompanyLocationUseCase>(TYPES.DeleteCompanyLocationUseCase)
    .to(DeleteCompanyLocationUseCase);

  // Reservation use cases
  container.bind<PricingService>(TYPES.PricingService).toDynamicValue((ctx) => {
    const repo = ctx.container.get<IPricingRuleRepository>(TYPES.PricingRuleRepository);
    const parseNum = (val: string | undefined, fallback: number) => {
      const n = Number(val);
      return Number.isFinite(n) && val !== '' ? n : fallback;
    };
    const defaults: Partial<PricingDefaults> = {
      baseRate: parseNum(process.env.PRICING_DEFAULT_BASE_RATE, 100),
      ratePerKm: parseNum(process.env.PRICING_DEFAULT_RATE_PER_KM, 50),
      surchargePercent: parseNum(process.env.PRICING_DEFAULT_SURCHARGE_PERCENT, 0),
    };
    return new PricingService(repo, defaults);
  });

  container.bind<QuoteReservationUseCase>(TYPES.QuoteReservationUseCase).toDynamicValue((ctx) => {
    const reservationRepo = ctx.container.get<IReservationRepository>(TYPES.ReservationRepository);
    const pricing = ctx.container.get<PricingService>(TYPES.PricingService);
    const geo = ctx.container.get<IGeolocationService>(TYPES.GeolocationService);
    return new QuoteReservationUseCase(reservationRepo, pricing, geo);
  });

  container
    .bind<IEmbeddingService>(TYPES.EmbeddingService)
    .toDynamicValue(() => new OllamaEmbeddingService());

  container
    .bind<ICategoryEmbeddingRepository>(TYPES.CategoryEmbeddingRepository)
    .toDynamicValue(() => new PgCategoryEmbeddingRepository(pgPool));

  container
    .bind<ClassificationCascadeService>(TYPES.ClassificationCascade)
    .toDynamicValue((ctx) => {
      const embeddingService = ctx.container.get<IEmbeddingService>(TYPES.EmbeddingService);
      const embeddingRepo = ctx.container.get<ICategoryEmbeddingRepository>(
        TYPES.CategoryEmbeddingRepository,
      );
      const ruleB = new DbRuleBasedCategorizador(prisma);
      const threshold = Number(process.env.EMBEDDINGS_SIMILARITY_THRESHOLD ?? '0.6');
      const embeddings = new EmbeddingsCategorizador(embeddingService, embeddingRepo, threshold);
      return new ClassificationCascadeService([ruleB, embeddings]);
    });

  // RabbitMQ channel
  const amqpConn = await amqplib.connect(process.env.RABBITMQ_URL ?? 'amqp://localhost');
  const amqpChannel = await amqpConn.createChannel();
  container.bind<Channel>(TYPES.RabbitMQChannel).toConstantValue(amqpChannel);

  // Event publisher — RabbitMQ real (reemplaza MockEventPublisher)
  container
    .bind<IEventPublisher>(TYPES.EventPublisher)
    .toDynamicValue(
      (ctx) => new RabbitMQEventPublisher(ctx.container.get<Channel>(TYPES.RabbitMQChannel)),
    );

  container
    .bind<CreateParticularReservationUseCase>(TYPES.CreateParticularReservationUseCase)
    .toDynamicValue((ctx) => {
      const userRepo = ctx.container.get<IUserRepository>(TYPES.UserRepository);
      const reservationRepo = ctx.container.get<IReservationRepository>(
        TYPES.ReservationRepository,
      );
      const quote = ctx.container.get<QuoteReservationUseCase>(TYPES.QuoteReservationUseCase);
      const cascade = ctx.container.get<ClassificationCascadeService>(TYPES.ClassificationCascade);
      const eventPublisher = ctx.container.get<IEventPublisher>(TYPES.EventPublisher);
      const jobQueue = ctx.container.get<IJobQueue>(TYPES.AiJobQueue);
      const sseNotifier = ctx.container.get<ISseNotifier>(TYPES.SseNotifier);
      const categoryRepo = ctx.container.get<ICategoryRepository>(TYPES.CategoryRepository);
      const embeddingService = ctx.container.get<IEmbeddingService>(TYPES.EmbeddingService);
      const embeddingRepo = ctx.container.get<ICategoryEmbeddingRepository>(
        TYPES.CategoryEmbeddingRepository,
      );
      return new CreateParticularReservationUseCase(
        userRepo,
        reservationRepo,
        quote,
        cascade,
        eventPublisher,
        jobQueue,
        sseNotifier,
        categoryRepo,
        embeddingService,
        embeddingRepo,
      );
    });

  container
    .bind<CreateEmpresaReservationUseCase>(TYPES.CreateReservationUseCase)
    .toDynamicValue((ctx) => {
      const userRepo = ctx.container.get<IUserRepository>(TYPES.UserRepository);
      const reservationRepo = ctx.container.get<IReservationRepository>(
        TYPES.ReservationRepository,
      );
      const productRepo = ctx.container.get<ICompanyProductRepository>(
        TYPES.CompanyProductRepository,
      );
      const quote = ctx.container.get<QuoteReservationUseCase>(TYPES.QuoteReservationUseCase);
      const cache = ctx.container.get<ITopClientsCache>(TYPES.TopClientsCache);
      return new CreateEmpresaReservationUseCase(
        userRepo,
        reservationRepo,
        productRepo,
        quote,
        cache,
      );
    });

  container.bind<GetReservationsUseCase>(TYPES.GetReservationsUseCase).toDynamicValue((ctx) => {
    const userRepo = ctx.container.get<IUserRepository>(TYPES.UserRepository);
    const reservationRepo = ctx.container.get<IReservationRepository>(TYPES.ReservationRepository);
    return new GetReservationsUseCase(userRepo, reservationRepo);
  });

  container.bind<PayReservationUseCase>(TYPES.PayReservationUseCase).toDynamicValue((ctx) => {
    const reservationRepo = ctx.container.get<IReservationRepository>(TYPES.ReservationRepository);
    const paymentRepo = ctx.container.get<IPaymentRepository>(TYPES.PaymentRepository);
    const paymentGateway = ctx.container.get<IPaymentGateway>(TYPES.PaymentGateway);
    const userRepo = ctx.container.get<IUserRepository>(TYPES.UserRepository);
    const eventPublisher = ctx.container.get<IEventPublisher>(TYPES.EventPublisher);
    return new PayReservationUseCase(
      reservationRepo,
      paymentRepo,
      paymentGateway,
      userRepo,
      eventPublisher,
    );
  });

  // Email service — NodemailerAdapter si SMTP_HOST definido, MockEmailService si no
  container.bind<IEmailService>(TYPES.EmailService).toDynamicValue(() => {
    const host = process.env.SMTP_HOST;
    if (host) {
      return new NodemailerEmailService({
        host,
        port: Number(process.env.SMTP_PORT ?? '587'),
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
        from: process.env.SMTP_FROM ?? 'MOVE Platform <noreply@move.uy>',
      });
    }
    return new MockEmailService();
  });

  // Classify reservation (manual — operator)
  container
    .bind<ClassifyReservationUseCase>(TYPES.ClassifyReservationUseCase)
    .toDynamicValue((ctx) => {
      const reservationRepo = ctx.container.get<IReservationRepository>(
        TYPES.ReservationRepository,
      );
      const categoryRepo = ctx.container.get<ICategoryRepository>(TYPES.CategoryRepository);
      const resumeUseCase = ctx.container.get<ResumeClassifiedReservationUseCase>(
        TYPES.ResumeClassifiedReservationUseCase,
      );
      const eventPublisher = ctx.container.get<IEventPublisher>(TYPES.EventPublisher);
      return new ClassifyReservationUseCase(
        reservationRepo,
        categoryRepo,
        resumeUseCase,
        eventPublisher,
      );
    });

  // Reject reservation (operator — bien fuera de MOVE)
  container.bind<RejectReservationUseCase>(TYPES.RejectReservationUseCase).toDynamicValue((ctx) => {
    const reservationRepo = ctx.container.get<IReservationRepository>(TYPES.ReservationRepository);
    const userRepo = ctx.container.get<IUserRepository>(TYPES.UserRepository);
    const emailService = ctx.container.get<IEmailService>(TYPES.EmailService);
    return new RejectReservationUseCase(reservationRepo, userRepo, emailService);
  });

  // Messaging use cases
  container
    .bind<CompleteReservationUseCase>(TYPES.CompleteReservationUseCase)
    .toDynamicValue((ctx) => {
      const reservationRepo = ctx.container.get<IReservationRepository>(
        TYPES.ReservationRepository,
      );
      return new CompleteReservationUseCase(reservationRepo);
    });

  container
    .bind<ResumeClassifiedReservationUseCase>(TYPES.ResumeClassifiedReservationUseCase)
    .toDynamicValue((ctx) => {
      const reservationRepo = ctx.container.get<IReservationRepository>(
        TYPES.ReservationRepository,
      );
      const quoteUseCase = ctx.container.get<QuoteReservationUseCase>(
        TYPES.QuoteReservationUseCase,
      );
      return new ResumeClassifiedReservationUseCase(reservationRepo, quoteUseCase);
    });

  // Messaging consumers
  container
    .bind<ReservationClassifiedConsumer>(TYPES.ReservationClassifiedConsumer)
    .toDynamicValue((ctx) => {
      const channel = ctx.container.get<Channel>(TYPES.RabbitMQChannel);
      const resumeUseCase = ctx.container.get<ResumeClassifiedReservationUseCase>(
        TYPES.ResumeClassifiedReservationUseCase,
      );
      return new ReservationClassifiedConsumer(channel, resumeUseCase, logger);
    });

  container
    .bind<ReservationAssignedConsumer>(TYPES.ReservationAssignedConsumer)
    .toDynamicValue((ctx) => {
      const channel = ctx.container.get<Channel>(TYPES.RabbitMQChannel);
      const reservationRepo = ctx.container.get<IReservationRepository>(
        TYPES.ReservationRepository,
      );
      return new ReservationAssignedConsumer(channel, reservationRepo, logger);
    });

  container
    .bind<TransferCompletedConsumer>(TYPES.TransferCompletedConsumer)
    .toDynamicValue((ctx) => {
      const channel = ctx.container.get<Channel>(TYPES.RabbitMQChannel);
      const completeUseCase = ctx.container.get<CompleteReservationUseCase>(
        TYPES.CompleteReservationUseCase,
      );
      return new TransferCompletedConsumer(channel, completeUseCase, logger);
    });

  // Controllers
  container.bind<AuthController>(TYPES.AuthController).to(AuthController);
  container
    .bind<CompanyProductController>(TYPES.CompanyProductController)
    .to(CompanyProductController);
  container
    .bind<CompanyLocationController>(TYPES.CompanyLocationController)
    .to(CompanyLocationController);
  container.bind<ReservationController>(TYPES.ReservationController).to(ReservationController);

  return container;
}
