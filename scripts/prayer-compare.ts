import { readFileSync } from 'node:fs';
import { PRAYERS } from '../src/lib/prayer-times.ts';
import { hospitalLocation } from '../src/data/prayer-settings.ts';
import { settingsFromPreset } from '../src/lib/prayer-calculation/config.ts';
import {
  compareReference,
  type ReferenceSample,
} from '../src/lib/prayer-calculation/comparison.ts';

const reference = JSON.parse(
  readFileSync(
    new URL('../validation/prayer-references.json', import.meta.url),
    'utf8',
  ),
) as { samples: ReferenceSample[] };
const candidates = [
  ['MWL / seventh', 'MuslimWorldLeague', 'seventhofthenight'],
  ['Turkey / seventh', 'Turkey', 'seventhofthenight'],
  ['MWL / middle', 'MuslimWorldLeague', 'middleofthenight'],
  ['MWL / angle portion', 'MuslimWorldLeague', 'twilightangle'],
] as const;
console.log(
  'REVIEW ONLY — signed minutes (calculated − reference). No tolerance or approval is assigned.',
);
console.log(
  '| Candidate | Date | Reference | Fajr | Dhuhr | Asr | Maghrib | Isha |',
);
console.log('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |');
for (const [label, preset, highLatitudeRule] of candidates) {
  const settings = settingsFromPreset(preset, hospitalLocation);
  settings.highLatitudeRule = highLatitudeRule;
  for (const sample of reference.samples) {
    const comparison = compareReference(settings, sample);
    console.log(
      `| ${label} | ${sample.date} | ${sample.source} | ${PRAYERS.map(({ id }) => comparison.differencesMinutes[id]).join(' | ')} |`,
    );
  }
}
