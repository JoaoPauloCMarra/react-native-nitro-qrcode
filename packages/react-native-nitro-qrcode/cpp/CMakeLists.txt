cmake_minimum_required(VERSION 3.22.1)
project(QRCodeGeneratorTest)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CPP_ROOT "${CMAKE_CURRENT_SOURCE_DIR}")

add_library(QRCodeCore STATIC
  bindings/QRCodeBridgeOptions.cpp
  qrcodegen/qrcodegen.cpp
  vendor/fpng/fpng_unity.cpp
  core/QRCodeGenerator.cpp
)

target_include_directories(QRCodeCore PUBLIC
  "${CPP_ROOT}/bindings"
  "${CPP_ROOT}/core"
  "${CPP_ROOT}/qrcodegen"
  "${CPP_ROOT}/vendor/fpng"
)

find_package(ZLIB REQUIRED)
target_link_libraries(QRCodeCore PUBLIC ZLIB::ZLIB)

add_executable(QRCodeGeneratorTest
  core/QRCodeGeneratorTest.cpp
  core/parity-corpus.cpp
  tests/QRCodeBridgeOptionsTest.cpp
  tests/QRCodeScanTest.cpp
  tests/quirc/quirc.c
  tests/quirc/decode.c
  tests/quirc/identify.c
  tests/quirc/version_db.c
)

target_include_directories(QRCodeGeneratorTest PRIVATE
  "${CPP_ROOT}/tests/quirc"
)

target_link_libraries(QRCodeGeneratorTest PRIVATE QRCodeCore)

add_executable(QRCodeGeneratorBenchmark
  core/QRCodeGeneratorBenchmark.cpp
)

target_link_libraries(QRCodeGeneratorBenchmark PRIVATE QRCodeCore)
