-- Restrict access to sensitive persona prompt columns.
-- Drop the fully public read policy and revoke anon access to the base table.
DROP POLICY IF EXISTS "Personas are publicly readable" ON public.agent_personas;
REVOKE SELECT ON public.agent_personas FROM anon;
REVOKE SELECT ON public.agent_personas FROM authenticated;

-- Expose only safe display columns via a view. Server code continues to use
-- the service role to read the full pillar content for prompt compilation.
CREATE OR REPLACE VIEW public.agent_personas_public
WITH (security_invoker = true) AS
SELECT
  slug,
  name,
  agent_name,
  description,
  description_es,
  sort_order
FROM public.agent_personas;

GRANT SELECT ON public.agent_personas_public TO anon, authenticated;

-- Give the view its own permissive read policy through a helper: since views
-- with security_invoker use base-table policies, add a narrow anon SELECT
-- policy on the base table limited to the safe display columns only.
-- Postgres RLS is row-level, not column-level, so we instead re-grant a
-- column-restricted SELECT on the base table for the view's needs.
GRANT SELECT (slug, name, agent_name, description, description_es, sort_order)
  ON public.agent_personas TO anon, authenticated;

CREATE POLICY "Public display columns readable"
  ON public.agent_personas
  FOR SELECT
  TO anon, authenticated
  USING (true);
