<!-- omit in toc -->
# Check Markdown Table of Contents

A GitHub Action that checks the table of contents of Markdown files (by default `README.md`) is up to date: that it is exactly the one the VS Code extension [Markdown All in One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one) writes when the file is saved. A pull request that adds, removes or renames a heading without updating the ToC fails, with the ToC it should have in the log.

- [What it checks](#what-it-checks)
- [Usage](#usage)
- [Fixing a ToC locally](#fixing-a-toc-locally)
- [Inputs](#inputs)
- [How it matches the extension](#how-it-matches-the-extension)

## What it checks

- The ToC is found as the extension finds it: a top-level list whose first item is a link to a heading (`[...](#...)`) and that is enough like the generated ToC. A list straight after `<!-- no toc -->` is skipped.
- A file with no ToC passes; there is nothing to keep up to date.
- The ToC lists every heading, at levels 1 to 6, except those marked `<!-- omit in toc -->` or `<!-- omit from toc -->` (on the line above, or at the end of the heading). Headings in fenced code, front matter and HTML comments are ignored, and setext headings (underlined with `===` or `---`) count.
- Entries are `- [text](#slug)`, indented two spaces a level under the shallowest heading in the ToC. Slugs are GitHub's, with `-1`, `-2` ... for duplicates.

## Usage

Add it alongside the other PR checks:

```yaml
jobs:
  docs-check:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6
      - uses: ConfiguredThings/markdown-toc-action@v1
```

## Fixing a ToC locally

Save the file in VS Code with Markdown All in One installed (it updates the ToC on save), or run the script, which needs only Node 24:

```sh
node check/index.js --fix README.md
```

Without `--fix` it checks, exiting with a non-zero status and printing `::error ...` lines, as in a workflow run. It reads its input the way GitHub Actions passes it, so this is the same as the action's default:

```sh
env INPUT_FILES=README.md node check/index.js
```

## Inputs

| Name    | Description                                                | Required | Default     |
|---------|------------------------------------------------------------|----------|-------------|
| `files` | The Markdown files to check, separated by spaces or new lines | No       | `README.md` |

```yaml
- uses: ConfiguredThings/markdown-toc-action@v1
  with:
    files: |
      README.md
      docs/UserManual.md
```

## How it matches the extension

The script follows the extension's own code (version 3.6.3, `toc.ts` and `slugify.ts`) with its default settings: `toc.levels` `1..6`, `toc.slugifyMode` `github`, `toc.unorderedList.marker` `-`, `toc.orderedList` `false`, `toc.plaintext` `false` and `list.indentationSize` `adaptive`. A repository that changes these, or uses `toc.omittedFromToc`, isn't supported.

Headings are parsed with [markdown-it](https://github.com/markdown-it/markdown-it) 14.3.2 in its `commonmark` mode, as the extension does. Its standalone build is in `check/vendor`, with its licence, so the action has nothing to install.
