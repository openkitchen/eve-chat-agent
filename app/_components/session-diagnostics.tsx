"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DevAssistCopyIcon } from "@/components/icons/dev-assist-icons";

export function formatDebugIdentifiers({
  sessionId,
}: {
  readonly sessionId: string;
}): string {
  return [`sessionId: ${sessionId}`, `runId: ${sessionId}`].join("\n");
}

export function SessionDiagnostics({
  sessionId,
}: {
  readonly sessionId?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!sessionId) {
    return null;
  }

  const identifiers = formatDebugIdentifiers({ sessionId });

  const copy = async () => {
    await navigator.clipboard.writeText(identifiers);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
      <span className="truncate font-mono" title={sessionId}>session/run: {shortenId(sessionId)}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Copy Eve debug identifiers"
            onClick={() => void copy()}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            {copied ? <CheckIcon className="size-3.5" /> : <DevAssistCopyIcon className="size-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : "Copy Eve debug identifiers"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function shortenId(value: string): string {
  return value.length <= 20 ? value : `${value.slice(0, 9)}...${value.slice(-8)}`;
}
