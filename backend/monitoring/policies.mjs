export const project = 'nour-und-huda';
export const region = 'europe-west3';

/** Built-in Cloud Run metrics; no request bodies, tokens, or custom metrics. */
export function alertPolicies(channel) {
  if (!/^projects\/nour-und-huda\/notificationChannels\/\d+$/.test(channel))
    throw new Error('Notification channel must belong to nour-und-huda');

  function policy(id, title, service, extra, threshold, period, duration) {
    const filter = [
      'resource.type = "cloud_run_revision"',
      `resource.labels.project_id = "${project}"`,
      `resource.labels.location = "${region}"`,
      `resource.labels.service_name = "${service}"`,
      'metric.type = "run.googleapis.com/request_count"',
      extra,
    ]
      .filter(Boolean)
      .join(' AND ');
    return {
      displayName: `Nur staging: ${title}`,
      userLabels: { service: 'nur-prayer', environment: 'staging', policy: id },
      enabled: true,
      combiner: 'OR',
      notificationChannels: [channel],
      alertStrategy: { autoClose: '1800s' },
      documentation: {
        mimeType: 'text/markdown',
        content:
          'Staging only; inspect aggregate status/counts, never participant tokens or bodies. See backend/monitoring/README.md for response and rollback. Confirm deployed service names before acceptance testing. No data before deployment is expected; this alert does not prove availability.',
      },
      conditions: [
        {
          displayName: title,
          conditionThreshold: {
            filter,
            comparison: 'COMPARISON_GT',
            thresholdValue: threshold,
            duration,
            trigger: { count: 1 },
            aggregations: [
              {
                alignmentPeriod: period,
                perSeriesAligner: 'ALIGN_SUM',
                crossSeriesReducer: 'REDUCE_SUM',
              },
            ],
          },
        },
      ],
    };
  }
  return [
    policy(
      'api-errors',
      'API 5xx responses',
      'prayerapi',
      'metric.labels.response_code_class = "5xx"',
      0,
      '300s',
      '0s',
    ),
    policy(
      'api-throttled',
      'API 429 responses',
      'prayerapi',
      'metric.labels.response_code = "429"',
      0,
      '300s',
      '0s',
    ),
    policy(
      'api-traffic',
      'API high request volume',
      'prayerapi',
      '',
      100,
      '60s',
      '120s',
    ),
    policy(
      'cleanup-errors',
      'Cleanup 5xx responses',
      'expireprayergatherings',
      'metric.labels.response_code_class = "5xx"',
      0,
      '300s',
      '0s',
    ),
  ];
}
