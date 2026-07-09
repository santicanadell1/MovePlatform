import { Counter, Registry } from 'prom-client';

describe('booking metrics', () => {
  let testRegister: Registry;
  let testHttpRequestsTotal: Counter<'method' | 'route' | 'status_code'>;
  let testReservationsCreatedTotal: Counter<'client_type'>;

  beforeEach(() => {
    testRegister = new Registry();
    testHttpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total de requests HTTP',
      labelNames: ['method', 'route', 'status_code'],
      registers: [testRegister],
    });
    testReservationsCreatedTotal = new Counter({
      name: 'reservations_created_total',
      help: 'Total de reservas creadas',
      labelNames: ['client_type'],
      registers: [testRegister],
    });
  });

  it('registra http_requests_total e incrementa con labels correctos', async () => {
    testHttpRequestsTotal.inc({ method: 'GET', route: '/v1/reservas', status_code: '200' });

    const metrics = await testRegister.getMetricsAsJSON();
    const counter = metrics.find((m) => m.name === 'http_requests_total');
    expect(counter?.values[0]?.value).toBe(1);
    expect(counter?.values[0]?.labels).toEqual({
      method: 'GET',
      route: '/v1/reservas',
      status_code: '200',
    });
  });

  it('reservations_created_total acumula por client_type', async () => {
    testReservationsCreatedTotal.inc({ client_type: 'empresa' });
    testReservationsCreatedTotal.inc({ client_type: 'empresa' });
    testReservationsCreatedTotal.inc({ client_type: 'particular' });

    const metrics = await testRegister.getMetricsAsJSON();
    const counter = metrics.find((m) => m.name === 'reservations_created_total');
    const empresaValue = counter?.values.find((v) => v.labels.client_type === 'empresa')?.value;
    const particularValue = counter?.values.find(
      (v) => v.labels.client_type === 'particular',
    )?.value;

    expect(empresaValue).toBe(2);
    expect(particularValue).toBe(1);
  });

  it('http_requests_total agrupa errores por status_code', async () => {
    testHttpRequestsTotal.inc({ method: 'POST', route: '/v1/reservas', status_code: '201' });
    testHttpRequestsTotal.inc({ method: 'POST', route: '/v1/reservas', status_code: '400' });
    testHttpRequestsTotal.inc({ method: 'GET', route: '/v1/reservas/:id', status_code: '404' });

    const metrics = await testRegister.getMetricsAsJSON();
    const counter = metrics.find((m) => m.name === 'http_requests_total');
    expect(counter?.values).toHaveLength(3);
    const total = counter?.values.reduce((sum, v) => sum + v.value, 0) ?? 0;
    expect(total).toBe(3);
  });
});
