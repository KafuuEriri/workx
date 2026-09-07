import path from "node:path";

export function workxPathOverride() {
  return (
    process.env.WORKX_EXECUTABLE ??
    path.join(process.cwd(), "..", "..", "workx-rs", "target", "debug", "workx")
  );
}
