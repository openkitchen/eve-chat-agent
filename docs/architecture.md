# Current Architecture

## Scope

This is a self-hosted Eve chat agent. It provides a browser chat UI, durable Eve sessions, an OpenAI-compatible model provider, local tracing through Phoenix, and a local MicroSandbox VM for uploaded-file analysis.

## Runtime topology

```text
Browser
  -> Next.js chat UI (`useEveAgent`)
  -> Eve HTTP channel (`/eve/v1/session*`)
  -> Eve durable session and default harness
      -> OpenAI-compatible API (`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`)
      -> built-in tools and authored tools
      -> Eve-managed MicroSandbox VM
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

Eve creates a durable session from the first message and returns a `continuationToken`. Follow-up messages reuse it. After the first response, the UI puts the stable Eve `sessionId` in `?session_id=...`; loading that URL replays the local session stream and restores its continuation token. The header also exposes a local session index backed by the project's Eve run manifests. This POC does not add authorization; a deployment that serves the UI to multiple users must add session ownership and retention in the host application.

## Sandbox and uploads

`agent/sandbox.ts` pins the sandbox to Eve's official local `microsandbox()` backend.

- Each durable Eve session gets an Eve-managed lightweight Linux VM with a persistent `/workspace` across turns in the same running server.
- The VM has real Bash, core utilities, Python 3 and Python standard-library `csv`, `sqlite3`, `json`, `zipfile`, and `xml`. The template bootstrap creates `/workspace/analysis` and verifies the Python baseline.
- This POC fixes `cpus: 1`, `memoryMiB: 1024`, and `networkPolicy: "deny-all"`. There is no Docker dependency and no online package installation during bootstrap.
- Eve owns VM creation and shutdown. The UI does not start, stop, or delete VM processes. The runtime-status dialog reads Eve inspection data and a best-effort MicroSandbox metrics snapshot.

The standard `bash`, `read_file`, `write_file`, and `grep` tools are available to the root agent. The framework `glob` tool is disabled; `list_attachments` is the only deterministic attachment-discovery capability. The authoritative lifecycle constraints and current restart-recovery limitation are in `docs/design/microsandbox-lifecycle.md`.

The chat UI sends browser uploads as Eve file parts. Eve validates the default upload policy (25 MB, all media types), stages byte-backed uploads under `/workspace/attachments`, and gives the model a sandbox reference. The agent can inspect text-like files with its built-in file tools. This is suitable for exploration and simple text/CSV work. Deterministic CSV/XLSX discovery and querying are handled by authored tools in the application runtime, rather than by assuming an arbitrary XLSX CLI exists in the VM.

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
