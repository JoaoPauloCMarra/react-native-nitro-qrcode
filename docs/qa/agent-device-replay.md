# Maintained QR Code device replays

The example has five maintained `agent-device test` flows. Source freshness and runner tests are device-free checks. They do not build, install, launch, or replay the app.

## Run after runtime testing is authorized

Install a current example build on a dedicated QA target first. Use the exact simulator UDID or Android serial. The runner does not start Metro, prebuild, or install anything.

```sh
bun run example:replay -- --platform android --serial <serial>
bun run example:replay -- --platform ios --udid <simulator-udid>
bun run example:replay -- --platform ios --udid <simulator-udid> --flow image-swap
bun run example:e2e:ios-device -- <physical-iphone-udid>
bun run example:e2e:ios-device -- <physical-iphone-udid> scanability
```

Repeat `--flow` to select several flow IDs. With no selection, all five run. The physical-iPhone wrapper accepts a manifest flow ID, not an arbitrary script or deep link. It delivers each validated QR lab URL through CoreDevice, waits 2 s for the route to settle, then attaches agent-device without relaunching the routed app. An empty or unsupported flow fails before launch.

Each invocation gets a unique session and OS temporary artifact directory. Videos and screenshots are retained there; physical-iPhone flows get separate subdirectories so reports do not overwrite each other. `OUTPUT_DIR` points at that flow's artifacts. Every flow ends with `close`, and `agent-device test` closes each attempt session itself, including after a failure. A failed launch stops before replay. No retries are used, so the first failure stays visible.

## Assertions and evidence limits

| Flow | Assertions |
| --- | --- |
| `full-features` | PNG signatures, SVG and matrix shapes, sync and async exports, ref export, cache clear, metrics reset, version/ECL bounds, invalid-input recovery and forty successful requests. |
| `render-stress` | Fifteen generation callbacks, explicit remount generation, and fifteen callbacks after remount. This is not image decoding or a performance benchmark. |
| `image-swap` | Twelve generated values, final loaded-image label, zero reported errors, and a localized accessibility label. Inspect the recording for blank or faded frames. |
| `scanability` | Twenty-five cases, snapshots, strict white-gradient rejection, dark-gradient acceptance with unused white foreground, and recovery. Expected failures must match public validation errors. |
| `deeplink` | Installed app routes directly to the QR lab. |

[e2e/qrcode-replay-coverage.json](../../e2e/qrcode-replay-coverage.json) maps each assertion to source and replay text. Its pending rows require independent scanner decode, frame review, a controlled native image-loader failure fixture, VoiceOver/TalkBack, browser canvas checks, and device performance measurements. They are not passing replay results. PNG signatures and generation callbacks do not prove camera scanning. Unit tests exercise decode-error callbacks and stale-event guards with mocked Image events; that is not native decoder evidence.

For scanner checks, compare every valid scanability case against its exact payload in [e2e-scanability.tsx](../../apps/example/app/e2e-scanability.tsx), including Unicode, transparency/backdrop, gradients and recovery. Record target, OS, build, route, scanner, lighting, distance, observed payload, artifact location, and any pending item. A successful replay report covers only its declared assertions.

## Keep flows current

When library runtime code, bindings, wiring, package metadata, or any example source/asset changes, review the relevant coverage rows and flows first. Update assertions or pending prerequisites, then refresh the source lock:

```sh
bun run example:replay:refresh
bun run example:replay:check
bun run example:replay:test
```

Commit the source, flow/manifest edits, and refreshed lock together. A refresh records reviewed source; it does not certify a device run. The gate fails for source drift, missing source assertions/selectors, missing flow waits, unsafe paths, or missing final cleanup. Generated example Android/iOS projects, unit tests, build caches and secrets are excluded from the runtime digest. Run the changed flows on both platforms only when the device phase is authorized.
