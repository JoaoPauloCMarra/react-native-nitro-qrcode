cmake_minimum_required(VERSION 3.18.0)

project(NitroQRCode)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

set(SOURCES
  "../cpp/bindings/HybridQRCode.cpp"
  "../cpp/bindings/QRCodeBridgeOptions.cpp"
  "../cpp/core/QRCodeGenerator.cpp"
  "../cpp/qrcodegen/qrcodegen.cpp"
)

add_library(
  NitroQRCode
  SHARED
  ${SOURCES}
  "./src/main/cpp/JniOnLoad.cpp"
)

target_include_directories(
  NitroQRCode
  PRIVATE
  "../cpp/core"
  "../cpp/bindings"
  "../cpp/qrcodegen"
  "./src/main/cpp"
)

include("../nitrogen/generated/android/NitroQRCode+autolinking.cmake")

target_link_libraries(
  NitroQRCode
  android
  log
)
