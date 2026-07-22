ALTER TABLE public.agent_personas
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS display_label text,
  ADD COLUMN IF NOT EXISTS display_label_es text;

DROP VIEW IF EXISTS public.agent_personas_public;

CREATE VIEW public.agent_personas_public AS
SELECT
  slug,
  name,
  agent_name,
  description,
  description_es,
  category,
  display_label,
  display_label_es,
  sort_order
FROM public.agent_personas;

GRANT SELECT ON public.agent_personas_public TO anon;
GRANT SELECT ON public.agent_personas_public TO authenticated;