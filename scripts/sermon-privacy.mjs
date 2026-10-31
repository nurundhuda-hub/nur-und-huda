import assert from 'node:assert/strict';

// Comparison only: never write this normalization back to a source or draft.
const comparable = (text) =>
  text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
export function assertPrivateSermonAbsent(output, privateSource) {
  if (!privateSource) return;
  const publicText = comparable(output);
  const paragraphs = privateSource.split(/\r?\n\s*\r?\n/);
  for (const paragraph of paragraphs) {
    const protectedText = comparable(paragraph);
    if (protectedText.length >= 80 && !protectedText.startsWith('#'))
      assert.ok(
        !publicText.includes(protectedText),
        'Private sermon text leaked into public output.',
      );
  }
}
