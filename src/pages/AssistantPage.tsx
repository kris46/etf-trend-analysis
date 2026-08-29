import { useMemo, useState } from "react";
import { useMarketStore } from "../store/useMarketStore";
import { useAssistantStore } from "../store/useAssistantStore";
import { buildMarketContext, ASSISTANT_SYSTEM_PROMPT } from "../lib/assistant/buildContext";
import { askAssistant, AssistantApiError, type ChatMessage } from "../lib/assistant/claudeClient";

const EXAMPLE_PROMPTS = [
  "Why is the top-ranked ETF ranked #1 today?",
  "Show ETFs moving from Improving to Leading",
  "Which ETF shows the strongest accumulation right now?",
  "What's the weakest ETF today and why?",
];

export function AssistantPage() {
  const status = useMarketStore((s) => s.status);
  const indicatorsBySymbol = useMarketStore((s) => s.indicatorsBySymbol);
  const rankings = useMarketStore((s) => s.rankings);
  const benchmark = useMarketStore((s) => s.benchmark);

  const apiKey = useAssistantStore((s) => s.apiKey);
  const setApiKey = useAssistantStore((s) => s.setApiKey);
  const clearApiKey = useAssistantStore((s) => s.clearApiKey);
  const messages = useAssistantStore((s) => s.messages);
  const addMessage = useAssistantStore((s) => s.addMessage);
  const clearMessages = useAssistantStore((s) => s.clearMessages);

  const [keyInput, setKeyInput] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const context = useMemo(() => buildMarketContext(indicatorsBySymbol, rankings, benchmark), [indicatorsBySymbol, rankings, benchmark]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setError(null);
    const userMessage: ChatMessage = { role: "user", content: text };
    addMessage(userMessage);
    setQuestion("");
    setLoading(true);

    try {
      // Re-ground every turn with the current data context, not just the first message,
      // so the assistant can't drift onto stale numbers across a long conversation.
      const grounded: ChatMessage[] = [
        { role: "user", content: `Current market data context:\n\n${context}` },
        { role: "assistant", content: "Understood -- I'll answer using this data." },
        ...messages,
        userMessage,
      ];
      const reply = await askAssistant(apiKey, ASSISTANT_SYSTEM_PROMPT, grounded);
      addMessage({ role: "assistant", content: reply });
    } catch (e) {
      setError(e instanceof AssistantApiError ? e.message : "Something went wrong asking the assistant.");
    } finally {
      setLoading(false);
    }
  }

  if (status !== "ready") {
    return <div className="text-sm text-ink-muted">Loading…</div>;
  }

  if (!apiKey) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-lg font-semibold">AI Research Assistant</h1>
          <p className="text-sm text-ink-muted">Ask questions about today's rankings and signals in plain language.</p>
        </div>

        <div className="max-w-xl rounded-sm border border-line bg-surface p-4">
          <p className="text-[13px] text-ink-muted">
            This calls Claude directly from your browser using your own Anthropic API key -- there's no backend here to hold it for you. A few things
            worth knowing:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] text-ink-muted">
            <li>Your key lives only in this tab's memory. Refreshing the page clears it -- it's never saved anywhere.</li>
            <li>Requests go straight from your browser to api.anthropic.com, never through any server of ours.</li>
            <li>Usage is billed to your own Anthropic account.</li>
            <li>
              Get a key at{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-signal hover:underline">
                console.anthropic.com
              </a>
              .
            </li>
          </ul>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (keyInput.trim()) setApiKey(keyInput.trim());
            }}
            className="mt-4 flex gap-2"
          >
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              className="num flex-1 rounded-sm border border-line bg-surface-raised px-3 py-2 text-xs text-ink outline-none focus-visible:border-signal"
            />
            <button type="submit" className="rounded-sm border border-signal bg-signal-bg px-4 py-2 text-xs font-medium text-signal hover:bg-signal/20">
              Connect
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-semibold">AI Research Assistant</h1>
          <p className="text-sm text-ink-muted">Grounded in today's data -- {rankings.length} ETFs, benchmark {benchmark}.</p>
        </div>
        <div className="flex gap-3 text-xs">
          <button onClick={clearMessages} className="text-ink-muted hover:text-ink">
            Clear chat
          </button>
          <button onClick={clearApiKey} className="text-ink-muted hover:text-bear">
            Disconnect key
          </button>
        </div>
      </div>

      <div className="flex min-h-[420px] flex-col rounded-sm border border-line bg-surface">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-muted">Try asking:</p>
              {EXAMPLE_PROMPTS.map((p) => (
                <button key={p} onClick={() => send(p)} className="self-start rounded-sm border border-line bg-surface-raised px-3 py-1.5 text-[13px] text-ink-muted hover:text-ink">
                  {p}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-sm px-3 py-2 text-[13px] ${
                  m.role === "user" ? "bg-signal-bg text-ink" : "border border-line bg-surface-raised text-ink"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && <div className="text-[13px] text-ink-muted">Thinking…</div>}
          {error && <div className="rounded-sm border border-bear/30 bg-bear-bg px-3 py-2 text-[13px] text-bear">{error}</div>}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(question);
          }}
          className="flex gap-2 border-t border-line p-3"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about today's rankings, signals, or rotation..."
            className="flex-1 rounded-sm border border-line bg-surface-raised px-3 py-2 text-[13px] text-ink outline-none focus-visible:border-signal"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-sm border border-signal bg-signal-bg px-4 py-2 text-xs font-medium text-signal hover:bg-signal/20 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
