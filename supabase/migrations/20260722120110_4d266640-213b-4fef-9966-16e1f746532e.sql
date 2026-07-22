
ALTER TABLE public.agent_personas ADD COLUMN IF NOT EXISTS description_es text;

UPDATE public.agent_personas SET description_es = CASE slug
  WHEN 'marcus' THEN 'Ficción Urbana / Literatura Callejera, realismo y drama'
  WHEN 'master-operator' THEN 'Operaciones estructuradas, seguimiento de decisiones e informes'
  WHEN 'maya' THEN 'Escritora de libros infantiles, libros ilustrados y edades 3 a 12'
  WHEN 'phillip' THEN 'Estratega y analista de marketing, posicionamiento, psicología y crecimiento'
  WHEN 'filter-unit' THEN 'Filtro de manuscritos de cinco roles, Kim, Fred, Pierre, Tasha y Becky'
  WHEN 'ralph' THEN 'Director de operaciones, ejecución, viabilidad, sistemas y operaciones'
  WHEN 'sam' THEN 'Director de estrategia, mercado, marca y posicionamiento competitivo'
  WHEN 'tom' THEN 'Asesor de negocios externo, perspectiva independiente y neutral'
  WHEN 'abe' THEN 'Consultor y asistente de negocios, estrategia con integridad y soporte ejecutivo'
  WHEN 'author-duo' THEN 'Unidad de ficción de formato largo, La Arquitecta y La Poeta Provocadora'
  WHEN 'creative-trio' THEN 'Trío creativo, estructura, ejecución y disrupción'
  WHEN 'global-translation' THEN 'Ediciones internacionales listas para publicar, localización y auditoría de traducción inversa'
  WHEN 'growth-research' THEN 'Adquisición comunitaria e investigación de mercado, descubrimiento ético de audiencias'
  WHEN 'janet' THEN 'Gestora central de documentos, registros, control de versiones y seguridad de acceso'
  WHEN 'jill' THEN 'Validadora, evaluación de riesgo, prueba de supuestos y revisión de gobernanza'
  ELSE description_es
END;
