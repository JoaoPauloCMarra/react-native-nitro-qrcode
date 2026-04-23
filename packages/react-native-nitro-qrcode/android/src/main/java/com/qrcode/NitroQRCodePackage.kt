package com.qrcode

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.margelo.nitro.JNIOnLoad
import com.margelo.nitro.com.qrcode.NitroQRCodeOnLoad
import java.util.HashMap

class NitroQRCodePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      moduleInfos
    }
  }

  companion object {
    init {
      JNIOnLoad.initializeNativeNitro()
      NitroQRCodeOnLoad.initializeNative()
    }
  }
}
