/** Official rendered widget, verified 2026-11-02. No API or timetable import. */
export const mawaqit = {
  mosqueId: 56820,
  sourceUrl:
    'https://mawaqit.net/ar/nur-und-huda-gebetsraum-im-krankenhaus-hamm-59073-deutschland',
  widgetUrl:
    'https://mawaqit.net/ar/w/nur-und-huda-gebetsraum-im-krankenhaus-hamm-59073-deutschland?showOnly5PrayerTimes=0',
  timezone: 'Europe/Berlin',
  // Owner-supplied values corroborated on the official page. These are two
  // Jumuah entries (jumua / jumua2), NOT sermon / iqama or Dhuhr times.
  friday: [
    { label: 'الجمعة الأولى', time: '13:00' },
    { label: 'الجمعة الثانية', time: '13:30' },
  ],
  verifiedOn: '2026-11-02',
} as const;
