import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach } from "@jest/globals";

const originalWorkxHome = process.env.WORKX_HOME;
let currentWorkxHome: string | undefined;

beforeEach(async () => {
  currentWorkxHome = await fs.mkdtemp(path.join(os.tmpdir(), "workx-sdk-test-"));
  process.env.WORKX_HOME = currentWorkxHome;
});

afterEach(async () => {
  const workxHomeToDelete = currentWorkxHome;
  currentWorkxHome = undefined;

  if (originalWorkxHome === undefined) {
    delete process.env.WORKX_HOME;
  } else {
    process.env.WORKX_HOME = originalWorkxHome;
  }

  if (workxHomeToDelete) {
    await fs.rm(workxHomeToDelete, { recursive: true, force: true });
  }
});
