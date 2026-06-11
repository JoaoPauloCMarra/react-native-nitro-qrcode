# AGENTS

React Native Nitro QRCode — native C++ QR code generation (PNG export, gradients) without react-native-svg or Skia.

## Workspace Map

- Monorepo layout: `packages/react-native-nitro-qrcode` (library), `apps/example` (Expo Router example).
- C++ core: `packages/react-native-nitro-qrcode/cpp` (`core/` generator, `bindings/` Nitro bridge, `qrcodegen/` vendored encoder).
- Native shell: `packages/react-native-nitro-qrcode/android`; iOS is wired through the podspec plus generated Nitrogen files.
- Expo config plugin: `packages/react-native-nitro-qrcode/app.plugin.js`.

## Tooling

- Package manager: `bun` / `bunx`. Bun workspaces are the only orchestration layer; root scripts delegate with `bun run --cwd ...` (no Turborepo).
- Root quality gate: `bun run check`. CI gate: `bun run check:ci` (adds C++ sanitizers). Release gate: `bun run release:preflight`.
- Example checks: `bun run example:check`; native builds via `example:android:assemble` / `example:ios:build` after `example:prebuild`.

## Universal Rules

- Keep behavior parity between `src/index.ts` (native) and `src/index.web.ts` (web). Shared validation/option logic lives in `src/shared.ts`, and the `QRCode` component lives once in `src/qrcode-component.ts` (`createQRCodeComponent(generators)` — native passes the async generator plus `accessibilityIgnoresInvertColors`; web passes the sync generators). Do not duplicate logic per entrypoint; put platform divergences behind the generators argument.
- Never manually edit `packages/react-native-nitro-qrcode/nitrogen/generated/**`; run `bun run codegen` when `src/*.nitro.ts` specs change and commit generated files.
- Add or update tests for behavior changes; C++ changes need `bun run test:cpp`, `bun run test:cpp:sanitize`, and `bun run benchmark:cpp` green.
- For user-facing changes, update `README.md` and `CHANGELOG.md` (changes go under the current version header, no `Unreleased` section).
- `apps/example/ios` and `apps/example/android` are generated (gitignored); CI runs `CI=1 bun run --cwd apps/example prebuild -- --platform <android|ios>` before native builds.

## Native Code Rules

- Guard `static_cast<int>` from `NaN`/`Inf`/fractional inputs in C++ option parsing.
- Keep `cpp/qrcodegen` vendored sources unmodified; wrap changes in `core/`/`bindings/` instead.
