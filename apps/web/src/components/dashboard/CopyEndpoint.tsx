"use client";

import { useState } from "react";
import { Button } from "@submitpulse/ui";
import { useToast } from "@submitpulse/ui";
import { cn } from "@submitpulse/ui";

interface CopyEndpointProps {
  endpoint: string;
  label?: string;
  className?: string;
}

export function CopyEndpoint({
  endpoint,
  label = "Copy endpoint",
  className,
}: CopyEndpointProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopied(true);
      toast({ title: "Copied!", description: "Endpoint URL copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please copy the URL manually.", variant: "destructive" });
    }
  };

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <code className="flex-1 truncate rounded-input bg-code-background px-3 py-2 text-xs font-mono text-text-primary border border-border">
        {endpoint}
      </code>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleCopy}
        aria-label={copied ? "Copied!" : label}
      >
        {copied ? "Copied!" : "Copy"}
      </Button>
    </div>
  );
}
