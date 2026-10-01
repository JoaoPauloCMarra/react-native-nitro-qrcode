#pragma once

#include <algorithm>
#include <deque>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>
#include <utility>

namespace NitroQRCode {

template <typename Value> struct BoundedCacheEntry {
  std::string request;
  Value value;
  size_t bytes = 0;
};

// Thread-safe bounded LRU cache keyed by a hashed cache key with full-request
// verification. The caller owns key generation and byte accounting policy;
// this type owns eviction order and capacity limits.
template <typename Value> class BoundedCache {
public:
  explicit BoundedCache(size_t maxEntries, size_t maxBytes)
      : maxEntries_(maxEntries), maxBytes_(maxBytes) {}

  std::optional<Value> get(const std::string &key,
                           const std::string &request) {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto cached = entries_.find(key);
    if (cached == entries_.end() || cached->second.request != request) {
      return std::nullopt;
    }
    touch(key);
    return cached->second.value;
  }

  void store(const std::string &key, const std::string &request,
             const Value &value, size_t bytes) {
    if (bytes > maxBytes_) {
      return;
    }
    BoundedCacheEntry<Value> entry{request, value, bytes};
    std::lock_guard<std::mutex> lock(mutex_);
    const auto existing = entries_.find(key);
    if (existing == entries_.end()) {
      order_.push_back(key);
      try {
        entries_.emplace(key, std::move(entry));
      } catch (...) {
        order_.pop_back();
        throw;
      }
    } else {
      bytes_ -= existing->second.bytes;
      existing->second = std::move(entry);
      touch(key);
    }
    bytes_ += bytes;
    while (!order_.empty() &&
           (order_.size() > maxEntries_ || bytes_ > maxBytes_)) {
      const auto oldest = entries_.find(order_.front());
      if (oldest != entries_.end()) {
        bytes_ -= oldest->second.bytes;
        entries_.erase(oldest);
      }
      order_.pop_front();
    }
  }

  void clear() {
    std::lock_guard<std::mutex> lock(mutex_);
    entries_.clear();
    order_.clear();
    bytes_ = 0;
  }

  size_t size() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return entries_.size();
  }

  size_t bytes() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return bytes_;
  }

private:
  void touch(const std::string &key) {
    const auto order = std::find(order_.begin(), order_.end(), key);
    if (order != order_.end()) {
      std::rotate(order, order + 1, order_.end());
    }
  }

  size_t maxEntries_;
  size_t maxBytes_;
  mutable std::mutex mutex_;
  std::unordered_map<std::string, BoundedCacheEntry<Value>> entries_;
  std::deque<std::string> order_;
  size_t bytes_ = 0;
};

} // namespace NitroQRCode
