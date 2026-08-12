QR Code generator library - C++
===============================


Introduction
------------

This project aims to be the best, clearest QR Code generator library. The primary goals are flexible options and absolute correctness. Secondary goals are compact implementation size and good documentation comments.

Home page with live JavaScript demo, extensive descriptions, and competitor comparisons: https://www.nayuki.io/page/qr-code-generator-library


Vendored Provenance
-------------------

The `qrcodegen.hpp` and `qrcodegen.cpp` files in this directory are vendored
from Project Nayuki's QR Code generator library, upstream repository
`nayuki/QR-Code-generator`:

- Pinned upstream commit: `8329a7108fc22be3e1eec0a9f9318978579e3621`
  (2024-09-01, "Slightly simplified the calculation of alignment pattern
  spacing in a non-obvious way in C, C++, and Rust versions.")
- SHA-256 of `qrcodegen.hpp`: `b779c3b156cf7a57ce789d6fee4fc991ccc2913774d26c909d22bb8f26b2a793`
- SHA-256 of `qrcodegen.cpp`: `8948b57053deb5d132bfc675ca2688b7abef9f03ec633c0de59770c945a66fc9`
- License: MIT (see the license header in `qrcodegen.hpp`).

Synchronization policy:

- These files are copied verbatim from upstream; never edit them in place.
- To update, diff the local files against the upstream commit above, apply the
  same changes in the package's own `cpp/core` and `cpp/bindings` code where
  needed, then bump the pinned commit and both checksums in this section.
- Upstream changes that alter encoder output (segmentation, mask selection,
  error correction) must re-run `scripts/generate-parity-corpus.js` and the
  native/web parity corpus tests before the update is accepted.


Features
--------

Core features:

* Significantly shorter code but more documentation comments compared to competing libraries
* Supports encoding all 40 versions (sizes) and all 4 error correction levels, as per the QR Code Model 2 standard
* Output format: Raw modules/pixels of the QR symbol
* Detects finder-like penalty patterns more accurately than other implementations
* Encodes numeric and special-alphanumeric text in less space than general text
* Coded carefully to prevent memory corruption, integer overflow, platform-dependent inconsistencies, and undefined behavior; tested rigorously to confirm safety
* Open-source code under the permissive MIT License

Manual parameters:

* User can specify minimum and maximum version numbers allowed, then library will automatically choose smallest version in the range that fits the data
* User can specify mask pattern manually, otherwise library will automatically evaluate all 8 masks and select the optimal one
* User can specify absolute error correction level, or allow the library to boost it if it doesn't increase the version number
* User can create a list of data segments manually and add ECI segments

More information about QR Code technology and this library's design can be found on the project home page.


Examples
--------

```c++
#include <string>
#include <vector>
#include "QrCode.hpp"
using namespace qrcodegen;

// Simple operation
QrCode qr0 = QrCode::encodeText("Hello, world!", QrCode::Ecc::MEDIUM);
std::string svg = toSvgString(qr0, 4);  // See QrCodeGeneratorDemo

// Manual operation
std::vector<QrSegment> segs =
    QrSegment::makeSegments("3141592653589793238462643383");
QrCode qr1 = QrCode::encodeSegments(
    segs, QrCode::Ecc::HIGH, 5, 5, 2, false);
for (int y = 0; y < qr1.getSize(); y++) {
    for (int x = 0; x < qr1.getSize(); x++) {
        (... paint qr1.getModule(x, y) ...)
    }
}
```

More complete set of examples: https://github.com/nayuki/QR-Code-generator/blob/master/cpp/QrCodeGeneratorDemo.cpp .
