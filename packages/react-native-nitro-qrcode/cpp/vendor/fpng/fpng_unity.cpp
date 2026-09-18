#if defined(__clang__)
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Weverything"
#if defined(__i386__) || defined(__x86_64__)
#pragma clang attribute push(                                                 \
    __attribute__((target("sse4.1,pclmul"))), apply_to = function)
#endif
#elif defined(__GNUC__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wall"
#pragma GCC diagnostic ignored "-Wextra"
#if defined(__i386__) || defined(__x86_64__)
#pragma GCC target("sse4.1,pclmul")
#endif
#endif

#include "fpng.cpp"

#if defined(__clang__)
#if defined(__i386__) || defined(__x86_64__)
#pragma clang attribute pop
#endif
#pragma clang diagnostic pop
#elif defined(__GNUC__)
#pragma GCC diagnostic pop
#endif
