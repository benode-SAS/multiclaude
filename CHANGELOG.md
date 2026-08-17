# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Until 1.0.0, minor versions may carry breaking changes; they are always listed here.

## [Unreleased]

## [0.1.0] — 2026-08-03

First public release.

### Added

- Real-time multi-user chat driving one `claude` CLI process per conversation, on your own
  subscription: streamed answers, tool actions, and a persistent session per room.
- Collaboration: live presence, follow someone's view, shared selections, typing indicator
  with draft preview, shared drafts, message queue with editing, turn interruption, and
  conversation forking.
- Permission policy decided per command, with its own test suite, an approval card any
  participant can answer, a chime, and system notifications.
- File panel with tree and list views, rendered markdown, code and sandboxed HTML preview,
  live refresh, paste and drag-and-drop upload, and markdown export.
- Repository cloning at room creation, including private repositories through a token or
  an SSH key.
- Local accounts with Better Auth, roles, admin panel, temporary passwords with a forced
  change, and an account CLI.
- Archiving instead of deleting, with restore and an explicit permanent delete.
- Update check against the latest GitHub release, disabled with `UPDATE_CHECK=false`.
- Deployment: single port, Docker image, PM2 configuration.

[Unreleased]: https://github.com/benode-SAS/multiclaude/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/benode-SAS/multiclaude/releases/tag/v0.1.0
