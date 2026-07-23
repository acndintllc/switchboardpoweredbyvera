
REVOKE SELECT ON public.agent_personas FROM anon, authenticated;
GRANT SELECT (id, slug, name, description, description_es, agent_name, category, display_label, display_label_es, sort_order, key_identifier) ON public.agent_personas TO anon, authenticated;
GRANT ALL ON public.agent_personas TO service_role;
