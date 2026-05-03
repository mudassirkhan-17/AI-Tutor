"use client";

import * as React from "react";

/** Minimal typings — Web Speech API is Chromium-first; TS DOM libs vary. */
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognitionLike, ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((this: SpeechRecognitionLike, ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((this: SpeechRecognitionLike) => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Browser Web Speech API (SpeechRecognition). Works best in Chromium
 * (Chrome, Edge). User must allow microphone. Transcript is appended per
 * final speech segment when the user stops speaking or recognition ends.
 */
export function useSpeechRecognition({
  onTranscript,
  onError,
  lang = "en-US",
}: {
  onTranscript: (text: string) => void;
  onError?: (code: string) => void;
  lang?: string;
}) {
  const [listening, setListening] = React.useState(false);
  const [supported, setSupported] = React.useState(false);
  React.useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor());
  }, []);
  const recRef = React.useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = React.useRef(onTranscript);
  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const stop = React.useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }

    const recognition = new Ctor();
    recRef.current = recognition;
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) text += r[0]?.transcript ?? "";
      }
      const trimmed = text.trim();
      if (trimmed) onTranscriptRef.current(trimmed);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      setListening(false);
      recRef.current = null;
      onErrorRef.current?.(event.error);
    };

    recognition.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      recRef.current = null;
    }
  }, [lang]);

  React.useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
      recRef.current = null;
    };
  }, []);

  return { listening, start, stop, supported };
}
