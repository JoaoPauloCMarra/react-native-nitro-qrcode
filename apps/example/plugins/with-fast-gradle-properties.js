const { withGradleProperties } = require("expo/config-plugins");

const FAST_PROPERTIES = {
  "org.gradle.caching": "true",
  "org.gradle.jvmargs": "-Xmx6g -XX:MaxMetaspaceSize=1g -XX:+UseParallelGC",
};

function withFastGradleProperties(config) {
  return withGradleProperties(config, (modConfig) => {
    const entries = modConfig.modResults;
    for (const [key, value] of Object.entries(FAST_PROPERTIES)) {
      const existing = entries.find(
        (entry) => entry.type === "property" && entry.key === key,
      );
      if (existing) {
        existing.value = value;
      } else {
        entries.push({ type: "property", key, value });
      }
    }
    return modConfig;
  });
}

module.exports = withFastGradleProperties;
