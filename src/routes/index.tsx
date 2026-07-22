import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Switchboard — Brain × Persona Console" },
      {
        name: "description",
        content:
          "Independent Brain and Persona dropdowns. Pair any model with any agent persona, then send.",
      },
      { property: "og:title", content: "Switchboard — Brain × Persona Console" },
      {
        property: "og:description",
        content: "Independent Brain and Persona dropdowns. Pair any model with any agent persona.",
      },
    ],
  }),
  component: Index,
});

type Brain = "claude" | "chatgpt" | "grok" | "image";

const BRAINS: { value: Brain; label: string }[] = [
  { value: "claude", label: "Claude" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "grok", label: "Grok 4.5" },
  { value: "image", label: "Image Generation" },
];

interface Persona {
  slug: string;
  name: string;
  description: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

function Index() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [brain, setBrain] = useState<Brain>("claude");
  const [personaSlug, setPersonaSlug] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("agent_personas")
      .select("slug,name,description")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setError(error.message);
          return;
        }
        const rows = (data ?? []) as Persona[];
        setPersonas(rows);
        if (rows.length && !personaSlug) setPersonaSlug(rows[0].slug);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const activeBrainLabel = useMemo(
    () => BRAINS.find((b) => b.value === brain)?.label ?? brain,
    [brain],
  );
  const activePersona = useMemo(
    () => personas.find((p) => p.slug === personaSlug),
    [personas, personaSlug],
  );

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    if (!personaSlug) {
      setError("Select a persona first.");
      return;
    }
    setError(null);
    setInput("");
    const nextMessages: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setBusy(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brain,
          personaSlug,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const ct = resp.headers.get("content-type") ?? "";

      if (ct.includes("application/json")) {
        const j = await resp.json();
        if (!resp.ok) throw new Error(j?.error ?? `Error ${resp.status}`);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: j.imageUrl ? "" : "(no image returned)",
            imageUrl: j.imageUrl ?? undefined,
          },
        ]);
      } else {
        if (!resp.ok || !resp.body) {
          const t = await resp.text();
          throw new Error(t || `Error ${resp.status}`);
        }
        setMessages((m) => [...m, { role: "assistant", content: "" }]);
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          setMessages((m) => {
            const copy = m.slice();
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + chunk };
            }
            return copy;
          });
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Control Bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            <h1 className="text-sm font-semibold tracking-tight">Switchboard</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <label className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Active Brain
              </label>
              <select
                aria-label="Active Brain"
                value={brain}
                onChange={(e) => setBrain(e.target.value as Brain)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {BRAINS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Active Persona
              </label>
              <select
                aria-label="Active Persona"
                value={personaSlug}
                onChange={(e) => setPersonaSlug(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                disabled={personas.length === 0}
              >
                {personas.length === 0 && <option value="">Loading…</option>}
                {personas.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name} — {p.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Chat */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4">
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto py-6"
          style={{ minHeight: "60vh" }}
        >
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {activeBrainLabel} × {activePersona?.name ?? "…"}
              </p>
              <p className="mt-1">
                Change either dropdown independently. Send a message to route through the current
                pair.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.imageUrl ? (
                  <img
                    src={m.imageUrl}
                    alt="Generated"
                    className="max-w-full rounded-lg"
                  />
                ) : (
                  m.content || (busy && i === messages.length - 1 ? "…" : "")
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="sticky bottom-0 flex items-end gap-2 border-t border-border bg-background py-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={
              brain === "image"
                ? "Describe an image… (persona pillars become the visual modifier prefix)"
                : `Message ${activeBrainLabel} as ${activePersona?.name ?? "…"}`
            }
            rows={2}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={busy || !input.trim() || !personaSlug}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity disabled:opacity-50"
          >
            {busy ? "…" : "Send"}
          </button>
        </form>
      </main>
    </div>
  );
}
