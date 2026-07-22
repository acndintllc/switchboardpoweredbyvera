import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/switchboard-vera.png.asset.json";
import headerLogoAsset from "@/assets/switchboard-header.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Switchboard — AI Workstation Powered by VERA" },
      {
        name: "description",
        content:
          "Multi personality. Multi intelligence. One workstation. Pair any model with any agent persona.",
      },
      { property: "og:title", content: "Switchboard — AI Workstation Powered by VERA" },
      {
        property: "og:description",
        content: "Multi personality. Multi intelligence. One workstation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  description_es: string | null;
  category: string;
  display_label: string;
  display_label_es: string | null;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

interface Attachment {
  id: string;
  name: string;
  kind: "image" | "text";
  dataUrl?: string; // for images
  text?: string;    // for text-like files
}

const ATTACH_ACCEPT =
  "image/*,.pdf,.txt,.md,.markdown,.csv,.json,.log,.rtf,.doc,.docx";

async function extractDocx(file: File): Promise<string> {
  // @ts-expect-error no types shipped for browser bundle
  const mammoth = await import("mammoth/mammoth.browser.js");
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return value ?? "";
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = "";
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf } as never).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n\n";
  }
  return out;
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<{ email: string | null } | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState<Lang>(() => {
    if (typeof navigator === "undefined") return "en";
    return (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en";
  });
  const t = DICT[language];
  const scrollRef = useRef<HTMLDivElement>(null);
  const personaBoxRef = useRef<HTMLDivElement>(null);
  const artifactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!personaBoxRef.current?.contains(e.target as Node)) setPersonaOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ? { email: data.session.user.email ?? null } : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ? { email: s.user.email ?? null } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleAuth(mode: "signin" | "signup") {
    if (!authEmail || !authPassword) return;
    setAuthBusy(true);
    setAuthNotice(null);
    try {
      if (mode === "signup") {
        const redirectTo = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setAuthNotice(
          language === "es"
            ? "Revisa tu correo para confirmar la cuenta, luego inicia sesión."
            : "Check your email to confirm the account, then sign in.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      }
    } catch (e) {
      setAuthNotice((e as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleResetPassword() {
    if (!authEmail) {
      setAuthNotice(
        language === "es"
          ? "Escribe tu correo y luego pulsa recuperar contraseña."
          : "Enter your email, then click reset password.",
      );
      return;
    }
    setAuthBusy(true);
    setAuthNotice(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setAuthNotice(
        language === "es"
          ? "Te enviamos un enlace para restablecer la contraseña."
          : "We sent you a password reset link.",
      );
    } catch (e) {
      setAuthNotice((e as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    supabase
      .from("agent_personas_public" as never)
      .select("slug,name,agent_name,description,description_es,category,display_label,display_label_es")
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

  // Latest assistant output drives the Artifact Canvas (right panel).
  const latestArtifact = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  useEffect(() => {
    artifactRef.current?.scrollTo({ top: artifactRef.current.scrollHeight, behavior: "smooth" });
  }, [latestArtifact?.content, latestArtifact?.imageUrl]);

  const activeBrainLabel = useMemo(
    () => BRAINS.find((b) => b.value === brain)?.label ?? brain,
    [brain],
  );
  const activePersona = useMemo(
    () => personas.find((p) => p.slug === personaSlug),
    [personas, personaSlug],
  );

  const describe = (p: Persona | undefined) =>
    !p ? "" : (language === "es" ? (p.description_es?.trim() || p.description) : p.description);

  const displayLabel = (p: Persona | undefined) =>
    !p ? "" : (language === "es" ? (p.display_label_es?.trim() || p.display_label) : p.display_label);

  const categoryLabel = (cat: string) => {
    if (language === "es") {
      if (cat === "Writing assets") return "Recursos de escritura";
      if (cat === "Business assets") return "Recursos de negocios";
    }
    return cat;
  };

  async function handleSend() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || busy) return;
    if (!personaSlug) {
      setError(language === "es" ? "Elige una persona primero." : "Select a persona first.");
      return;
    }
    setError(null);
    setInput("");

    // Fold attachments into the user message so all providers see them as text.
    let composed = text;
    for (const a of attachments) {
      if (a.kind === "text" && a.text) {
        composed += `\n\n[Attached file: ${a.name}]\n\`\`\`\n${a.text.slice(0, 20000)}\n\`\`\``;
      } else if (a.kind === "image") {
        composed += `\n\n[Attached image: ${a.name}]`;
      }
    }
    const firstImage = attachments.find((a) => a.kind === "image");
    const nextMessages: ChatMsg[] = [
      ...messages,
      { role: "user", content: composed || "(attachments)", imageUrl: firstImage?.dataUrl },
    ];
    setMessages(nextMessages);
    setAttachments([]);
    setBusy(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error(
          language === "es"
            ? "Inicia sesión para enviar mensajes."
            : "Please sign in to send messages.",
        );
      }
      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      } as const;
      // Image branch (single JSON response)
      if (brain === "image") {
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            brain, personaSlug, language,
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const j = await resp.json();
        if (!resp.ok) throw new Error(j?.error ?? `Error ${resp.status}`);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: j.imageUrl ? "" : "(no image returned)", imageUrl: j.imageUrl ?? undefined },
        ]);
      } else {
        // Streaming branch with [PART_PAUSE] auto-continuation loop.
        setMessages((m) => [...m, { role: "assistant", content: "" }]);
        let convo = nextMessages.slice();
        let aggregate = "";
        const MAX_PARTS = 8;
        for (let part = 0; part < MAX_PARTS; part++) {
          const resp = await fetch("/api/chat", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              brain, personaSlug, language,
              messages: convo.map((m) => ({ role: m.role, content: m.content })),
            }),
          });
          if (!resp.ok || !resp.body) {
            const t = await resp.text();
            throw new Error(t || `Error ${resp.status}`);
          }
          const reader = resp.body.getReader();
          const dec = new TextDecoder();
          let partText = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = dec.decode(value, { stream: true });
            partText += chunk;
            aggregate += chunk;
            setMessages((m) => {
              const copy = m.slice();
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: aggregate.replace(/\[PART_PAUSE\]\s*$/i, "") };
              }
              return copy;
            });
          }
          if (!/\[PART_PAUSE\]\s*$/i.test(partText.trim())) break;
          // Strip token from aggregate and prepare a silent continuation turn.
          aggregate = aggregate.replace(/\[PART_PAUSE\]\s*$/i, "");
          convo = [
            ...convo,
            { role: "assistant", content: partText.replace(/\[PART_PAUSE\]\s*$/i, "") },
            { role: "user", content: language === "es"
                ? "Continúa exactamente donde te detuviste sin repetir texto anterior. Cuando termines por completo, no imprimas [PART_PAUSE]."
                : "Continue exactly where you left off without repeating prior text. When fully complete, do not print [PART_PAUSE]." },
          ];
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.type.startsWith("audio/") || f.type.startsWith("video/")) continue;
      const id = `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`;
      if (f.type.startsWith("image/")) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(f);
        });
        next.push({ id, name: f.name, kind: "image", dataUrl });
      } else {
        const lower = f.name.toLowerCase();
        let txt = "";
        try {
          if (lower.endsWith(".docx")) txt = await extractDocx(f);
          else if (lower.endsWith(".pdf")) txt = await extractPdf(f);
          else txt = await f.text();
        } catch (e) {
          txt = `[Could not parse ${f.name}: ${(e as Error).message}]`;
        }
        next.push({ id, name: f.name, kind: "text", text: txt });
      }
    }
    setAttachments((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Control Bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center">
            <h1 className="m-0 leading-none">
              <img
                src={headerLogoAsset.url}
                alt={`Switchboard, ${t.poweredBy}`}
                className="h-14 w-auto object-contain brightness-125 drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]"
              />
              <span className="sr-only">Switchboard, {t.poweredBy}</span>
            </h1>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              aria-label={t.languageAria}
              onClick={() => setLanguage((l) => (l === "en" ? "es" : "en"))}
              className="font-display h-14 rounded-md border border-sky-500/60 bg-sky-950/60 px-3 text-xs font-semibold tracking-[0.2em] uppercase text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.35)] outline-none focus:ring-2 focus:ring-sky-400"
            >
              [ <span className={language === "en" ? "text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]" : "text-sky-300/40"}>EN</span>
              {" / "}
              <span className={language === "es" ? "text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]" : "text-sky-300/40"}>ES</span> ]
            </button>
            {session && (
              <button
                type="button"
                onClick={() => void supabase.auth.signOut()}
                title={session.email ?? ""}
                className="font-display h-14 rounded-md border border-sky-500/60 bg-sky-950/60 px-3 text-xs font-semibold uppercase tracking-wider text-sky-200 hover:bg-sky-900/70"
              >
                {language === "es" ? "Salir" : "Sign out"}
              </button>
            )}
            <div className="flex flex-col">
              <label className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.activeBrain}
              </label>
              <select
                aria-label="Active Brain"
                value={brain}
                onChange={(e) => setBrain(e.target.value as Brain)}
                className="font-display h-14 min-w-[180px] rounded-md border border-sky-500/60 bg-sky-950/60 px-3 text-sm font-semibold tracking-wide uppercase text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.25)] outline-none focus:ring-2 focus:ring-sky-400"
              >
                {BRAINS.map((b) => (
                  <option key={b.value} value={b.value} className="bg-sky-950 text-sky-100">
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
                  className="flex h-14 min-w-[280px] flex-col items-start justify-center rounded-md border border-sky-500/60 bg-sky-950/60 px-3 py-1 text-left text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.25)] outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50"
                >
                  <span className="font-display text-sm font-semibold tracking-wide uppercase leading-tight">
                    {displayLabel(activePersona) || activePersona?.agent_name || activePersona?.name || (personas.length === 0 ? t.loading : t.selectPersona)}
                  </span>
                  <span className="mt-0.5 text-[11px] text-sky-200/70 leading-tight truncate max-w-[260px]">
                    {describe(activePersona) || " "}
                  </span>
                </button>
                {personaOpen && personas.length > 0 && (
                  <ul
                    role="listbox"
                    className="absolute right-0 z-30 mt-1 max-h-96 w-[360px] overflow-y-auto rounded-md border border-sky-500/50 bg-sky-950/95 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.35)] backdrop-blur"
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
                            className={`flex w-full flex-col items-start gap-0.5 border-b border-sky-500/20 px-3 py-2 text-left transition-colors hover:bg-sky-800/50 ${
                              selected ? "bg-sky-800/60" : ""
                            }`}
                          >
                            <span className="font-display text-sm font-semibold tracking-wide uppercase leading-tight">
                              {p.agent_name ?? p.name}
                            </span>
                            <span className="text-[11px] text-sky-200/70 leading-snug">
                              {describe(p)}
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
        className="relative mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4"
      >
        {/* Embedded background brand mark — full-width, no opacity */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-center bg-no-repeat bg-contain"
          style={{ backgroundImage: `url(${logoAsset.url})` }}
        />
        {/* Split workspace: Interaction Feed (40%) | Artifact Canvas (60%) */}
        <div
          className="relative z-10 grid flex-1 grid-cols-1 gap-4 py-6 md:grid-cols-[40fr_60fr]"
          style={{ minHeight: "60vh" }}
        >
          {/* Left: Interaction Feed */}
          <section
            aria-label="Interaction Feed"
            className="flex min-h-[50vh] flex-col rounded-lg border border-sky-500/20 bg-black/40 backdrop-blur-sm"
          >
            <header className="border-b border-sky-500/20 px-3 py-2">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]">
                Interaction Feed
              </p>
            </header>
            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto px-3 py-4"
            >
              {messages.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  <p className="font-display font-semibold uppercase tracking-wide text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]">
                    {activeBrainLabel} × {activePersona?.agent_name ?? activePersona?.name ?? "…"}
                  </p>
                  <p className="mt-1 text-white">{t.emptyBody}</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[90%] rounded-2xl bg-black/75 px-3.5 py-2 text-sm font-medium text-white whitespace-pre-wrap shadow-[0_0_22px_rgba(255,255,255,0.18)] ring-1 ring-white/10">
                    {m.imageUrl && m.role === "user" ? (
                      <img
                        src={m.imageUrl}
                        alt="User attached image"
                        className="max-w-full rounded-lg"
                      />
                    ) : m.role === "assistant" && m.imageUrl ? (
                      <span className="italic text-sky-200/80">
                        {language === "es" ? "Imagen renderizada en el lienzo →" : "Image rendered in canvas →"}
                      </span>
                    ) : m.role === "assistant" ? (
                      <span className="italic text-sky-200/80">
                        {m.content
                          ? (language === "es" ? "Documento en el lienzo →" : "Document in canvas →")
                          : (busy && i === messages.length - 1 ? "…" : "")}
                      </span>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Right: Artifact Canvas */}
          <section
            aria-label="Artifact Canvas"
            className="flex min-h-[50vh] flex-col rounded-lg border border-sky-500/20 bg-black/40 backdrop-blur-sm shadow-[0_0_28px_rgba(56,189,248,0.15)]"
          >
            <header className="flex items-center justify-between border-b border-sky-500/20 px-4 py-2">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]">
                Artifact Canvas
              </p>
              <p className="text-[10px] uppercase tracking-wider text-sky-200/60">
                {activeBrainLabel}
              </p>
            </header>
            <div
              ref={artifactRef}
              className="flex-1 overflow-y-auto"
            >
              {!latestArtifact ? (
                <div className="flex h-full items-center justify-center p-10 text-center text-sm text-sky-200/60">
                  {language === "es"
                    ? "El lienzo mostrará documentos, capítulos, gráficos e imágenes generadas en alta resolución."
                    : "The canvas will render long-form documents, chapters, charts, and high-resolution generated images."}
                </div>
              ) : latestArtifact.imageUrl ? (
                <div className="flex h-full w-full items-center justify-center p-4">
                  <img
                    src={latestArtifact.imageUrl}
                    alt={`AI generated image: ${messages[messages.indexOf(latestArtifact) - 1]?.content?.slice(0, 140) ?? "prompt"}`}
                    className="max-h-[80vh] max-w-full rounded-md object-contain shadow-[0_0_40px_rgba(56,189,248,0.35)]"
                  />
                </div>
              ) : (
                <article className="mx-auto max-w-3xl px-8 py-10 font-serif text-[15px] leading-7 text-white whitespace-pre-wrap">
                  {latestArtifact.content || (busy ? "…" : "")}
                </article>
              )}
            </div>
          </section>
        </div>

        {error && (
          <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="relative z-10 mb-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-2 rounded-md border border-sky-500/50 bg-sky-950/70 px-2 py-1 text-xs text-sky-100"
              >
                {a.kind === "image" && a.dataUrl ? (
                  <img src={a.dataUrl} alt={a.name} className="h-6 w-6 rounded object-cover" />
                ) : (
                  <span aria-hidden>📎</span>
                )}
                <span className="max-w-[180px] truncate">{a.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                  className="text-sky-300 hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="sticky bottom-0 z-10 flex items-end gap-2 border-t border-border bg-background/85 backdrop-blur py-3"
        >
          {!session ? (
            <div className="flex w-full flex-col gap-2 rounded-md border border-sky-500/40 bg-sky-950/60 p-3 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.25)]">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
                {language === "es" ? "Inicia sesión para chatear" : "Sign in to chat"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  autoComplete="email"
                  placeholder={language === "es" ? "Correo" : "Email"}
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="flex-1 min-w-[180px] rounded-md border border-sky-500/40 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                />
                <div className="relative flex-1 min-w-[180px]">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder={language === "es" ? "Contraseña" : "Password"}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full rounded-md border border-sky-500/40 bg-black/40 px-3 py-2 pr-16 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-sky-300 hover:text-sky-200"
                  >
                    {showPassword ? (language === "es" ? "Ocultar" : "Hide") : (language === "es" ? "Ver" : "Show")}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleAuth("signin")}
                  className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
                >
                  {language === "es" ? "Entrar" : "Sign in"}
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleAuth("signup")}
                  className="rounded-md border border-sky-400/60 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-900/60 disabled:opacity-50"
                >
                  {language === "es" ? "Registrarse" : "Sign up"}
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleResetPassword()}
                  className="text-xs font-semibold uppercase tracking-wider text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline disabled:opacity-50"
                >
                  {language === "es" ? "¿Olvidaste tu contraseña?" : "Forgot password?"}
                </button>
              </div>
              {authNotice && (
                <p className="text-xs text-sky-200/80">{authNotice}</p>
              )}
            </div>
          ) : (
          <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ATTACH_ACCEPT}
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            aria-label="Attach file or image"
            title="Attach file or image"
            onClick={() => fileInputRef.current?.click()}
            className="h-[52px] w-11 shrink-0 rounded-md border border-sky-500/60 bg-sky-950/60 text-sky-200 shadow-[0_0_14px_rgba(56,189,248,0.2)] hover:bg-sky-900/70 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            +
          </button>
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
            disabled={busy || (!input.trim() && attachments.length === 0) || !personaSlug}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity disabled:opacity-50"
          >
            {busy ? "…" : t.send}
          </button>
          </>
          )}
        </form>
      </main>
    </div>
  );
}
