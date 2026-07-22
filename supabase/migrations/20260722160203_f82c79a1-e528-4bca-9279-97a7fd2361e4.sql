GRANT SELECT (slug, name, agent_name, description, description_es, sort_order, category, display_label, display_label_es)
ON public.agent_personas TO anon, authenticated;
GRANT SELECT ON public.agent_personas_public TO anon, authenticated;
GRANT ALL ON public.agent_personas TO service_role;