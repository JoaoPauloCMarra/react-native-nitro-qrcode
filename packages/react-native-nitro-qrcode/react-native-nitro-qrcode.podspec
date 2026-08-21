require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-nitro-qrcode"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "16.4" }
  s.source       = { :git => "https://github.com/JoaoPauloCMarra/react-native-nitro-qrcode.git", :tag => "v#{s.version}" }
  s.module_name  = "NitroQRCode"

  s.source_files = [
    "ios/**/*.{h,m,mm,swift}",
    "cpp/bindings/*.{h,hpp,c,cpp}",
    "cpp/core/BoundedCache.hpp",
    "cpp/core/QRCodeGenerator.{h,hpp,c,cpp}",
    "cpp/qrcodegen/*.{h,hpp,c,cpp}"
  ]

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "CLANG_CXX_LIBRARY" => "libc++",
    "DEFINES_MODULE" => "YES",
    "HEADER_SEARCH_PATHS" => [
      "\"$(PODS_TARGET_SRCROOT)/cpp/core\"",
      "\"$(PODS_TARGET_SRCROOT)/cpp/bindings\"",
      "\"$(PODS_TARGET_SRCROOT)/cpp/qrcodegen\"",
      "\"$(PODS_TARGET_SRCROOT)/nitrogen/generated/shared/c++\"",
      "\"$(PODS_TARGET_SRCROOT)/nitrogen/generated/ios\""
    ].join(" ")
  }

  s.dependency "React-Core"
  s.library = "z"
  
  load 'nitrogen/generated/ios/NitroQRCode+autolinking.rb'
  add_nitrogen_files(s)
end
