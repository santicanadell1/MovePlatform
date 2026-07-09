import type { PrismaClient } from '../generated/client';

/**
 * Trunca tablas transaccionales entre tests.
 * Orden importa por FK: payment → good → reservation → user.
 * No toca category, pricingRule, companyProduct, companyLocation (son datos de seed).
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.good.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
