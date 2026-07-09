import { Good } from '../../../domain/entities/good.entity';
import { PricingService } from '../../services/pricing.service';

import { InMemoryPricingRuleRepository } from './doubles/in-memory-pricing-rule.repository';

const makeGood = (overrides: Partial<Good> = {}): Good =>
  Good.create({
    id: 'good-1',
    reservationId: 'res-1',
    description: 'Monitor',
    value: null,
    size: null,
    quantity: 1,
    categoryId: 'cat-1',
    productId: 'prod-1',
    classificationStrategy: 'preregistered',
    classificationConfidence: 1,
    createdAt: new Date(),
    ...overrides,
  });

describe('PricingService', () => {
  let repo: InMemoryPricingRuleRepository;
  let service: PricingService;

  beforeEach(() => {
    repo = new InMemoryPricingRuleRepository();
    service = new PricingService(repo);
  });

  it('usa valores por defecto cuando no hay regla para la categoría', async () => {
    await service.loadAtBoot();

    const { totalCost } = service.quote([makeGood()], 10);

    // baseRate(100) + 10km * ratePerKm(50) = 600 * quantity(1) * (1 + 0%)
    expect(totalCost).toBe(600);
  });

  it('aplica la regla de pricing de la categoría correctamente', async () => {
    repo.seed([
      {
        id: 'rule-1',
        categoryId: 'cat-1',
        rules: { baseRate: 200, ratePerKm: 100, surchargePercent: 0 },
        active: true,
      },
    ]);
    await service.loadAtBoot();

    const { totalCost } = service.quote([makeGood()], 5);

    // baseRate(200) + 5km * ratePerKm(100) = 700
    expect(totalCost).toBe(700);
  });

  it('aplica recargo por categoría', async () => {
    repo.seed([
      {
        id: 'rule-1',
        categoryId: 'cat-1',
        rules: { baseRate: 100, ratePerKm: 0, surchargePercent: 10 },
        active: true,
      },
    ]);
    await service.loadAtBoot();

    const { totalCost } = service.quote([makeGood()], 0);

    // 100 * 1.10 = 110
    expect(totalCost).toBe(110);
  });

  it('multiplica por quantity del bien', async () => {
    await service.loadAtBoot();

    const good = makeGood({ quantity: 3 });
    const { totalCost } = service.quote([good], 0);

    // baseRate(100) * 3 = 300
    expect(totalCost).toBe(300);
  });

  it('suma costos de múltiples bienes', async () => {
    await service.loadAtBoot();

    const goods = [
      makeGood({ id: 'g1', categoryId: 'cat-1' }),
      makeGood({ id: 'g2', categoryId: 'cat-2' }),
    ];
    const { totalCost } = service.quote(goods, 0);

    // 100 + 100 = 200
    expect(totalCost).toBe(200);
  });

  it('reload actualiza las reglas en memoria', async () => {
    await service.loadAtBoot();
    const { totalCost: before } = service.quote([makeGood()], 0);

    repo.seed([
      {
        id: 'rule-1',
        categoryId: 'cat-1',
        rules: { baseRate: 999, ratePerKm: 0, surchargePercent: 0 },
        active: true,
      },
    ]);
    await service.reload();

    const { totalCost: after } = service.quote([makeGood()], 0);

    expect(before).toBe(100);
    expect(after).toBe(999);
  });

  it('incluye costBreakdown con detalle por bien', async () => {
    await service.loadAtBoot();

    const { costBreakdown } = service.quote([makeGood()], 10);

    expect(costBreakdown.goods).toHaveLength(1);
    expect(costBreakdown.goods[0].distanceKm).toBe(10);
    expect(costBreakdown.goods[0].categoryId).toBe('cat-1');
  });
});
