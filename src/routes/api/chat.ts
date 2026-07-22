import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Brain = "claude" | "chatgpt" | "grok" | "image";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  brain: Brain;
  personaSlug: string;
  messages: Msg[];
}

const PILLAR_LABELS: Array<[keyof PersonaRow, string]> = [
  ["role", "ROLE"],
  ["personality", "PERSONALITY"],
  ["constitution", "CONSTITUTION"],
  ["boundaries", "BOUNDARIES"],
  ["engagement", "ENGAGEMENT"],
  ["audit_loop", "AUDIT LOOP"],
];

interface PersonaRow {
  name: string;
  description: string;
  role: string;
  personality: string;
  constitution: string;
  boundaries: string;
  engagement: string;
  audit_loop: string;
}

function compileSystemPrompt(p: PersonaRow): string {
  const header = `You are "${p.name}" — ${p.description}.`;
  const pillars = PILLAR_LABELS.map(([k, label]) => {
    const v = (p[k] ?? "").toString().trim();
    if (!v) return null;
    return `## ${label}\n${v}`;
  })
    .filter(Boolean)
    .join("\n\n");
  return pillars ? `${header}\n\n${pillars}` : header;
}

async function fetchPersona(slug: string): Promise<PersonaRow | null> {
  const supa = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supa
    .from("agent_personas")
    .select("name,description,role,personality,constitution,boundaries,engagement,audit_loop")
    .eq("slug", slug)
    .maybeSingle();
  return (data as PersonaRow | null) ?? null;
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
      model: "dall-e-3",
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
  const url = json?.data?.[0]?.url ?? null;
  return Response.json({ imageUrl: url, prompt: combined });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const { brain, personaSlug, messages } = body;
        if (!brain || !personaSlug || !Array.isArray(messages)) {
          return new Response("Missing brain, personaSlug, or messages", { status: 400 });
        }

        const persona = await fetchPersona(personaSlug);
        if (!persona) return new Response("Persona not found", { status: 404 });
        const system = compileSystemPrompt(persona);

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