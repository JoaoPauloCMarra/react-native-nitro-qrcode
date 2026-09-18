# Security Policy

## Supported Versions

Security updates are provided for the latest release of the `0.8.x` line.
Older `0.x` lines are not supported; upgrade to the latest release to receive
security fixes.

| Version | Supported |
| --- | --- |
| `0.8.x` (latest) | Yes |
| `0.7.x` and earlier | No |

## Vendored And Runtime Dependencies

- The native encoder (`cpp/qrcodegen`) is vendored from Project Nayuki's QR
  Code generator library (MIT license) at a pinned upstream commit. See
  `packages/react-native-nitro-qrcode/cpp/qrcodegen/README.nayuki.markdown`
  for the exact commit, checksums, and synchronization policy. Upstream
  security fixes are adopted by bumping the pinned commit through that policy.
- Native RGBA PNG export vendors `fpng` (Unlicense) at a pinned commit. See
  `packages/react-native-nitro-qrcode/cpp/vendor/fpng/README.md`. Indexed
  two-color PNGs still use zlib. Host C++ scan-back tests vendor `quirc`
  (ISC-style) under `cpp/tests/quirc` and do not ship in the native libraries.
- The web entry depends on the `qrcode` npm package, which is bundled only for
  web targets. Keep it current through normal dependency updates.
- The package itself renders user-provided QR payloads. Payloads are not
  executed or fetched; validate content at the application boundary when
  untrusted input is encoded.

## Reporting A Vulnerability

Open a private advisory on the GitHub repository:
https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode/security/advisories/new

Include the package version, the affected platform, a minimal reproduction,
and any relevant logs with secrets redacted. Reports are acknowledged within
five business days.
