import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Still — a calm AI assistant" },
      { name: "description", content: "A quiet, focused chat assistant powered by Claude." },
      { property: "og:title", content: "Still — a calm AI assistant" },
      { property: "og:description", content: "A quiet, focused chat assistant powered by Claude." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const SUGGESTIONS = [
  "Help me plan a slow, restful weekend",
  "Explain a hard idea in simple words",
  "Draft a kind reply to a tricky email",
];

function Mark() {
  return (
    <span aria-hidden className="relative inline-flex size-7 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-primary/15" />
      <span className="size-2.5 rounded-full bg-primary" />
    </span>
  );
}

function Index() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
    onError: (e) => setError(e.message || "Something went wrong. Please try again."),
  });
  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setError(null);
    sendMessage({ text });
    setInput("");
  };

  const handleSubmit = (m: PromptInputMessage) => send(m.text ?? "");
  const last = messages[messages.length - 1];
  const waiting =
    status === "submitted" ||
    (status === "streaming" && last?.role === "assistant" && !last.parts.some((p) => p.type === "text" && p.text));

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-5 pb-2">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="font-display text-xl tracking-tight text-foreground">Still</span>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { stop(); setMessages([]); setError(null); }}>
            <RotateCcw className="size-4" /> New chat
          </Button>
        )}
      </header>

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl px-5">
          {messages.length === 0 ? (
            <div className="flex min-h-[55dvh] flex-col justify-center gap-6 animate-in fade-in duration-700">
              <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
                What's on your mind?
              </h1>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (
                      m.role === "assistant" ? (
                        <MessageResponse key={i}>{p.text}</MessageResponse>
                      ) : (
                        <span key={i} className="whitespace-pre-wrap">{p.text}</span>
                      )
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {waiting && <Shimmer className="text-sm">Thinking…</Shimmer>}
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-2xl px-4 pb-4 pt-2">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
