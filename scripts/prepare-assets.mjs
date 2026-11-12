import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';

const expected =
  'eddb402b089505bcde1f80e5638748ddf1928e056eb82e388b0f3f7c70bf21f1';
const original = await readFile('assets/logo.png');
if (createHash('sha256').update(original).digest('hex') !== expected)
  throw new Error('Approved Nour und Huda logo PNG changed.');
const optimized = await readFile('assets/logo.webp');
if (
  createHash('sha256').update(optimized).digest('hex') !==
  '0841fa0fed1cd3b84b407d5748efe37d114005cdec391e7429259da7f9a82ac0'
)
  throw new Error('Lossless WebP derivative changed.');
const transparent = await readFile('assets/logo-transparent.png');
if (
  createHash('sha256').update(transparent).digest('hex') !==
  'bdd7b6cdcdc87d71efdd4069160261ddaac157c9fa03ef874d3e035aa504d7fb'
)
  throw new Error(
    'Owner-reviewed transparent logo changed; obtain new approval.',
  );
await mkdir('public/assets', { recursive: true });
await mkdir('public/licenses', { recursive: true });
await copyFile('assets/logo.webp', 'public/assets/logo.webp');
await copyFile(
  'assets/logo-transparent.png',
  'public/assets/logo-transparent.png',
);
for (const font of ['amiri', 'aref-ruqaa']) {
  const source = `node_modules/@fontsource/${font}/LICENSE`;
  const license = await readFile(source, 'utf8');
  if (!license.includes('SIL OPEN FONT LICENSE Version 1.1')) {
    throw new Error(`Review changed license for ${font} before distributing.`);
  }
  await copyFile(source, `public/licenses/${font}-OFL.txt`);
}
const adhanLicense = await readFile('node_modules/adhan/LICENSE', 'utf8');
if (
  !adhanLicense.includes('MIT License') ||
  !adhanLicense.includes('Batoul Apps')
) {
  throw new Error('Review changed Adhan license before distributing.');
}
await copyFile('node_modules/adhan/LICENSE', 'public/licenses/adhan-MIT.txt');
console.log(
  'Original logo verified; local logo, OFL and Adhan MIT notices prepared.',
);
