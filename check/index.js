const fs = require('fs');
const path = require('path');
const MarkdownIt = require('./vendor/markdown-it.js');

// Checks (or, with --fix, updates) the table of contents of Markdown files, generating it exactly
// as the VS Code extension "Markdown All in One" (yzhang.markdown-all-in-one 3.6.3) does on save
// with its default settings: levels 1..6, GitHub slugs, "-" markers, 2-space indentation. The
// logic follows the extension's own toc.ts and slugify.ts.

const md = new MarkdownIt('commonmark');
const FENCE = /^ {0,3}(?<fence>(?<char>[`~])\k<char>{2,})[^`\r\n]*$[^]*?^ {0,3}\k<fence>\k<char>* *$/gm;
const SLUG_DROP = /[^\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc}\- ]/gu;

const inline = (text, env) => md.parseInline(text, env)[0].children;

// The anchor GitHub gives a heading
function slug(raw, env) {
  const text = inline(raw, env).reduce(
    (s, t) => (t.type === 'image' || t.type === 'html_inline' ? s : s + t.content),
    '',
  );
  return text.replace(SLUG_DROP, '').toLowerCase().replace(/ /g, '-');
}

// The text of a heading as the ToC shows it
function visible(raw, env) {
  return inline(raw, env).reduce((s, t) => {
    switch (t.type) {
      case 'text':
        return s + t.content.replace(/[&*<>\[\\\]_`]/g, '\\$&');
      case 'code_inline':
        return s + t.markup + t.content + t.markup;
      case 'strong_open':
      case 'strong_close':
      case 'em_open':
      case 'em_close':
        return s + t.markup;
      case 'link_open':
      case 'link_close':
      case 'image':
      case 'html_inline':
        return s;
      case 'softbreak':
      case 'hardbreak':
        return s + ' ';
      default:
        return s + t.content;
    }
  }, '');
}

// Returns [{level, raw, inToc}] for every ATX or setext heading outside front matter, code and comments
function headings(text) {
  const blank = (s) => s.replace(/[^\r\n]/g, '');
  const lines = text
    .replace(/^---.+?(?:\r?\n)---(?=[ \t]*\r?\n)/s, blank)
    .replace(/^\t+/gm, (t) => '    '.repeat(t.length))
    .replace(/^( {0,3})<!--([^]*?)-->.*$/gm, (m, indent, body) =>
      indent.length === 0 && /omit (in|from) toc/.test(body) ? m : blank(m),
    )
    .replace(FENCE, blank)
    .split(/\r?\n/g);
  lines.forEach((line, i, a) => {
    const setext =
      i < a.length - 1 &&
      /^ {0,3}(?:=+|-+)[ \t]*$/.test(a[i + 1]) &&
      /^ {0,3}[^ \t\f\v]/.test(line) &&
      !/^ {0,3}#{1,6}(?: |\t|$)/.test(line) &&
      !/^ {0,3}(?:[*+-]|\d{1,9}(?:\.|\)))(?: |\t|$)/.test(line) &&
      !/^ {0,3}>/.test(line) &&
      !/^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})[ \t]*$/.test(line);
    if (setext) {
      a[i] = (a[i + 1].includes('=') ? '# ' : '## ') + line;
      a[i + 1] = '';
    }
    a[i] = a[i].replace(/[ \t]+$/, '');
  });
  const found = [];
  lines.forEach((line, i) => {
    if (!/^ {0,3}#{1,6}(?: |\t|$)/.test(line)) return;
    const [, hashes, rest] = /^ {0,3}(#{1,6})(.*)$/.exec(line);
    const omitted =
      (i > 0 && /^<!-- omit (in|from) toc -->$/.test(lines[i - 1])) ||
      /<!-- omit (in|from) toc -->$/.test(line);
    found.push({
      level: hashes.length,
      raw: rest.replace(/^[ \t]+/, '').replace(/[ \t]+#+[ \t]*$/, ''),
      inToc: !omitted,
    });
  });
  return found;
}

// The ToC for a document, one line per entry, each ending with a newline
function toc(text, env) {
  const seen = new Map();
  // omitted headings are counted too, when numbering duplicate slugs
  const all = headings(text).map((h) => {
    let s = slug(h.raw, env);
    const n = seen.get(s);
    if (n === undefined) seen.set(s, 0);
    else {
      seen.set(s, n + 1);
      s += '-' + (n + 1);
    }
    return { ...h, slug: s };
  });
  const entries = all.filter((h) => h.inToc);
  if (entries.length === 0) return '';
  const top = Math.max(1, Math.min(...entries.map((h) => h.level)));
  const lines = entries.map((h) => '  '.repeat(h.level - top) + `- [${visible(h.raw, env)}](#${h.slug})`);
  while (/^[ \t]/.test(lines[0])) lines.shift();
  lines.push('');
  return lines.join('\n');
}

// string-similarity's compareTwoStrings (Dice's coefficient on bigrams), as the extension uses
function dice(a, b) {
  a = a.replace(/\s+/g, '');
  b = b.replace(/\s+/g, '');
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.substring(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.substring(i, i + 2);
    const n = grams.get(g) ?? 0;
    if (n > 0) {
      grams.set(g, n - 1);
      hits++;
    }
  }
  return (2 * hits) / (a.length + b.length - 2);
}

function prefixScore(a, b) {
  const min = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);
  let same = 0;
  while (same < min && a[same] === b[same]) same++;
  return same < min ? same / min : min / max;
}

// Returns the line ranges [start, end) of the top-level lists of links to headings that look
// enough like `generated` to be the ToC, as the extension finds them
function tocRanges(text, lines, env, generated) {
  const tokens = md.parse(text, env);
  const ranges = [];
  tokens.forEach((t, i) => {
    const isList =
      t.level === 0 &&
      (t.type === 'bullet_list_open' || (t.type === 'ordered_list_open' && t.attrGet('start') === null));
    if (!isList) return;
    let [start, end] = t.map;
    if (start > 0 && lines[start - 1] === '<!-- no toc -->') return;
    const first = tokens[i + 3];
    if (first?.type !== 'inline') return;
    const kids = first.children;
    if (
      kids[0]?.type !== 'link_open' ||
      !kids[0].attrGet('href').startsWith('#') ||
      kids.findIndex((k) => k.type === 'link_close') !== kids.length - 1
    )
      return;
    while (end > start && /^\s*$/.test(lines[end - 1])) end--;
    const current = lines.slice(start, end).join('\n') + '\n';
    if (prefixScore(generated, current) + dice(generated, current) > 0.5) ranges.push([start, end]);
  });
  return ranges;
}

// Returns {found, text, ranges, generated}: the text with its ToC regenerated
function update(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const env = {};
  md.parse(text, env); // collects link reference definitions, which the inline parse uses
  const generated = toc(text, env);
  const lines = text.split(/\r?\n/);
  const ranges = tocRanges(text, lines, env, generated);
  const replacement = generated.split('\n').slice(0, -1);
  const out = lines.slice();
  for (const [start, end] of ranges.slice().reverse()) out.splice(start, end - start, ...replacement);
  return { found: ranges.length > 0, text: out.join(eol), ranges, generated };
}

module.exports = { update };

if (require.main === module) {
  // GitHub Actions sets INPUT_<NAME> for each input; locally, files and --fix can be given as arguments
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const named = args.filter((a) => a !== '--fix');
  const listed = named.length ? named : (process.env.INPUT_FILES ?? '').split(/\s+/).filter(Boolean);
  const root = process.env.GITHUB_WORKSPACE ?? '.';
  // with no files listed, the README in the root, whatever its case (README.md, ReadMe.md, ...)
  const readme = fs.readdirSync(root).find((f) => f.toLowerCase() === 'readme.md');
  const files = listed.length ? listed : readme ? [readme] : [];
  if (files.length === 0) console.log('- no README.md, nothing to check');

  for (const file of files) {
    const fullPath = path.resolve(root, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`::error file=${file}::File not found: ${file}`);
      process.exitCode = 1;
      continue;
    }
    const before = fs.readFileSync(fullPath, 'utf8');
    const { found, text, ranges, generated } = update(before);
    if (!found) {
      console.log(`- ${file}: no table of contents, nothing to check`);
    } else if (text === before) {
      console.log(`✓ ${file}: table of contents is up to date`);
    } else if (fix) {
      fs.writeFileSync(fullPath, text);
      console.log(`✓ ${file}: table of contents updated`);
    } else {
      const [start, end] = ranges[0];
      console.error(
        `::error file=${file},line=${start + 1},endLine=${end}::The table of contents is out of date. ` +
          `Save the file in VS Code with Markdown All in One installed, or run this action's check/index.js with --fix.`,
      );
      console.log(`::group::Expected table of contents for ${file}`);
      console.log(generated);
      console.log('::endgroup::');
      process.exitCode = 1;
    }
  }
}
