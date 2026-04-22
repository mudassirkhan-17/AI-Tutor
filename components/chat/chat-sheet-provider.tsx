"use client";

import * as React from "react";
import { ChatSheet } from "./chat-sheet";

export type ChatQuestionContext = {
  id: string;
  section_code: string;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  hint?: string | null;
  explanation?: string | null;
  user_answer?: "A" | "B" | "C" | "D" | null;
};

type Ctx = {
  open: (ctx?: ChatQuestionContext) => void;
  close: () => void;
};

const ChatSheetContext = React.createContext<Ctx | null>(null);

export function useChatSheet() {
  const ctx = React.useContext(ChatSheetContext);
  if (!ctx) throw new Error("useChatSheet must be used within ChatSheetProvider");
  return ctx;
}

export function ChatSheetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = React.useState(false);
  const [qctx, setQctx] = React.useState<ChatQuestionContext | undefined>(undefined);

  const value = React.useMemo<Ctx>(
    () => ({
      open: (ctx) => {
        setQctx(ctx);
        setOpen(true);
      },
      close: () => setOpen(false),
    }),
    [],
  );

  // Global ⌘K / Ctrl+K opens the sheet
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ChatSheetContext.Provider value={value}>
      {children}
      <ChatSheet
        open={isOpen}
        onOpenChange={setOpen}
        questionContext={qctx}
        onClearContext={() => setQctx(undefined)}
      />
    </ChatSheetContext.Provider>
  );
}
