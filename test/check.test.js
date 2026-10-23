const test = require('node:test');
const assert = require('node:assert');
const { update } = require('../check/index.js');

// a document with a stale ToC (one entry) followed by its headings
const doc = (headings, toc = '- [Old](#old)\n') => `<!-- omit in toc -->\n# Title\n\n${toc}\n${headings}`;
const tocOf = (text) => update(text).generated;

test('nests entries by level, two spaces a level, under the shallowest heading', () => {
  assert.strictEqual(
    tocOf(doc('## One\n### One A\n#### One A i\n## Two\n')),
    '- [One](#one)\n  - [One A](#one-a)\n    - [One A i](#one-a-i)\n- [Two](#two)\n',
  );
});

test('leaves out a heading marked omit in toc or omit from toc, above it or at its end', () => {
  const headings = '## Kept\n<!-- omit from toc -->\n## Above\n## End <!-- omit in toc -->\n';
  assert.strictEqual(tocOf(doc(headings)), '- [Kept](#kept)\n');
});

test('makes GitHub slugs, numbering duplicates, omitted headings included', () => {
  const headings = '## Merge (`<<`)\n## Comprehensions & Quantification\n## 1. Build (`npm run x`)\n## A\n## A\n';
  assert.strictEqual(
    tocOf(doc(headings)),
    [
      '- [Merge (`<<`)](#merge-)',
      '- [Comprehensions \\& Quantification](#comprehensions--quantification)',
      '- [1. Build (`npm run x`)](#1-build-npm-run-x)',
      // the omitted title is "title"; these are the first and second "a"
      '- [A](#a)',
      '- [A](#a-1)',
      '',
    ].join('\n'),
  );
});

test('shows a link in a heading as its text, and keeps emphasis', () => {
  assert.strictEqual(
    tocOf(doc('## See [the docs](https://example.com) **now**\n')),
    '- [See the docs **now**](#see-the-docs-now)\n',
  );
});

test('ignores headings in fenced code and comments, and reads setext headings', () => {
  const headings = '```\n## Not a heading\n```\n<!--\n## Nor this\n-->\nSetext\n------\n';
  assert.strictEqual(tocOf(doc(headings)), '- [Setext](#setext)\n');
});

test('replaces a stale ToC in place, and leaves an up-to-date one as it is', () => {
  const stale = doc('## One\n## Two\n', '- [One](#one)\n');
  const { found, text } = update(stale);
  assert.ok(found);
  assert.strictEqual(text, doc('## One\n## Two\n', '- [One](#one)\n- [Two](#two)\n'));
  assert.strictEqual(update(text).text, text);
});

test('keeps CRLF line endings', () => {
  const crlf = doc('## One\n## Two\n', '- [One](#one)\n').replace(/\n/g, '\r\n');
  assert.ok(update(crlf).text.includes('- [One](#one)\r\n- [Two](#two)\r\n'));
});

test('finds no ToC in a document without one, or in a list that is not like it', () => {
  assert.strictEqual(update('# Title\n\n## One\n').found, false);
  // a list of links to headings that is too unlike the generated ToC is not taken for it
  const unlike = doc('## A\n## B\n## C\n## D\n## E\n## F\n', '- [Elsewhere](#somewhere-else)\n');
  assert.strictEqual(update(unlike).found, false);
});

test('skips a list marked no toc', () => {
  assert.strictEqual(update(doc('## One\n', '<!-- no toc -->\n- [One](#one)\n')).found, false);
});
