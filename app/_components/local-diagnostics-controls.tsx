"use client";

import { ActivityIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { LocalRuntimeResponse, LocalSessionsResponse } from "@/lib/local-diagnostics-contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function LocalDiagnosticsControls() {
  return (
    <div className="flex items-center gap-1">
      <RuntimeStatusDialog />
    </div>
  );
}

export function LocalSessionSidebar({ currentSessionId }: { readonly currentSessionId?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [state, setState] = useState<AsyncState<LocalSessionsResponse>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void fetchSessions().then(
      (data) => {
        if (!cancelled) setState({ data, status: "ready" });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({ message: error instanceof Error ? error.message : "Local session history is unavailable.", status: "error" });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [currentSessionId]);

  const sessions = state.status === "ready"
    ? state.data.sessions.filter((session) => session.sessionId.toLowerCase().includes(searchText.trim().toLowerCase()))
    : [];

  return (
    <>
      <Button
        aria-label={mobileOpen ? "Close local session history" : "Open local session history"}
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setMobileOpen((open) => !open)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        {mobileOpen ? <ChevronLeftIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
      </Button>
      {mobileOpen ? (
        <button
          aria-label="Close session history"
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        aria-label="Local session history"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r bg-background transition-transform duration-200 md:relative md:inset-auto md:z-auto md:translate-x-0 md:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-14" : "md:w-64",
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b px-3">
          <div className={cn("flex min-w-0 items-center gap-2", collapsed && "md:hidden")}>
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground font-semibold text-background text-xs">EV</div>
            <span className="truncate font-medium text-sm">eve-chat-agent</span>
          </div>
          <Button
            aria-label={collapsed ? "Expand session history" : "Collapse session history"}
            className={cn(collapsed && "md:mx-auto")}
            onClick={() => setCollapsed((open) => !open)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {collapsed ? <ChevronRightIcon className="size-4" /> : <ChevronLeftIcon className="size-4" />}
          </Button>
        </div>

        <div className={cn("space-y-2 p-3", collapsed && "md:px-2")}>
          <Button
            aria-label="Start a new chat"
            className={cn("w-full justify-start", collapsed && "md:w-9 md:justify-center md:px-0")}
            onClick={() => window.location.assign("/")}
            type="button"
            variant="ghost"
          >
            <PlusIcon className="size-4" />
            <span className={cn(collapsed && "md:hidden")}>New chat</span>
          </Button>
          <label className={cn("flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 text-muted-foreground", collapsed && "md:hidden")}>
            <SearchIcon className="size-4 shrink-0" />
            <span className="sr-only">Search chats</span>
            <input
              aria-label="Search chats"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              id="local-session-search"
              name="session-search"
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search chats"
              type="search"
              value={searchText}
            />
          </label>
        </div>

        <div className={cn("min-h-0 flex-1 px-3 pb-3", collapsed && "md:px-2")}>
          <div className={cn("mb-2 flex items-center justify-between px-2 text-muted-foreground text-xs", collapsed && "md:hidden")}>
            <span>Chats</span>
            <span>{state.status === "ready" ? state.data.sessions.length : ""}</span>
          </div>
          <SessionList
            currentSessionId={currentSessionId}
            onSelect={() => setMobileOpen(false)}
            sessions={sessions}
            state={state}
          />
        </div>
      </aside>
    </>
  );
}

function RuntimeStatusDialog() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AsyncState<LocalRuntimeResponse>>({ status: "idle" });

  useEffect(() => {
    if (!open) return;
    void loadRuntime(setState);
  }, [open]);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button aria-label="Open local runtime status" size="icon-sm" type="button" variant="ghost">
              <ActivityIcon className="size-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Runtime status</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pr-8">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Local runtime status</DialogTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Refresh local runtime status"
                  disabled={state.status === "loading"}
                  onClick={() => void loadRuntime(setState)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <RefreshCwIcon className={state.status === "loading" ? "size-4 animate-spin" : "size-4"} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
          <DialogDescription>Read-only snapshots from Eve and MicroSandbox.</DialogDescription>
        </DialogHeader>
        <RuntimeStatus state={state} />
      </DialogContent>
    </Dialog>
  );
}

function SessionList({
  currentSessionId,
  onSelect,
  sessions,
  state,
}: {
  readonly currentSessionId?: string;
  readonly onSelect: () => void;
  readonly sessions: readonly LocalSessionsResponse["sessions"][number][];
  readonly state: AsyncState<LocalSessionsResponse>;
}) {
  if (state.status !== "ready") {
    return state.status === "error" ? <StatusText>{state.message}</StatusText> : <StatusText>Loading sessions...</StatusText>;
  }
  if (sessions.length === 0) return <StatusText>{state.data.sessions.length === 0 ? "No local sessions found." : "No chats match this search."}</StatusText>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-1">
        {sessions.map((session) => (
          <button
            aria-current={session.sessionId === currentSessionId ? "page" : undefined}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted",
              session.sessionId === currentSessionId && "bg-muted",
            )}
            key={session.sessionId}
            onClick={() => {
              window.location.assign(`/?session_id=${encodeURIComponent(session.sessionId)}`);
              onSelect();
            }}
            type="button"
          >
            <span className="min-w-0">
              <span className="block truncate font-mono text-xs">{shortenId(session.sessionId)}</span>
              <time className="mt-0.5 block text-muted-foreground text-[11px]" dateTime={session.updatedAt}>
                {formatTime(session.updatedAt)}
              </time>
            </span>
            {session.sessionId === currentSessionId ? <span className="shrink-0 text-muted-foreground text-[10px]">Current</span> : null}
          </button>
        ))}
      </div>
      {state.data.truncated ? <p className="mt-2 px-2 text-muted-foreground text-[11px]">Showing the 50 most recent sessions.</p> : null}
    </div>
  );
}

function RuntimeStatus({ state }: { readonly state: AsyncState<LocalRuntimeResponse> }) {
  if (state.status !== "ready") {
    return state.status === "error" ? <StatusText>{state.message}</StatusText> : <StatusText>Loading runtime status...</StatusText>;
  }

  const data = state.data;
  const { eve, microsandbox } = data;
  return (
    <div className="space-y-5 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatusRow label="Eve" value={eve.reachable ? "Reachable" : "Unavailable"} />
        <StatusRow label="Generated" value={formatTime(data.generatedAt)} />
        <StatusRow label="Model" value={eve.model ?? "Unknown"} />
        <StatusRow label="Sandbox backend" value={eve.sandboxBackend ?? "Unknown"} />
        <StatusRow label="Tools" value={String(eve.toolNames?.length ?? 0)} />
        <StatusRow label="Skills" value={String(eve.skillNames?.length ?? 0)} />
        <StatusRow label="Running MSB VMs" value={String(microsandbox.runningSandboxCount)} />
        <StatusRow
          label="Eve-managed MSB VMs"
          value={microsandbox.eveManagedSandboxCount === null ? "Unavailable" : `${microsandbox.eveManagedSandboxCount} (${microsandbox.mappingStatus})`}
        />
      </div>
      {eve.error ? <StatusText>Eve inspection is {eve.error}.</StatusText> : null}
      {microsandbox.error ? <StatusText>MicroSandbox metrics are unavailable.</StatusText> : null}
      {microsandbox.sandboxes.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="border-b bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Sandbox</th>
                <th className="px-3 py-2 font-medium">CPU</th>
                <th className="px-3 py-2 font-medium">Memory</th>
                <th className="px-3 py-2 font-medium">Uptime</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {microsandbox.sandboxes.map((sandbox) => (
                <tr key={sandbox.name}>
                  <td className="max-w-72 truncate px-3 py-2 font-mono" title={sandbox.name}>{sandbox.name}</td>
                  <td className="px-3 py-2">{sandbox.cpuPercent.toFixed(1)}%</td>
                  <td className="px-3 py-2">{formatBytes(sandbox.memoryBytes)}</td>
                  <td className="px-3 py-2">{formatDuration(sandbox.uptimeMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function StatusRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0 border-b pb-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="truncate pt-0.5 font-medium" title={value}>{value}</p>
    </div>
  );
}

function StatusText({ children }: { readonly children: React.ReactNode }) {
  return <p className="py-6 text-center text-muted-foreground text-sm">{children}</p>;
}

type AsyncState<T> =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "error"; readonly message: string };

async function fetchSessions(): Promise<LocalSessionsResponse> {
  const response = await fetch("/api/local/sessions", { cache: "no-store" });
  if (!response.ok) throw new Error(`Local session history request failed (${response.status}).`);
  return await response.json() as LocalSessionsResponse;
}

async function loadRuntime(setState: (state: AsyncState<LocalRuntimeResponse>) => void) {
  setState({ status: "loading" });
  try {
    const response = await fetch("/api/local/runtime", { cache: "no-store" });
    if (!response.ok) throw new Error("Local runtime status is unavailable.");
    setState({ data: await response.json() as LocalRuntimeResponse, status: "ready" });
  } catch (error: unknown) {
    setState({ message: error instanceof Error ? error.message : "Local runtime status is unavailable.", status: "error" });
  }
}

function shortenId(value: string): string {
  return value.length <= 28 ? value : `${value.slice(0, 14)}...${value.slice(-10)}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatDuration(value: number): string {
  const seconds = Math.max(0, Math.floor(value / 1_000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3_600)}h ${Math.floor((seconds % 3_600) / 60)}m`;
}
