import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';

const expected =
  '547d63a94e56f7c6a8b4e9f17370dc8f0c1ed3e733cceac7bb61f0fda8b824f5';
const original = await readFile('assets/logo.jpeg');
if (createHash('sha256').update(original).digest('hex') !== expected) {
  throw new Error(
    'The approved logo has changed. Restore the original before building.',
  );
}
await mkdir('public/assets', { recursive: true });
await mkdir('public/licenses', { recursive: true });
await copyFile('assets/logo.jpeg', 'public/assets/logo.jpeg');
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
