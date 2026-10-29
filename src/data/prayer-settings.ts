import type { CalculationSettings } from '../lib/prayer-calculation/config.ts';
import type { FridaySettings } from '../lib/prayer-calculation/adapter.ts';

// Hospital-published map CENTER, not a surveyed prayer-room location.
// Confirm the intended point/elevation/horizon with the operator before approval.
export const hospitalLocation: CalculationSettings['location'] = {
  label: 'St. Barbara-Klinik Hamm-Heessen — Am Heessener Wald 1, 59073 Hamm',
  latitude: 51.708264177437265,
  longitude: 7.841347457672773,
  sourceUrl:
    'https://www.barbaraklinik.de/kontaktdatenschutz/so-erreichen-sie-uns.html',
  status: 'provisional',
};

// No local method or Friday arrangements have been approved. Never guess them.
export const prayerSettings: CalculationSettings | null = null;
export const fridaySettings: FridaySettings | null = null;
