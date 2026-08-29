export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export class AssistantApiError extends Error {}

/**
 * Calls Claude directly from the browser using the caller's own API key.
 * This requires the `anthropic-dangerous-direct-browser-access` header --
 * without it, Anthropic's API rejects CORS requests from a browser origin.
 * The key never touches any server of ours: this fetch goes straight from
 * the user's browser to api.anthropic.com.
 */
export async function askAssistant(apiKey: string, systemPrompt: string, history: ChatMessage[]): Promise<string> {
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
  } catch {
    throw new AssistantApiError("Couldn't reach the Anthropic API -- check your network connection.");
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body?.error?.message ?? detail;
    } catch {
      // ignore -- fall back to the status code
    }
    if (response.status === 401) {
      throw new AssistantApiError("That API key was rejected. Double-check it and try again.");
    }
    if (response.status === 429) {
      throw new AssistantApiError("Rate limited by the Anthropic API -- wait a moment and try again.");
    }
    throw new AssistantApiError(`Anthropic API error: ${detail}`);
  }

  const data = await response.json();
  const text = (data.content ?? [])
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("\n");
  return text || "(no response)";
}
