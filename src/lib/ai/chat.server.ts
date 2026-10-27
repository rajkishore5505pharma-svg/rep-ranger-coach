import { createAnthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const SYSTEM = `You are Still, a calm, thoughtful assistant. Answer clearly and concisely, use markdown when it helps, and avoid filler.`;

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleChat(request: Request) {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) return jsonError(500, "AI is not configured.");

  let messages: UIMessage[];
  try {
    const body = (await request.json()) as { messages?: UIMessage[] };
    if (!Array.isArray(body.messages)) throw new Error();
    messages = body.messages;
  } catch {
    return jsonError(400, "Invalid request.");
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch(
    request.headers.get("X-Lovable-AIG-Run-ID") ?? undefined,
  );
  const anthropic = createAnthropic({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: anthropic("anthropic/claude-sonnet-5"),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 16000,
    maxRetries: 0,
    abortSignal: request.signal,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onError: (error) => {
      const e = error as { statusCode?: number; message?: string };
      if (e?.statusCode === 429) return "Too many requests right now. Please wait a moment and try again.";
      if (e?.statusCode === 402) return "AI credits have run out. Please add credits to keep chatting.";
      if (e?.statusCode === 403) return e.message || "This request was denied.";
      return "Something went wrong. Please try again.";
    },
  });
}
