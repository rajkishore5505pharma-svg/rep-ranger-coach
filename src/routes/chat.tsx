import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
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
      { title: "RageBit Coach — AI Form & Strength Coach" },
      { name: "description", content: "Ask the RageBit coach about push-up and squat form, depth and programming." },
      { property: "og:title", content: "RageBit Coach — AI Form & Strength Coach" },
      { property: "og:description", content: "Ask the RageBit coach about push-up and squat form, depth and programming." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const SUGGESTIONS = [
  "How do I stop my hips sagging in push-ups?",
  "How deep should my squats go?",
  "Build me a 4-week push-up plan",
];

function Mark() {
  return <span aria-hidden className="inline-block size-3 bg-primary" />;
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
    <div className="rage flex h-dvh flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-5 pb-2">
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="icon" asChild aria-label="Back"><Link to="/"><ArrowLeft /></Link></Button>
          <Mark />
          <span className="font-impact text-xl uppercase tracking-wide">RageBit <span className="text-primary">Coach</span></span>
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
              <div className="font-mono text-xs font-bold uppercase tracking-widest text-primary">// Coach online</div>
              <h1 className="font-impact text-5xl uppercase leading-none">
                Ask the <span className="text-primary">coach.</span>
              </h1>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-sm border-2 border-border bg-card px-4 py-3 text-left font-mono text-sm uppercase text-muted-foreground transition-colors hover:border-primary hover:text-foreground active:translate-y-px"
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
            placeholder="Ask about form, depth, plans…"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
