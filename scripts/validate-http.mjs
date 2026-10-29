import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const base = new URL('http://127.0.0.1:4321/nur-und-huda/');
async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? filesUnder(path.join(directory, entry.name))
          : path.join(directory, entry.name),
      ),
    )
  ).flat();
}
const files = (await filesUnder('dist')).filter((file) =>
  /\.(html|css|js|woff2|jpeg|txt)$/.test(file),
);
for (const file of files) {
  const response = await fetch(new URL(path.relative('dist', file), base));
  assert.equal(response.status, 200, `${file}: HTTP status`);
  const actual = Buffer.from(await response.arrayBuffer());
  assert.ok(
    actual.equals(await readFile(file)),
    `${file}: served content differs from build`,
  );
}
const index = await fetch(base);
assert.equal(index.status, 200, 'Project root must resolve to index');
assert.equal(await index.text(), await readFile('dist/index.html', 'utf8'));
console.log(
  `PASS: project root and ${files.length} built routes/assets served unchanged beneath ${base.pathname}`,
);
