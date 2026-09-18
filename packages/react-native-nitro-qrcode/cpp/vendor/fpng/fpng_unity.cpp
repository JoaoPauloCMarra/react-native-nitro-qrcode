#if defined(__clang__)
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Weverything"
#elif defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wall"
#pragma GCC diagnostic ignored "-Wextra"
#endif

// clang 18 on the baseline x86-64 ABI rejects fpng's SSE4.1+pclmul
// always_inline helpers unless every translation unit is compiled with
// those features. Keep the documented scalar fallback for host tests and
// published ARM builds.
#ifndef FPNG_NO_SSE
#define FPNG_NO_SSE 1
#endif

#include "fpng.cpp"

#if defined(__clang__)
#pragma clang diagnostic pop
#elif defined(__GNUC__)
#pragma GCC diagnostic pop
#endif
