import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { setup } from "microsandbox";

const expectedVersion = "0.6.6";
const baseDir = process.env.MSB_HOME?.trim() || join(homedir(), ".microsandbox");

const installer = setup().baseDir(baseDir).version(expectedVersion);
await installer.install();

const binary = process.env.MSB_PATH?.trim() || join(baseDir, "bin", "msb");
const result = spawnSync(binary, ["--version"], { encoding: "utf8" });
const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();

if (result.status !== 0 || !output.includes(expectedVersion)) {
  throw new Error(
    `Expected microsandbox runtime ${expectedVersion} at ${binary}, but got: ${output || "no version output"}`,
  );
}

console.log(`microsandbox runtime ready: ${output.split("\n")[0]}`);
