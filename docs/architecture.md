# Current Architecture

## Scope

This is a self-hosted Eve chat agent. It provides a browser chat UI, durable Eve sessions, an OpenAI-compatible model provider, local tracing through Phoenix, and a lightweight local sandbox for uploaded files.

## Runtime topology

```text
Browser
  -> Next.js chat UI (`useEveAgent`)
  -> Eve HTTP channel (`/eve/v1/session*`)
  -> Eve durable session and default harness
      -> OpenAI-compatible API (`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`)
      -> built-in tools and authored tools
      -> just-bash virtual sandbox
  -> OpenTelemetry exporter
  -> Phoenix (`http://127.0.0.1:6006`)
```

The browser and Eve routes are served by the same local Next.js application. The default Eve channel accepts local development requests. It intentionally uses `placeholderAuth()` outside local development; replace it with the host application's user authentication before exposing the agent to end users.

## Agent definition

- `agent/agent.ts` creates the OpenAI-compatible provider. `OPENAI_API_MODE` selects `responses` or `chat`; `OPENAI_MODEL` selects the provider model.
- `agent/instructions.md` is the root instruction set for every model step in this agent.
- `agent/tools/` contains typed tools that run in the application runtime. They must expose narrowly scoped operations, not arbitrary shell or filesystem access.
- `agent/instrumentation.ts` configures OpenTelemetry export when `PHOENIX_ENABLED=true`.

## Session behavior

Eve creates a durable session from the first message and returns a `continuationToken`. Follow-up messages reuse it. The React hook currently owns that cursor in browser memory, so a page reload starts a new Eve session. Session lifecycle and retention should be owned by the eventual host application, which should map its thread ID to Eve's session identity and apply its own expiry policy.

## Sandbox and uploads

`agent/sandbox.ts` pins the sandbox to the local `programmable-just-bash` backend.

- It is a pure-JavaScript Bash interpreter with no VM, Docker daemon, or `msb` process.
- Its filesystem is virtual and persisted locally below `.eve/sandbox-cache/programmable-just-bash/`; it is not an arbitrary host-directory shell.
- It runs a simulated shell command set such as Bash, awk, jq, sqlite3, and CSV utilities. It additionally provides an `xlsx` virtual command backed by the app's ExcelJS dependency. It cannot execute host binaries such as `node`, `git`, or package managers.
- Network policy and credential brokering are not available on this backend.

The standard `bash`, `read_file`, `write_file`, and `grep` tools are available to the root agent. The restricted `glob` wrapper remains in place for the deterministic attachment tool flow. `docs/design/programmable-justbash.md` records the custom backend's command contract and lifecycle requirements.

The chat UI sends browser uploads as Eve file parts. Eve validates the default upload policy (25 MB, all media types), stages byte-backed uploads under `/workspace/attachments`, and gives the model a sandbox reference. The agent can inspect text-like files with its built-in file tools. This is suitable for exploration and simple text/CSV work, but not deterministic XLSX/PDF parsing.

For production-grade file processing, add a host-owned upload service and a constrained parser interface. An existing file-parsing MCP server is a valid implementation of that interface:

```text
Browser upload -> host upload store -> opaque upload ID -> parser MCP/tool -> business result store
```

The MCP server should receive only an opaque upload ID or a fixed per-tenant work directory, and expose parsing operations such as `extract_text` or `read_table`. Do not connect a generic filesystem or shell MCP server to an end-user-facing agent. Keep authorization, retention, tenant isolation, parser access, and final artifacts in the host service.

## Observability

When Phoenix is enabled, instrumentation exports model and tool spans through OTLP to the configured collector endpoint. Phoenix is observational only; it is not part of request routing or session persistence.

## Local operations

- Start the Eve CLI: `npm run dev:eve`
- Start the browser UI: `npm run dev`
- Start Phoenix: `npm run dev:phoenix`

Use `.env.local` for local secrets and model configuration. Do not commit it.
