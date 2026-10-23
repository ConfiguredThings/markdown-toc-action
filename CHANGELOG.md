# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v2] - 2026-10-23
### Changed
- With no `files` input, the action checks the README in the root of the repository whatever the case of its name (`README.md`, `ReadMe.md`, ...), and passes if there isn't one. Previously the default was `README.md`, which failed with `File not found` in a repository whose README is `ReadMe.md` or that has none. A file listed in `files` must still exist.

## [v1] - 2026-10-23
### Added
- The action, which checks that the table of contents of Markdown files (by default `README.md`) is the one the VS Code extension Markdown All in One generates on save, and fails with the expected ToC in the log if it isn't.
- `check/index.js --fix`, to update a ToC locally.
- `.github/workflows/ci.yml`, which runs the tests, checks this repo's README and validates the changelog; and `.github/workflows/release.yml`, which creates a GitHub release from the changelog when a `v*` tag is pushed.


[Unreleased]: https://github.com/ConfiguredThings/markdown-toc-action/compare/v2...HEAD
[v2]: https://github.com/ConfiguredThings/markdown-toc-action/compare/v1...v2
[v1]: https://github.com/ConfiguredThings/markdown-toc-action/releases/tag/v1
