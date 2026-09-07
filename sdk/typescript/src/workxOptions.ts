export type WorkxConfigValue = string | number | boolean | WorkxConfigValue[] | WorkxConfigObject;

export type WorkxConfigObject = { [key: string]: WorkxConfigValue };

export type WorkxOptions = {
  workxPathOverride?: string;
  baseUrl?: string;
  apiKey?: string;
  /**
   * Additional `--config key=value` overrides to pass to the Workx CLI.
   *
   * Provide a JSON object and the SDK will flatten it into dotted paths and
   * serialize values as TOML literals so they are compatible with the CLI's
   * `--config` parsing.
   */
  config?: WorkxConfigObject;
  /**
   * Raw `--config key=value` overrides to pass unchanged to the Workx CLI after
   * structured configuration and before SDK-managed or thread-specific overrides.
   */
  configOverrides?: string[];
  /**
   * Environment variables passed to the Workx CLI process. When provided, the SDK
   * will not inherit variables from `process.env`.
   */
  env?: Record<string, string>;
};
