import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import headerLogoAsset from "@/assets/switchboard-logo-wide.png.asset.json";


export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password, Switchboard" },
      { name: "description", content: "Set a new password for your Switchboard account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setNotice("Password updated. Redirecting…");
      setTimeout(() => void navigate({ to: "/" }), 1200);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-sky-500/40 bg-sky-950/60 p-6 shadow-[0_0_28px_rgba(56,189,248,0.25)]"
      >
        <h1 className="font-display mb-4 text-lg font-semibold uppercase tracking-[0.2em] text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.7)]">
          Set new password
        </h1>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-sky-500/40 bg-black/40 px-3 py-2 pr-16 text-sm text-white outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-sky-300 hover:text-sky-200"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 w-full rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
        >
          {busy ? "…" : "Update password"}
        </button>
        {notice && <p className="mt-3 text-xs text-sky-200/80">{notice}</p>}
      </form>
    </div>
  );
}