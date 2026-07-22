"use client";

import type { UserContent } from "ai";
import type { SessionState } from "eve/client";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { DevAssistAttachIcon } from "@/components/icons/dev-assist-icons";
import { AgentMessage } from "./agent-message";
import { LocalDiagnosticsControls, LocalSessionSidebar } from "./local-diagnostics-controls";
import { SessionDiagnostics } from "./session-diagnostics";
import { fetchRecoveredEveSession, readSessionId, replaceSessionUrl, type RecoveredEveSession } from "./session-recovery";

const AGENT_NAME = "eve-chat-agent";
const FILE_ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FILE_BYTES_MAX = 10 * 1024 * 1024;

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

export function AgentChat() {
  const [isBootstrapped, setBootstrapped] = useState(false);
  const [requestedSessionId, setRequestedSessionId] = useState<string>();
  const [recoveredSession, setRecoveredSession] = useState<RecoveredEveSession>();
  const [recoveryError, setRecoveryError] = useState<string>();

  useEffect(() => {
    setRequestedSessionId(readSessionId(window.location.search));
    setBootstrapped(true);
  }, []);

  useEffect(() => {
    if (!isBootstrapped || !requestedSessionId) return;
    let cancelled = false;
    void fetchRecoveredEveSession(requestedSessionId).then(
      (session) => {
        if (!cancelled) {
          setRecoveredSession(session);
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setRecoveryError(error instanceof Error ? error.message : "Unable to restore this session.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isBootstrapped, requestedSessionId]);

  if (!isBootstrapped || (requestedSessionId && !recoveredSession && !recoveryError)) {
    return <SessionRecoveryState message="Restoring conversation..." />;
  }
  if (recoveryError) {
    return <SessionRecoveryState message={recoveryError} />;
  }
  return (
    <AgentChatSession
      initialEvents={recoveredSession?.initialEvents}
      initialSession={recoveredSession?.initialSession}
      key={recoveredSession?.initialSession.sessionId ?? "new-session"}
    />
  );
}

function AgentChatSession({
  initialEvents,
  initialSession,
}: {
  readonly initialEvents?: RecoveredEveSession["initialEvents"];
  readonly initialSession?: SessionState;
}) {
  const [sessionListRefreshKey, setSessionListRefreshKey] = useState(0);
  const agent = useEveAgent({
    initialEvents,
    initialSession,
    onSessionChange(session) {
      if (session.sessionId) {
        replaceSessionUrl(session.sessionId);
      }
    },
    onFinish() {
      setSessionListRefreshKey((value) => value + 1);
    },
  });
  const [uploadError, setUploadError] = useState<string>();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;
  const terminalEvent = [...agent.events]
    .reverse()
    .find(
      (event) =>
        event.type === "turn.completed" ||
        event.type === "turn.cancelled" ||
        event.type === "turn.failed" ||
        event.type === "session.failed",
    );
  const runtimeError =
    terminalEvent?.type === "turn.failed" || terminalEvent?.type === "session.failed"
      ? terminalEvent.data.message
      : undefined;
  const errorMessage = agent.error?.message ?? runtimeError;

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if ((text.length === 0 && message.files.length === 0) || isBusy) return;

    if (message.files.length === 0) {
      await agent.send({ message: text });
      return;
    }

    const parts: UserContent = [];
    if (text.length > 0) {
      parts.push({ text, type: "text" });
    }
    for (const file of message.files) {
      parts.push({
        data: file.url,
        filename: file.filename,
        mediaType: file.mediaType,
        type: "file",
      });
    }

    await agent.send({ message: parts });
  };

  const composer = (
    <>
      <PromptInput
        accept={FILE_ACCEPT}
        className="rounded-[28px] border-black/[.08] bg-white px-1 shadow-[0_10px_24px_rgb(13_13_13_/_5%)] focus-within:border-black/20"
        maxFileSize={FILE_BYTES_MAX}
        maxFiles={1}
        onError={({ message }) => setUploadError(message)}
        onSubmit={handleSubmit}
      >
        <PromptInputTextarea placeholder="Send a message…" />
        <PromptInputFooter>
          <PromptInputTools>
            <AttachmentControl disabled={isBusy} onOpen={() => setUploadError(undefined)} />
          </PromptInputTools>
        </PromptInputFooter>
        <PromptInputSubmit onStop={agent.stop} status={agent.status} />
      </PromptInput>
      {uploadError ? <p className="mt-2 text-destructive text-xs">{uploadError}</p> : null}
    </>
  );

  return (
    <main className="flex h-dvh overflow-hidden bg-white text-foreground">
      <LocalSessionSidebar currentSessionId={agent.session.sessionId} refreshKey={sessionListRefreshKey} />
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-black/[.03] bg-white/88 px-4 pl-14 backdrop-blur-md md:pl-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-black/90">{AGENT_NAME}</span>
            {isEmpty ? null : <StatusDot status={agent.status} />}
          </div>
          <div className="flex justify-end"><LocalDiagnosticsControls /></div>
        </header>

      {errorMessage ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Request failed</p>
              <p className="mt-0.5 text-muted-foreground">{errorMessage}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? null : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
            {agent.data.messages.map((message, index) => (
              <div className="space-y-2" key={message.id}>
                <AgentMessage
                  canRespond={!isBusy}
                  isStreaming={
                    agent.status === "streaming" && index === agent.data.messages.length - 1
                  }
                  message={message}
                  onInputResponses={(inputResponses) => agent.send({ inputResponses })}
                />
                {message.role === "assistant" &&
                !isBusy &&
                index === agent.data.messages.length - 1 ? (
                  <SessionDiagnostics sessionId={agent.session.sessionId} />
                ) : null}
              </div>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div
        className={cn(
          "relative z-[1] w-full bg-linear-to-b from-transparent via-white/80 to-white px-4 pt-3 backdrop-blur-md sm:px-6",
          isEmpty
            ? "flex flex-1 flex-col items-center justify-center gap-8 pb-[10vh]"
            : "shrink-0 pb-4",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-4xl font-semibold">{AGENT_NAME}</h1>
          </div>
        ) : null}
        <div className="mx-auto w-full max-w-3xl">{composer}</div>
      </div>
      </section>
    </main>
  );
}

function SessionRecoveryState({ message }: { readonly message: string }) {
  return (
    <main className="flex h-dvh items-center justify-center bg-background px-4 text-foreground">
      <p className="text-muted-foreground text-sm">{message}</p>
    </main>
  );
}

function AttachmentControl({ disabled, onOpen }: { readonly disabled: boolean; readonly onOpen: () => void }) {
  const attachments = usePromptInputAttachments();

  return (
    <>
      {attachments.files.map((file) => (
        <span className="flex min-w-0 items-center gap-1 text-xs" key={file.id}>
          <span className="max-w-44 truncate">{file.filename ?? "Attachment"}</span>
          <PromptInputButton
            aria-label={`Remove ${file.filename ?? "attachment"}`}
            disabled={disabled}
            onClick={() => {
              attachments.remove(file.id);
              onOpen();
            }}
            size="icon-xs"
            tooltip="Remove attachment"
          >
            <XIcon className="size-3.5" />
          </PromptInputButton>
        </span>
      ))}
      <PromptInputButton
        aria-label="Upload CSV or XLSX"
        disabled={disabled}
        onClick={() => {
          onOpen();
          attachments.openFileDialog();
        }}
        tooltip="Upload CSV or XLSX"
      >
        <DevAssistAttachIcon className="size-4" />
      </PromptInputButton>
    </>
  );
}

function StatusDot({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  const tone =
    status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-500"
        : status === "ready"
          ? "bg-muted-foreground"
          : "bg-muted-foreground/50";

  return (
    <span className="relative flex size-1">
      {isLive ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            tone,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-1 rounded-full transition-colors", tone)} />
    </span>
  );
}
