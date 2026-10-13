const fs = require("fs");
const path = require("path");

function sharedIncludeArgs(rootDir) {
  const packageDir = path.join(rootDir, "packages", "react-native-nitro-qrcode");
  const cppDir = path.join(packageDir, "cpp");
  const reactCommon = path.join(rootDir, "node_modules", "react-native", "ReactCommon");
  return [
    path.join(packageDir, "nitrogen", "generated", "shared", "c++"),
    path.join(cppDir, "bindings"),
    path.join(cppDir, "core"),
    path.join(cppDir, "qrcodegen"),
    path.join(cppDir, "vendor", "fpng"),
    path.join(cppDir, "tests", "quirc"),
    reactCommon,
    path.join(reactCommon, "jsi"),
  ].map((dir) => `-I${dir}`);
}

function prepareNitroHeaders(rootDir, buildDir) {
  const includeRoot = path.join(buildDir, "headers");
  const nitroVirtualDir = path.join(includeRoot, "NitroModules");
  fs.mkdirSync(nitroVirtualDir, { recursive: true });
  const nitroDir = path.join(rootDir, "node_modules", "react-native-nitro-modules", "cpp");
  for (const subdir of ["core", "jsi", "platform", "templates", "threading", "utils"])
    for (const file of fs.readdirSync(path.join(nitroDir, subdir)))
      if (file.endsWith(".hpp"))
        fs.copyFileSync(path.join(nitroDir, subdir, file), path.join(nitroVirtualDir, file));

  const writeHeader = (name, source) =>
    fs.writeFileSync(path.join(nitroVirtualDir, name), source, "utf8");
  writeHeader("HybridObject.hpp", `#pragma once
  #include <cstddef>
  #include <memory>
  namespace margelo::nitro {
  class Prototype { public: template <typename... Args> void registerHybridMethod(const char*, Args...) {} };
  class HybridObject : public std::enable_shared_from_this<HybridObject> {
  public:
    explicit HybridObject(const char* = "") {}
    virtual ~HybridObject() = default;
    virtual void loadHybridMethods() {}
    virtual size_t getExternalMemorySize() noexcept { return 0; }
  protected:
    template <typename Fn> void registerHybrids(HybridObject*, Fn&& fn) { Prototype prototype; fn(prototype); }
    template <typename T> std::shared_ptr<T> shared_cast() { return std::dynamic_pointer_cast<T>(shared_from_this()); }
  };
  }
  `,
  );
  writeHeader("Promise.hpp", `#pragma once
  #include <future>
  #include <functional>
  #include <memory>
  #include <utility>
  namespace margelo::nitro {
  template <typename T> class Promise {
    std::future<T> future_;
  public:
    explicit Promise(std::future<T>&& future) : future_(std::move(future)) {}
    static std::shared_ptr<Promise<T>> async(std::function<T()>&& operation) { return std::make_shared<Promise<T>>(std::async(std::launch::async, std::move(operation))); }
    std::future<T> await() { return std::move(future_); }
  };
  }
  `,
  );
  writeHeader("ArrayBuffer.hpp", `#pragma once
  #include <cstdint>
  #include <cstring>
  #include <memory>
  #include <vector>
  namespace margelo::nitro {
  class ArrayBuffer {
    std::vector<uint8_t> data_;
  public:
    explicit ArrayBuffer(std::vector<uint8_t>&& data) : data_(std::move(data)) {}
    static std::shared_ptr<ArrayBuffer> copy(const uint8_t* data, size_t size) {
      return std::make_shared<ArrayBuffer>(std::vector<uint8_t>(data, data + size));
    }
    static std::shared_ptr<ArrayBuffer> copy(const std::vector<uint8_t>& data) {
      return std::make_shared<ArrayBuffer>(std::vector<uint8_t>(data));
    }
    static std::shared_ptr<ArrayBuffer> move(std::vector<uint8_t>&& data) {
      return std::make_shared<ArrayBuffer>(std::move(data));
    }
    uint8_t* data() { return data_.data(); }
    const uint8_t* data() const { return data_.data(); }
    size_t size() const { return data_.size(); }
    bool isOwner() const { return true; }
    size_t getExternalMemorySize() const { return data_.size(); }
  };
  }
  `,
  );
  writeHeader("JSIConverter+ArrayBuffer.hpp", `#pragma once
  #include "ArrayBuffer.hpp"
  #include "JSIConverter.hpp"
  #include <jsi/jsi.h>
  #include <memory>
  #include <vector>
  namespace margelo::nitro {
  using namespace facebook;
  template <>
  struct JSIConverter<std::shared_ptr<ArrayBuffer>> final {
    static inline std::shared_ptr<ArrayBuffer> fromJSI(jsi::Runtime&, const jsi::Value&) {
      return ArrayBuffer::move(std::vector<uint8_t>{});
    }
    static inline jsi::Value toJSI(jsi::Runtime&, const std::shared_ptr<ArrayBuffer>&) {
      return jsi::Value::undefined();
    }
    static inline bool canConvert(jsi::Runtime&, const jsi::Value&) {
      return false;
    }
  };
  }
  `,
  );
  const jsCallbackHeader = path.join(nitroVirtualDir, "JSCallback.hpp");
  if (fs.existsSync(jsCallbackHeader)) {
    const contents = fs.readFileSync(jsCallbackHeader, "utf8");
    if (!contents.includes("NitroLogger.hpp")) {
      fs.writeFileSync(
        jsCallbackHeader,
        `#include "NitroLogger.hpp"\n${contents}`,
      );
    }
  }
  return includeRoot;
}

module.exports = { prepareNitroHeaders, sharedIncludeArgs };
