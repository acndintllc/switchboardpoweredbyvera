import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/switchboard-vera.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Switchboard — Powered by VERA" },
      {
        name: "description",
        content:
          "Multi personality. Multi intelligence. One workstation. Pair any model with any agent persona.",
      },
      { property: "og:title", content: "Switchboard — Powered by VERA" },
      {
        property: "og:description",
        content: "Multi personality. Multi intelligence. One workstation.",
      },
    ],
  }),
  component: Index,
});

type Brain = "claude" | "chatgpt" | "grok" | "image";
type Lang = "en" | "es";

const DICT: Record<Lang, {
  activeBrain: string;
  activePersona: string;
  loading: string;
  selectPersona: string;
  send: string;
  empty: string;
  emptyBody: string;
  imagePlaceholder: (persona: string) => string;
  chatPlaceholder: (brain: string, persona: string) => string;
  poweredBy: string;
  languageAria: string;
}> = {
  en: {
    activeBrain: "Active Brain",
    activePersona: "Active Persona",
    loading: "Loading…",
    selectPersona: "Select persona",
    send: "Send",
    empty: "Ready when you are.",
    emptyBody:
      "Change either dropdown independently. Send a message to route through the current pair.",
    imagePlaceholder: () =>
      "Describe an image… (persona pillars become the visual modifier prefix)",
    chatPlaceholder: (brain, persona) => `Message ${brain} as ${persona}`,
    poweredBy: "Powered by VERA",
    languageAria: "Switch language",
  },
  es: {
    activeBrain: "Cerebro activo",
    activePersona: "Persona activa",
    loading: "Cargando…",
    selectPersona: "Elige una persona",
    send: "Enviar",
    empty: "Listo cuando tú lo estés.",
    emptyBody:
      "Cambia cualquiera de los menús de forma independiente. Envía un mensaje para enrutar a través del par activo.",
    imagePlaceholder: () =>
      "Describe una imagen… (los pilares de la persona serán el prefijo visual)",
    chatPlaceholder: (brain, persona) => `Escribe a ${brain} como ${persona}`,
    poweredBy: "Impulsado por VERA",
    languageAria: "Cambiar idioma",
  },
};

const BRAINS: { value: Brain; label: string }[] = [
  { value: "claude", label: "Claude" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "grok", label: "Grok 4.5" },
  { value: "image", label: "Image Generation" },
];

interface Persona {
  slug: string;
  name: string;
  agent_name: string | null;
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
  const [personaOpen, setPersonaOpen] = useState(false);
  const [language, setLanguage] = useState<Lang>(() => {
    if (typeof navigator === "undefined") return "en";
    return (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en";
  });
  const t = DICT[language];
  const scrollRef = useRef<HTMLDivElement>(null);
  const personaBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!personaBoxRef.current?.contains(e.target as Node)) setPersonaOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("agent_personas")
      .select("slug,name,agent_name,description")
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
      setError(language === "es" ? "Elige una persona primero." : "Select a persona first.");
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
          language,
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
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Switchboard powered by VERA"
              className="h-10 w-10 rounded-md object-cover ring-1 ring-border"
            />
            <div className="leading-tight">
              <h1 className="font-display text-lg font-bold tracking-wide uppercase">
                Switchboard
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {t.poweredBy}
              </p>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              aria-label={t.languageAria}
              onClick={() => setLanguage((l) => (l === "en" ? "es" : "en"))}
              className="font-display h-14 rounded-md border border-input bg-card px-3 text-xs font-semibold tracking-[0.2em] uppercase shadow-sm outline-none focus:ring-2 focus:ring-ring"
            >
              [ <span className={language === "en" ? "text-foreground" : "text-muted-foreground"}>EN</span>
              {" / "}
              <span className={language === "es" ? "text-foreground" : "text-muted-foreground"}>ES</span> ]
            </button>
            <div className="flex flex-col">
              <label className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.activeBrain}
              </label>
              <select
                aria-label="Active Brain"
                value={brain}
                onChange={(e) => setBrain(e.target.value as Brain)}
                className="font-display h-14 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-semibold tracking-wide uppercase shadow-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {BRAINS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col" ref={personaBoxRef}>
              <label className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.activePersona}
              </label>
              <div className="relative">
                <button
                  type="button"
                  aria-label={t.activePersona}
                  onClick={() => setPersonaOpen((v) => !v)}
                  disabled={personas.length === 0}
                  className="flex h-14 min-w-[280px] flex-col items-start justify-center rounded-md border border-input bg-card px-3 py-1 text-left shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <span className="font-display text-sm font-semibold tracking-wide uppercase leading-tight">
                    {activePersona?.agent_name ?? activePersona?.name ?? (personas.length === 0 ? t.loading : t.selectPersona)}
                  </span>
                  <span className="mt-0.5 text-[11px] text-muted-foreground leading-tight truncate max-w-[260px]">
                    {activePersona?.description ?? " "}
                  </span>
                </button>
                {personaOpen && personas.length > 0 && (
                  <ul
                    role="listbox"
                    className="absolute right-0 z-30 mt-1 max-h-96 w-[360px] overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
                  >
                    {personas.map((p) => {
                      const selected = p.slug === personaSlug;
                      return (
                        <li key={p.slug}>
                          <button
                            type="button"
                            onClick={() => {
                              setPersonaSlug(p.slug);
                              setPersonaOpen(false);
                            }}
                            className={`flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left transition-colors hover:bg-accent ${
                              selected ? "bg-accent" : ""
                            }`}
                          >
                            <span className="font-display text-sm font-semibold tracking-wide uppercase leading-tight">
                              {p.agent_name ?? p.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground leading-snug">
                              {p.description}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Chat */}
      <main
        className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4"
      >
        {/* Embedded background brand mark — full-width, no opacity */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-center bg-no-repeat bg-cover"
          style={{ backgroundImage: `url(${logoAsset.url})` }}
        />
        <div
          ref={scrollRef}
          className="relative z-10 flex-1 space-y-4 overflow-y-auto py-6"
          style={{ minHeight: "60vh" }}
        >
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {activeBrainLabel} × {activePersona?.agent_name ?? activePersona?.name ?? "…"}
              </p>
              <p className="mt-1">{t.emptyBody}</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[80%] rounded-2xl bg-black/75 px-4 py-2.5 text-sm font-medium text-white whitespace-pre-wrap shadow-[0_0_22px_rgba(255,255,255,0.18)] ring-1 ring-white/10"
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
          className="sticky bottom-0 z-10 flex items-end gap-2 border-t border-border bg-background/85 backdrop-blur py-3"
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
                ? t.imagePlaceholder(activePersona?.agent_name ?? activePersona?.name ?? "")
                : t.chatPlaceholder(activeBrainLabel, activePersona?.agent_name ?? activePersona?.name ?? "…")
            }
            rows={2}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={busy || !input.trim() || !personaSlug}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity disabled:opacity-50"
          >
            {busy ? "…" : t.send}
          </button>
        </form>
      </main>
    </div>
  );
}
