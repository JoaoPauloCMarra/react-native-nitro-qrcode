cmake_minimum_required(VERSION 3.18.0)

project(NitroQRCode)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

# 1. Define source files (Manual implementation)
file(GLOB SOURCES
  "../cpp/bindings/*.cpp"
  "../cpp/core/*.cpp"
  "../cpp/qrcodegen/*.cpp"
)

# 2. Create the library target
add_library(
  NitroQRCode
  SHARED
  ${SOURCES}
  "./src/main/cpp/JniOnLoad.cpp"
)

# 3. Include directories for manual sources
target_include_directories(
  NitroQRCode
  PRIVATE
  "../cpp/core"
  "../cpp/bindings"
  "../cpp/qrcodegen"
  "./src/main/cpp"
)

# 4. Include Nitrogen Autolinking (adds generated sources, finding packages, linking libs)
include("../nitrogen/generated/android/NitroQRCode+autolinking.cmake")

# 5. Link standard Android libraries
target_link_libraries(
  NitroQRCode
  android
  log
)
