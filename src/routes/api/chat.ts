import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Brain = "claude" | "chatgpt" | "grok" | "image";
type Lang = "en" | "es";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  brain: Brain;
  personaSlug: string;
  messages: Msg[];
  language?: Lang;
}

interface PersonaRow {
  name: string;
  agent_name: string | null;
  description: string;
  structural_role_en: string | null;
  structural_role_es: string | null;
  personality_anchors_en: string | null;
  personality_anchors_es: string | null;
  constitutional_boundaries_en: string | null;
  constitutional_boundaries_es: string | null;
  rules_of_engagement_en: string | null;
  rules_of_engagement_es: string | null;
  governance_audit_loop_en: string | null;
  governance_audit_loop_es: string | null;
  role: string;
  personality: string;
  constitution: string;
  boundaries: string;
  engagement: string;
  audit_loop: string;
}

const PILLAR_KEYS: Array<{ base: keyof PersonaRow; en: keyof PersonaRow; es: keyof PersonaRow; label: string }> = [
  { base: "role",         en: "structural_role_en",           es: "structural_role_es",           label: "STRUCTURAL ROLE" },
  { base: "personality",  en: "personality_anchors_en",       es: "personality_anchors_es",       label: "PERSONALITY ANCHORS" },
  { base: "constitution", en: "constitutional_boundaries_en", es: "constitutional_boundaries_es", label: "CONSTITUTIONAL BOUNDARIES" },
  { base: "boundaries",   en: "constitutional_boundaries_en", es: "constitutional_boundaries_es", label: "BOUNDARIES" },
  { base: "engagement",   en: "rules_of_engagement_en",       es: "rules_of_engagement_es",       label: "RULES OF ENGAGEMENT" },
  { base: "audit_loop",   en: "governance_audit_loop_en",     es: "governance_audit_loop_es",     label: "GOVERNANCE AUDIT LOOP" },
];

function pick(row: PersonaRow, lang: Lang, en: keyof PersonaRow, es: keyof PersonaRow, base: keyof PersonaRow): string {
  const primary = (row[lang === "es" ? es : en] ?? "").toString().trim();
  if (primary) return primary;
  const fallback = (row[en] ?? "").toString().trim();
  if (fallback) return fallback;
  return (row[base] ?? "").toString().trim();
}

function compileSystemPrompt(p: PersonaRow, lang: Lang): string {
  const displayName = p.agent_name || p.name;
  const langName = lang === "es" ? "Spanish" : "English";
  const langHeader = `CRITICAL: The target processing and output language environment for this entire stream session is explicitly set to ${langName}. Deliver the final canvas text response strictly in this language format while preserving 100% of your 6 pillar persona constraints.`;
  const header = `You are "${displayName}", ${p.description}.`;
  const seen = new Set<string>();
  const pillars = PILLAR_KEYS.map(({ base, en, es, label }) => {
    const v = pick(p, lang, en, es, base);
    if (!v || seen.has(label)) return null;
    seen.add(label);
    return `## ${label}\n${v}`;
  })
    .filter(Boolean)
    .join("\n\n");
  const body = pillars ? `${header}\n\n${pillars}` : header;
  return `${langHeader}\n\n${body}`;
}

async function fetchPersona(slug: string): Promise<PersonaRow | null> {
  // Full persona pillars are no longer readable by anon; use the service role
  // client server-side to compile the system prompt.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("agent_personas")
    .select(
      "name,agent_name,description,role,personality,constitution,boundaries,engagement,audit_loop,structural_role_en,structural_role_es,personality_anchors_en,personality_anchors_es,constitutional_boundaries_en,constitutional_boundaries_es,rules_of_engagement_en,rules_of_engagement_es,governance_audit_loop_en,governance_audit_loop_es",
    )
    .eq("slug", slug)
    .maybeSingle();
  return (data as PersonaRow | null) ?? null;
}

// Verify the caller has a valid Supabase session. This endpoint proxies paid
// AI providers (OpenAI, Anthropic, xAI) so it must never be callable by
// anonymous clients.
async function requireAuthedUser(request: Request): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.split(".").length !== 3) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return { ok: false, response: new Response("Server auth misconfigured", { status: 500 }) };
  }
  const supa = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supa.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }
  return { ok: true, userId: data.claims.sub as string };
}

// -------- Streaming helpers --------

function textStream(pump: (write: (s: string) => void) => Promise<void>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (s: string) => controller.enqueue(enc.encode(s));
      try {
        await pump(write);
      } catch (e) {
        write(`\n\n[error] ${(e as Error).message}`);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

async function* readSSE(resp: Response) {
  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).replace(/\r$/, "");
      buf = buf.slice(idx + 1);
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") yield data;
      }
    }
  }
}

// -------- Provider calls --------

async function streamOpenAICompatible(opts: {
  write: (s: string) => void;
  url: string;
  apiKey: string;
  model: string;
  system: string;
  messages: Msg[];
  extraHeaders?: Record<string, string>;
}) {
  const body = {
    model: opts.model,
    stream: true,
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
  };
  const resp = await fetch(opts.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      ...(opts.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text();
    opts.write(`[${resp.status}] ${t.slice(0, 500)}`);
    return;
  }
  for await (const data of readSSE(resp)) {
    try {
      const j = JSON.parse(data);
      const delta = j.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) opts.write(delta);
    } catch {
      /* skip */
    }
  }
}

async function streamAnthropic(opts: {
  write: (s: string) => void;
  apiKey: string;
  system: string;
  messages: Msg[];
}) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      stream: true,
      system: opts.system,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text();
    opts.write(`[${resp.status}] ${t.slice(0, 500)}`);
    return;
  }
  for await (const data of readSSE(resp)) {
    try {
      const j = JSON.parse(data);
      if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
        opts.write(j.delta.text ?? "");
      }
    } catch {
      /* skip */
    }
  }
}

async function generateImage(opts: {
  apiKey: string;
  system: string;
  userPrompt: string;
}): Promise<Response> {
  // Prepend compiled persona instructions as a visual modifier prefix.
  const combined = `${opts.system}\n\n---\nUser request: ${opts.userPrompt}`.slice(0, 3900);
  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: combined,
      n: 1,
      size: "1024x1024",
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return Response.json(
      { error: json?.error?.message ?? `Image error ${resp.status}` },
      { status: resp.status },
    );
  }
  const item = json?.data?.[0] ?? {};
  const url = item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
  return Response.json({ imageUrl: url, prompt: combined });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuthedUser(request);
        if (!auth.ok) return auth.response;
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const { brain, personaSlug, messages } = body;
        const language: Lang = body.language === "es" ? "es" : "en";
        if (!brain || !personaSlug || !Array.isArray(messages)) {
          return new Response("Missing brain, personaSlug, or messages", { status: 400 });
        }

        const persona = await fetchPersona(personaSlug);
        if (!persona) return new Response("Persona not found", { status: 404 });
        const system = compileSystemPrompt(persona, language);

        if (brain === "image") {
          const key = process.env.OPENAI_API_KEY;
          if (!key) return new Response("Missing OPENAI_API_KEY", { status: 500 });
          const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
          return generateImage({ apiKey: key, system, userPrompt: lastUser });
        }

        if (brain === "claude") {
          const key = process.env.ANTHROPIC_API_KEY;
          if (!key) return new Response("Missing ANTHROPIC_API_KEY", { status: 500 });
          return textStream((write) => streamAnthropic({ write, apiKey: key, system, messages }));
        }

        if (brain === "chatgpt") {
          const key = process.env.OPENAI_API_KEY;
          if (!key) return new Response("Missing OPENAI_API_KEY", { status: 500 });
          return textStream((write) =>
            streamOpenAICompatible({
              write,
              url: "https://api.openai.com/v1/chat/completions",
              apiKey: key,
              model: "gpt-5",
              system,
              messages,
            }),
          );
        }

        if (brain === "grok") {
          const key = process.env.XAI_API_KEY;
          if (!key) return new Response("Missing XAI_API_KEY", { status: 500 });
          return textStream((write) =>
            streamOpenAICompatible({
              write,
              url: "https://api.x.ai/v1/chat/completions",
              apiKey: key,
              model: "grok-4-latest",
              system,
              messages,
            }),
          );
        }

        return new Response("Unknown brain", { status: 400 });
      },
    },
  },
});