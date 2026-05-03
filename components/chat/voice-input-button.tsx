"use client";

import * as React from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/lib/speech/use-speech-recognition";
import { toast } from "sonner";

function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
      return "Microphone permission was blocked. Allow the mic for this site.";
    case "no-speech":
      return "No speech detected. Try again a little closer to the mic.";
    case "audio-capture":
      return "No microphone found or it is in use by another app.";
    case "network":
      return "Speech recognition had a network error. Try again.";
    default:
      return `Voice input error (${code}). Try again or type instead.`;
  }
}

/**
 * Mic: tap to start listening, tap again to stop. Final transcript is passed
 * to the parent once per utterance (parent usually appends to the text field).
 * Chromium (Chrome / Edge) + HTTPS (or localhost).
 */
export function VoiceInputButton({
  onAppendTranscript,
  disabled,
  className,
}: {
  onAppendTranscript: (fragment: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const add = React.useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      onAppendTranscript(t);
    },
    [onAppendTranscript],
  );

  const handleError = React.useCallback((code: string) => {
    toast.error(speechErrorMessage(code));
  }, []);

  const { listening, start, stop, supported } = useSpeechRecognition({
    onTranscript: add,
    onError: handleError,
  });

  function handleClick() {
    if (!supported) {
      toast.message("Voice typing isn't available here.", {
        description: "Use Chrome or Edge, and allow the microphone.",
      });
      return;
    }
    if (disabled) return;
    if (listening) stop();
    else start();
  }

  return (
    <Button
      type="button"
      variant={listening ? "secondary" : "outline"}
      size="icon"
      className={cn(
        "shrink-0",
        listening && "border-primary/40 bg-primary/10 text-primary",
        className,
      )}
      disabled={disabled && !listening}
      onClick={handleClick}
      title={
        supported
          ? listening
            ? "Stop listening"
            : "Speak to type"
          : "Voice typing (Chrome / Edge)"
      }
      aria-pressed={listening}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
    >
      <Mic className={cn("h-4 w-4", listening && "motion-safe:animate-pulse")} />
    </Button>
  );
}
