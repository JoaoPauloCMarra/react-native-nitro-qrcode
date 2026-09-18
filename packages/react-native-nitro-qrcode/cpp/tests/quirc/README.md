# quirc

Host-only QR decoder used by C++ scan-back tests. These sources are not
linked into the published iOS or Android libraries.

Vendored from [dlbeer/quirc](https://github.com/dlbeer/quirc):

- Pinned upstream commit: `927d680904dc95fdff4cd9d022eb374b438ff8f2`
- License: ISC-style (see `quirc.h`)
- Synchronization policy: copy `lib/quirc.c`, `lib/quirc.h`,
  `lib/quirc_internal.h`, `lib/decode.c`, `lib/identify.c`, and
  `lib/version_db.c` verbatim.

`zxing-cpp` was measured as too large to vendor for this check. `quirc`
decoded a real Nayuki matrix in the host bake-off.
