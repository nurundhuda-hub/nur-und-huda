// @vitest-environment node
import { expect, it } from 'vitest';
import { alertPolicies } from '../backend/monitoring/policies.mjs';

const channel = 'projects/nour-und-huda/notificationChannels/123';
it('refuses notification channels outside the authorized project', () => {
  for (const invalid of [
    '',
    'projects/example/notificationChannels/123',
    `${channel}/extra`,
  ])
    expect(() => alertPolicies(invalid)).toThrow();
});

it('restricts all metrics to the two Frankfurt prayer services in the intended project', () => {
  const policies = alertPolicies(channel);
  expect(policies).toHaveLength(4);
  for (const policy of policies) {
    expect(policy.notificationChannels).toEqual([channel]);
    const condition = policy.conditions[0]!.conditionThreshold;
    expect(condition.filter).toContain(
      'resource.labels.project_id = "nour-und-huda"',
    );
    expect(condition.filter).toContain(
      'resource.labels.location = "europe-west3"',
    );
    expect(condition.filter).toMatch(
      /resource.labels.service_name = "(prayerapi|expireprayergatherings)"/,
    );
    expect(condition.filter).toContain(
      'metric.type = "run.googleapis.com/request_count"',
    );
    // Sum across response codes and revisions: per-instance limits must not hide
    // an aggregate service spike when traffic spans the two instances.
    expect(condition.aggregations[0]!.crossSeriesReducer).toBe('REDUCE_SUM');
  }
});

it('alerts on 5xx, application throttling and sustained traffic below the global request limit', () => {
  const policies = alertPolicies(channel);
  const errors = policies.find((p) => p.userLabels.policy === 'api-errors')!;
  expect(errors.conditions[0]!.conditionThreshold.filter).toContain(
    'response_code_class = "5xx"',
  );
  expect(errors.conditions[0]!.conditionThreshold.thresholdValue).toBe(0);
  const throttled = policies.find(
    (p) => p.userLabels.policy === 'api-throttled',
  )!;
  expect(throttled.conditions[0]!.conditionThreshold.filter).toContain(
    'response_code = "429"',
  );
  const traffic = policies.find((p) => p.userLabels.policy === 'api-traffic')!;
  expect(traffic.conditions[0]!.conditionThreshold).toMatchObject({
    thresholdValue: 100,
    duration: '120s',
    aggregations: [{ alignmentPeriod: '60s', perSeriesAligner: 'ALIGN_SUM' }],
  });
});
