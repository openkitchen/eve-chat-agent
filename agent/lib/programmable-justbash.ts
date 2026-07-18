import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, posix } from "node:path";
import ExcelJS from "exceljs";
import type { Command, CommandContext, ReadWriteFs as ReadWriteFsType, Sandbox as SandboxType, SandboxCommand } from "just-bash";
import type { SandboxBackend, SandboxBackendHandle, SandboxBackendPrewarmInput, SandboxProcess, SandboxSession } from "eve/sandbox";

const require = createRequire(import.meta.url);
const { defineCommand, ReadWriteFs, Sandbox } = require("just-bash") as typeof import("just-bash");

const BACKEND_NAME = "programmable-just-bash-v1";
const WORKSPACE_ROOT = "/workspace";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const activeHandles = new Map<string, SandboxBackendHandle>();

type Runtime = {
  fs: ReadWriteFsType;
  rootPath: string;
  sandbox: SandboxType;
  sessionKey: string;
};

export function programmableJustbash(): SandboxBackend {
  return {
    name: BACKEND_NAME,
    prewarm,
    async create(input) {
      const existing = activeHandles.get(input.sessionKey);
      if (existing) return existing;

      const rootPath = sessionRoot(input.runtimeContext.appRoot, input.sessionKey);
      if (!(await exists(rootPath))) {
        await mkdir(dirname(rootPath), { recursive: true });
        if (input.templateKey) {
          const source = templateRoot(input.runtimeContext.appRoot, input.templateKey);
          if (!(await exists(source))) throw new Error(`Sandbox template ${input.templateKey} is unavailable.`);
          await cp(source, rootPath, { recursive: true });
        } else {
          await mkdir(rootPath, { recursive: true });
        }
      }
      const runtime = await createRuntime(rootPath, input.sessionKey);
      const handle = createHandle(runtime, () => activeHandles.delete(input.sessionKey));
      activeHandles.set(input.sessionKey, handle);
      return handle;
    },
  };
}

async function prewarm(input: SandboxBackendPrewarmInput): Promise<{ reused: boolean }> {
  const finalPath = templateRoot(input.runtimeContext.appRoot, input.templateKey);
  if (await exists(finalPath)) return { reused: true };
  const temporaryPath = `${finalPath}.tmp`;
  await rm(temporaryPath, { force: true, recursive: true });
  await mkdir(temporaryPath, { recursive: true });
  const runtime = await createRuntime(temporaryPath, input.templateKey);
  const session = createSession(runtime);
  try {
    if (input.bootstrap) await input.bootstrap({ use: async () => session });
    for (const seed of input.seedFiles) {
      await session.writeBinaryFile({ content: typeof seed.content === "string" ? encoder.encode(seed.content) : new Uint8Array(seed.content), path: seed.path });
    }
    await persistEnvironment(runtime);
    await mkdir(dirname(finalPath), { recursive: true });
    await rename(temporaryPath, finalPath);
    return { reused: false };
  } finally {
    await runtime.sandbox.stop();
    await rm(temporaryPath, { force: true, recursive: true });
  }
}

async function createRuntime(rootPath: string, sessionKey: string): Promise<Runtime> {
  const filesystemPath = join(rootPath, "fs");
  await mkdir(filesystemPath, { recursive: true });
  const fs = new ReadWriteFs({ allowSymlinks: false, maxFileReadSize: Number.MAX_SAFE_INTEGER, root: filesystemPath });
  await fs.mkdir(WORKSPACE_ROOT, { recursive: true });
  const sandbox = await Sandbox.create({
    cwd: WORKSPACE_ROOT,
    customCommands: [createXlsxCommand()],
    env: await readEnvironment(rootPath),
    fs,
  });
  return { fs, rootPath, sandbox, sessionKey };
}

function createHandle(runtime: Runtime, forget: () => void): SandboxBackendHandle {
  const session = createSession(runtime);
  return {
    session,
    useSessionFn: async () => session,
    async captureState() {
      await persistEnvironment(runtime);
      return { backendName: BACKEND_NAME, metadata: {}, sessionKey: runtime.sessionKey };
    },
    async shutdown() {
      forget();
      await runtime.sandbox.stop();
    },
  };
}

function createSession(runtime: Runtime): SandboxSession {
  const resolvePath = (path: string) => (path.startsWith("/") ? path : `${WORKSPACE_ROOT}/${path}`);
  return {
    id: runtime.sessionKey,
    resolvePath,
    async run(options) {
      const process = await spawn(runtime, options);
      const [stdout, stderr, result] = await Promise.all([readStream(process.stdout), readStream(process.stderr), process.wait()]);
      return { exitCode: result.exitCode, stderr, stdout };
    },
    async spawn(options) {
      return spawn(runtime, options);
    },
    async readFile({ path }) {
      try { return streamFromBytes(await runtime.fs.readFileBuffer(resolvePath(path))); } catch { return null; }
    },
    async readBinaryFile({ path }) {
      try { return await runtime.fs.readFileBuffer(resolvePath(path)); } catch { return null; }
    },
    async readTextFile({ path, encoding = "utf-8", startLine, endLine }) {
      try {
        const text = Buffer.from(await runtime.fs.readFileBuffer(resolvePath(path))).toString(encoding as BufferEncoding);
        if (startLine === undefined && endLine === undefined) return text;
        return text.split(/(?<=\n)/u).slice(Math.max((startLine ?? 1) - 1, 0), endLine).join("");
      } catch { return null; }
    },
    async writeFile({ content, path }) {
      await writeBytes(runtime.fs, resolvePath(path), await readStreamBytes(content));
    },
    async writeBinaryFile({ content, path }) {
      await writeBytes(runtime.fs, resolvePath(path), content);
    },
    async writeTextFile({ content, path, encoding = "utf-8" }) {
      await writeBytes(runtime.fs, resolvePath(path), Buffer.from(content, encoding as BufferEncoding));
    },
    async removePath({ force, path, recursive }) {
      await runtime.fs.rm(resolvePath(path), { force, recursive });
    },
    async setNetworkPolicy() {
      throw new Error("Network policy changes are not supported by the programmable just-bash backend.");
    },
  };
}

async function spawn(runtime: Runtime, options: Parameters<SandboxSession["spawn"]>[0]): Promise<SandboxProcess> {
  if (options.abortSignal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
  const command = await runtime.sandbox.runCommand({
    args: [options.workingDirectory ? `( cd ${shellQuote(options.workingDirectory)} && ${options.command} )` : options.command],
    cmd: "eval",
    detached: true,
    env: options.env,
    signal: options.abortSignal,
  }) as SandboxCommand;
  return adaptProcess(command);
}

function adaptProcess(command: SandboxCommand): SandboxProcess {
  const stdout = outputChannel();
  const stderr = outputChannel();
  const streamsDone = (async () => {
    try {
      for await (const item of command.logs()) (item.type === "stdout" ? stdout : stderr).enqueue(encoder.encode(item.data));
      stdout.close();
      stderr.close();
    } catch (error) {
      stdout.error(error);
      stderr.error(error);
      throw error;
    }
  })();
  streamsDone.catch(() => undefined);
  let wait: Promise<{ exitCode: number }> | undefined;
  let kill: Promise<void> | undefined;
  return {
    stdout: stdout.stream,
    stderr: stderr.stream,
    wait() {
      wait ??= Promise.resolve().then(async () => {
        const result = await command.wait();
        await streamsDone;
        return { exitCode: result.exitCode };
      });
      return wait;
    },
    kill() {
      kill ??= command.kill();
      return kill;
    },
  };
}

function outputChannel() {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  return {
    stream: new ReadableStream<Uint8Array>({ start(value) { controller = value; }, cancel() { cancelled = true; } }),
    enqueue(value: Uint8Array) { if (!cancelled) controller.enqueue(value); },
    close() { if (!cancelled) controller.close(); },
    error(error: unknown) { if (!cancelled) controller.error(error); },
  };
}

function createXlsxCommand(): Command {
  const command = defineCommand("xlsx", async (args, ctx) => {
    try { return { exitCode: 0, stderr: "", stdout: await runXlsx(args, ctx) }; }
    catch (error) { return { exitCode: 1, stderr: `${error instanceof Error ? error.message : String(error)}\n`, stdout: "" }; }
  });
  return { ...command, trusted: true };
}

async function runXlsx(args: string[], ctx: CommandContext): Promise<string> {
  if (args.length === 0 || args[0] === "--help" || args[0] === "help") return "Usage:\n  xlsx sheets <workbook.xlsx>\n  xlsx export <workbook.xlsx> --sheet <name> [--range A1:D100] --format json|csv\n";
  const [action, source, ...rest] = args;
  if (!source) throw new Error("Missing workbook path. Run xlsx --help.");
  const path = source.startsWith("/") ? source : ctx.fs.resolvePath(ctx.cwd, source);
  if (!path.startsWith(`${WORKSPACE_ROOT}/`) || !path.toLowerCase().endsWith(".xlsx")) throw new Error("xlsx accepts only .xlsx files inside /workspace.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await ctx.fs.readFileBuffer(path)) as never);
  if (action === "sheets") {
    if (rest.length) throw new Error("xlsx sheets does not accept options.");
    return `${JSON.stringify(workbook.worksheets.map((sheet) => ({ name: sheet.name, rowCount: sheet.actualRowCount, columnCount: sheet.actualColumnCount })), null, 2)}\n`;
  }
  if (action !== "export") throw new Error(`Unknown xlsx action: ${action}. Run xlsx --help.`);
  const options = parseOptions(rest);
  const sheetName = options.get("sheet");
  const format = options.get("format");
  if (!sheetName || !format) throw new Error("xlsx export requires --sheet and --format.");
  if (format !== "json" && format !== "csv") throw new Error("xlsx export --format must be json or csv.");
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Worksheet not found: ${sheetName}.`);
  const rows = readRows(sheet, parseRange(options.get("range") ?? sheet.dimensions.range));
  return format === "json" ? `${JSON.stringify(rows, null, 2)}\n` : rowsToCsv(rows);
}

function parseOptions(args: string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || !value || !["--sheet", "--range", "--format"].includes(name)) throw new Error("Usage: xlsx export <workbook.xlsx> --sheet <name> [--range A1:D100] --format json|csv");
    const key = name.slice(2);
    if (options.has(key)) throw new Error(`Duplicate option: ${name}.`);
    options.set(key, value);
  }
  return options;
}

type Bounds = { bottom: number; left: number; right: number; top: number };

function parseRange(range: string): Bounds {
  const match = /^([A-Za-z]+)([1-9]\d*):([A-Za-z]+)([1-9]\d*)$/u.exec(range);
  if (!match) throw new Error(`Invalid A1 range: ${range}.`);
  const [, startColumn, startRow, endColumn, endRow] = match;
  const left = columnNumber(startColumn!);
  const right = columnNumber(endColumn!);
  const top = Number(startRow);
  const bottom = Number(endRow);
  if (left > right || top > bottom) throw new Error(`Invalid A1 range: ${range}.`);
  return { bottom, left, right, top };
}

function columnNumber(value: string): number {
  return [...value.toUpperCase()].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0);
}

function readRows(sheet: ExcelJS.Worksheet, bounds: Bounds): Array<Record<string, string | number | boolean | null>> {
  const names = new Map<string, number>();
  const headers = Array.from({ length: bounds.right - bounds.left + 1 }, (_, offset) => {
    const base = sheet.getCell(bounds.top, bounds.left + offset).text.trim() || `column_${offset + 1}`;
    const count = (names.get(base) ?? 0) + 1;
    names.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
  const rows: Array<Record<string, string | number | boolean | null>> = [];
  for (let rowNumber = bounds.top + 1; rowNumber <= bounds.bottom; rowNumber += 1) {
    const row = Object.fromEntries(headers.map((header, offset) => [header, normalizeCell(sheet.getCell(rowNumber, bounds.left + offset).value)]));
    if (Object.values(row).some((value) => value !== null)) rows.push(row);
  }
  return rows;
}

function normalizeCell(value: ExcelJS.CellValue): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object" && "result" in value && value.result !== undefined) return normalizeCell(value.result as ExcelJS.CellValue);
  return String(value);
}

function rowsToCsv(rows: Array<Record<string, string | number | boolean | null>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  return `${[headers, ...rows.map((row) => headers.map((header) => row[header]))].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> { return decoder.decode(await readStreamBytes(stream)); }

async function readStreamBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      length += value.byteLength;
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

function streamFromBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
}

async function writeBytes(fs: ReadWriteFsType, path: string, content: Uint8Array): Promise<void> {
  await fs.mkdir(posix.dirname(path), { recursive: true });
  await fs.writeFile(path, content);
}

async function persistEnvironment(runtime: Runtime): Promise<void> {
  await writeFile(join(runtime.rootPath, "metadata.json"), `${JSON.stringify({ env: runtime.sandbox.bashEnvInstance.getEnv(), version: 1 }, null, 2)}\n`);
}

async function readEnvironment(rootPath: string): Promise<Record<string, string> | undefined> {
  try {
    const metadata = JSON.parse(await readFile(join(rootPath, "metadata.json"), "utf8")) as { env?: Record<string, string>; version?: number };
    return metadata.version === 1 ? metadata.env : undefined;
  } catch { return undefined; }
}

function sessionRoot(appRoot: string, sessionKey: string): string { return join(appRoot, ".eve", "sandbox-cache", "programmable-just-bash", "sessions", hash(sessionKey)); }
function templateRoot(appRoot: string, templateKey: string): string { return join(appRoot, ".eve", "sandbox-cache", "programmable-just-bash", "templates", hash(templateKey)); }
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
async function exists(path: string): Promise<boolean> { try { await stat(path); return true; } catch { return false; } }
function shellQuote(value: string): string { return `'${value.replaceAll("'", "'\\''")}'`; }
