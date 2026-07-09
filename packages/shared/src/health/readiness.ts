export type HealthCheck = () => Promise<boolean>;

export interface ReadinessResult {
  ready: boolean;
  checks: Record<string, 'ok' | 'fail'>;
}

export async function runReadinessChecks(
  checks: Record<string, HealthCheck>,
): Promise<ReadinessResult> {
  const checksResult: Record<string, 'ok' | 'fail'> = {};
  let ready = true;

  await Promise.all(
    Object.entries(checks).map(async ([name, check]) => {
      try {
        const ok = await check();
        checksResult[name] = ok ? 'ok' : 'fail';
        if (!ok) ready = false;
      } catch {
        checksResult[name] = 'fail';
        ready = false;
      }
    }),
  );

  return { ready, checks: checksResult };
}
