// Reads managed-settings.json. It sends no telemetry.
import type { Rule } from "../scripts/verify";
import { read } from "./lib";

type Managed = { allowManagedHooksOnly?: boolean; env?: Record<string, string> };

function managed(folder: string): Managed {
  try {
    return JSON.parse(read(folder, "managed", "managed-settings.json"));
  } catch {
    return {};
  }
}
const env = (folder: string) => managed(folder).env ?? {};

export default [
  {
    says: "telemetry is switched on",
    test: (folder) => env(folder).CLAUDE_CODE_ENABLE_TELEMETRY === "1",
    tryNext: "set CLAUDE_CODE_ENABLE_TELEMETRY to 1 in the env block",
  },
  {
    says: "metrics and logs go out over OTLP",
    test: (folder) => env(folder).OTEL_METRICS_EXPORTER === "otlp" && env(folder).OTEL_LOGS_EXPORTER === "otlp",
    tryNext: "set OTEL_METRICS_EXPORTER and OTEL_LOGS_EXPORTER to otlp",
  },
  {
    says: "the protocol is grpc or http/protobuf",
    test: (folder) => ["grpc", "http/protobuf"].includes(env(folder).OTEL_EXPORTER_OTLP_PROTOCOL),
    tryNext: "set OTEL_EXPORTER_OTLP_PROTOCOL to grpc",
  },
  {
    says: "the endpoint is https and not on this machine",
    test: (folder) => {
      const endpoint = env(folder).OTEL_EXPORTER_OTLP_ENDPOINT ?? "";
      return /^https:\/\//.test(endpoint) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(endpoint);
    },
    tryNext: "point OTEL_EXPORTER_OTLP_ENDPOINT at the team collector over https",
  },
  {
    says: "what people type is not exported, and the file holds no token",
    test: (folder) => {
      const text = read(folder, "managed", "managed-settings.json");
      const promptsOff = env(folder).OTEL_LOG_USER_PROMPTS !== "1";
      return promptsOff && !/HEADERS|authorization|bearer|token/i.test(text);
    },
    tryNext: "set OTEL_LOG_USER_PROMPTS to 0 and remove any header with a token",
  },
  {
    says: "managed hooks only is still on",
    test: (folder) => managed(folder).allowManagedHooksOnly === true,
    tryNext: "keep allowManagedHooksOnly true; adding an env block must not drop it",
  },
] satisfies Rule[];
