// Generated from the shared native/web encoder parity corpus.
// See scripts/generate-parity-corpus.js for the corpus contract.
#pragma once
#include <string>
#include <vector>
namespace NitroQRCode {
struct ParityCorpusEntry {
  const char* value;
  const char* errorCorrectionLevel;
  int minVersion;
  int maxVersion;
  int mask;
  bool boostEcl;
  int size;
  const char* packedBase64;
};
const std::vector<ParityCorpusEntry>& parityCorpus();
} // namespace NitroQRCode
