# AGENTS

React Native Nitro QRCode — native C++ QR code generation (PNG export, gradients) without react-native-svg or Skia.

## Workspace Map

- Monorepo layout: `packages/react-native-nitro-qrcode` (library), `apps/example` (Expo Router example).
- C++ core: `packages/react-native-nitro-qrcode/cpp` (`core/` generator, `bindings/` Nitro bridge, `qrcodegen/` vendored encoder).
- Native shell: `packages/react-native-nitro-qrcode/android`; iOS is wired through the podspec plus generated Nitrogen files.
- Expo config plugin: `packages/react-native-nitro-qrcode/app.plugin.js`.

## Tooling

- Package manager: `bun` / `bunx`. Bun workspaces are the only orchestration layer; root scripts delegate with `bun run --cwd ...` (no Turborepo).
- Root quality gate: `bun run check` (includes the device-free `example:smoke:ci` self-check). CI gate: `bun run check:ci` (adds C++ sanitizers). Release gate: `bun run release:preflight` (adds benchmark, package audit, dry-run publish, and `example:smoke` with per-platform terminal-state reporting).
- Example checks: `bun run example:check`; native builds via `example:android:assemble` / `example:ios:build` after `example:prebuild`.
- LLVM: CI pins LLVM 18; the C++ scripts prefer `clang++-18`/`llvm-profdata-18`/`llvm-cov-18` and fall back to unversioned tools.

## Universal Rules

- Keep behavior parity between `src/index.ts` (native) and `src/index.web.ts` (web). Shared option logic is split by domain with direct imports: `src/colors.ts` (colors/contrast), `src/scan-policy.ts` (scanability), `src/defaults.ts` (defaults/presets), `src/styles.ts` (styles), `src/validation.ts` (types, normalization, validation), `src/cache.ts` (bounded LRU), `src/metrics.ts` (dev metrics), `src/render-plan.ts` (platform-neutral render plan), and `src/use-qrcode-generation.ts` (component generation lifecycle). The `QRCode` component lives once in `src/qrcode-component.ts` (`createQRCodeComponent(generators)` — native passes the async object-ABI generator plus `accessibilityIgnoresInvertColors`; web passes the async banded generator). Do not duplicate logic per entrypoint; put platform divergences behind the generators argument. Do not create re-export barrels; import concrete modules directly.
- The native Nitro surface is object-typed: `GenerateOptions` methods (`generatePngBase64Object` and related) are the primary ABI; the positional methods remain for binary compatibility and are deprecated.
- Never manually edit `packages/react-native-nitro-qrcode/nitrogen/generated/**`; run `bun run codegen` when `src/*.nitro.ts` specs change and commit generated files. `codegen:check` is non-mutating (snapshot-and-restore).
- Add or update tests for behavior changes; C++ changes need `bun run test:cpp`, `bun run test:cpp:sanitize`, and `bun run benchmark:cpp` green. Encoder behavior changes must re-run `bun scripts/generate-parity-corpus.js` and keep the native/web parity corpus green (decode-back and golden C++ tests).
- For user-facing changes, update `README.md` and `CHANGELOG.md` (changes go under the current version header, no `Unreleased` section).
- `apps/example/ios` and `apps/example/android` are generated (gitignored); CI runs `CI=1 bun run --cwd apps/example prebuild -- --platform <android|ios>` before native builds.

## Native Code Rules

- Guard `static_cast<int>` from `NaN`/`Inf`/fractional inputs in C++ option parsing.
- Keep `cpp/qrcodegen` vendored sources unmodified; wrap changes in `core/`/`bindings/` instead. See `cpp/qrcodegen/README.nayuki.markdown` for the pinned upstream commit and synchronization policy.
- Cache ownership lives in `cpp/core/BoundedCache.hpp` (bounded LRU); the output cache keeps 128 entries/4 MiB and the matrix cache keeps 32 entries.
