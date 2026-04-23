#include <fbjni/fbjni.h>
#include <jni.h>

#include "../../../nitrogen/generated/android/NitroQRCodeOnLoad.hpp"

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::NitroQRCode::registerAllNatives();
  });
}
