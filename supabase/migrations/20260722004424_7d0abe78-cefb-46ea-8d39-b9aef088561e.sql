
CREATE TABLE public.agent_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  constitution TEXT NOT NULL DEFAULT '',
  boundaries TEXT NOT NULL DEFAULT '',
  engagement TEXT NOT NULL DEFAULT '',
  audit_loop TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agent_personas TO anon;
GRANT SELECT ON public.agent_personas TO authenticated;
GRANT ALL ON public.agent_personas TO service_role;

ALTER TABLE public.agent_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Personas are publicly readable"
  ON public.agent_personas FOR SELECT
  USING (true);

INSERT INTO public.agent_personas (slug, name, description, sort_order) VALUES
  ('the-duo',          'The Duo',          'Fiction Writing Team', 10),
  ('the-power-trio',   'The Power Trio',   'Nonfiction Strategy Team', 20),
  ('marcus',           'Marcus',           'Street Lit & Raw Narrative', 30),
  ('the-architect',    'The Architect',    'Documentation & Editorial Layouts', 40),
  ('editorial-scribe', 'Editorial Scribe', 'Memoirs & Biography', 50),
  ('tom',              'Tom',              'Business Advisor & Bookkeeping', 60),
  ('phillip',          'Phillip',          'Marketing Specialist', 70),
  ('ralph',            'Ralph',            'Operations Manager', 80),
  ('janet',            'Janet',            'Record Keeper', 90),
  ('cmo-engine',       'CMO Engine',       'Creative Marketing Officer Visual Prompt Optimizer', 100);
