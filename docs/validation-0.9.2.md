# 0.9.2 build validation

Version 0.9.2 fixes the clean Community builder environment: the standard plugin build now uses only Node.js. The optional receiver build still needs macOS/Xcode; manual archive packaging uses Python separately.

- A normal clean dependency installation and strict local verification pass.
- `npm run build` passes with a restricted PATH containing only Node and the platform shell, without Python.
- The Node license generator preserves exactly the same notices for all 14 bundled packages.
- `main.js` has SHA-256 `1dd29803aab069d56ed0166ba17a360a7d57ef5a0a8680fe28e4e64376c4df30`, identical to the runtime validated in the separate real Obsidian vault for 0.9.1. This build-only repair does not claim a new provider-drag test.
- The 56 tests, strict official lint, TypeScript and native checks pass. The isolated application evidence and screenshots are in [0.9.1 validation](validation-0.9.1.md).

The official 0.9.1 source preview had completed without source findings; its later full release review exposed the missing Python dependency. Source preview and full release/build review must be recorded separately. Check the Community dashboard and GitHub Releases for current server review and publication state.
