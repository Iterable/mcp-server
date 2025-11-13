// Simplified mock for @t3-oss/env-core
export function createEnv({ server, runtimeEnv }) {
  const config = {};

  // Apply environment values or schema defaults
  for (const [key, schema] of Object.entries(server)) {
    const value = runtimeEnv[key] ?? schema.def?.defaultValue;
    if (value !== undefined) {
      config[key] = value;
    }
  }

  return config;
}
