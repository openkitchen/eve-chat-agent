import { defineSandbox, type SandboxSession } from "eve/sandbox";
import { microsandbox } from "eve/sandbox/microsandbox";

export default defineSandbox({
  backend: microsandbox({
    cpus: 1,
    env: {
      HOME: "/home/vercel-sandbox",
      PATH: "/home/vercel-sandbox/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    },
    memoryMiB: 1024,
    networkPolicy: "deny-all",
    setup: { autoInstall: false },
  }),
  revalidationKey: () => "poc-python-analysis-v4",
  async bootstrap({ use }) {
    const sandbox = await use();
    await runChecked(sandbox, "mkdir -p /workspace/analysis");
    await runChecked(
      sandbox,
      "python3 -c 'import csv, sqlite3; print(sqlite3.sqlite_version)'",
    );
  },
});

async function runChecked(
  sandbox: SandboxSession,
  command: string,
): Promise<void> {
  const result = await sandbox.run({ command });
  if (result.exitCode !== 0) {
    throw new Error(`Sandbox bootstrap failed: ${result.stderr || result.stdout}`);
  }
}
