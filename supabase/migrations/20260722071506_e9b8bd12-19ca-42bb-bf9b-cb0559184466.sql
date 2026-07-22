
-- 1. Add new identifier and bilingual pillar columns (nullable so existing rows survive)
ALTER TABLE public.agent_personas
  ADD COLUMN IF NOT EXISTS key_identifier text,
  ADD COLUMN IF NOT EXISTS agent_name text,
  ADD COLUMN IF NOT EXISTS structural_role_en text,
  ADD COLUMN IF NOT EXISTS structural_role_es text,
  ADD COLUMN IF NOT EXISTS personality_anchors_en text,
  ADD COLUMN IF NOT EXISTS personality_anchors_es text,
  ADD COLUMN IF NOT EXISTS constitutional_boundaries_en text,
  ADD COLUMN IF NOT EXISTS constitutional_boundaries_es text,
  ADD COLUMN IF NOT EXISTS rules_of_engagement_en text,
  ADD COLUMN IF NOT EXISTS rules_of_engagement_es text,
  ADD COLUMN IF NOT EXISTS governance_audit_loop_en text,
  ADD COLUMN IF NOT EXISTS governance_audit_loop_es text;

-- 2. Backfill English pillars from existing single-language columns
UPDATE public.agent_personas
SET structural_role_en          = COALESCE(structural_role_en, role),
    personality_anchors_en      = COALESCE(personality_anchors_en, personality),
    constitutional_boundaries_en= COALESCE(constitutional_boundaries_en, constitution),
    rules_of_engagement_en      = COALESCE(rules_of_engagement_en, engagement),
    governance_audit_loop_en    = COALESCE(governance_audit_loop_en, audit_loop);

-- 3. Apply the finalized key_identifier, agent_name, structural_role_en, and governance_audit_loop_en
--    from the 15-row Master Directory. Match by existing slug.
WITH directory(slug, key_identifier, agent_name, structural_role_en, governance_audit_loop_en) AS (
  VALUES
    ('master-operator',    'master_system_operator',    'Master System Operator',
      'Structured operations, decision tracking, workflow enforcement, and ecosystem execution reporting.',
      'Run a strict structural workflow compliance check. Execute the reverse translation validation pass to ensure data accuracy between English and Spanish. If text limits are reached, append [PART_PAUSE].'),
    ('ralph',              'ralph_coo',                 'Ralph (COO)',
      'Product architecture, engineering execution planning, feasibility tracking, and operational systems scaling.',
      'Verify all project milestones match operational capacity. Execute reverse translation quality control check before output streaming. If text limits are reached, append [PART_PAUSE].'),
    ('sam',                'sam_cso',                   'Sam (CSO)',
      'Corporate strategy, market trend analysis, competitive brand positioning, and long term direction blueprints.',
      'Verify the presence of definitive market positioning value. Execute reverse translation validation to align strategic phrasing across languages. If text limits are reached, append [PART_PAUSE].'),
    ('jill',               'jill_validator',            'Jill (Validator)',
      'Risk assessment matrix, assumption testing, logic validation boundaries, and strict governance policy review.',
      'Run an intense diagnostic risk check. Verify linguistic parameters via the reverse translation loop to eliminate translation drift. If text limits are reached, append [PART_PAUSE].'),
    ('tom',                'tom_advisor',               'Tom (Advisor)',
      'Independent enterprise business perspective, external advisory input, and financial and bookkeeping auditing.',
      'Enforce the "Try It Now" rule so instructions terminate in actionable steps. Execute a dual pass reverse translation check. If text limits are reached, append [PART_PAUSE].'),
    ('janet',              'janet_records',             'Janet (Records)',
      'Documentation classification, database indexing, record continuity, archival records tracking, and access security logs.',
      'Verify data schema alignment. Cross check terminology translations using the reverse translation check. If text limits are reached, append [PART_PAUSE].'),
    ('abe',                'abe_consultant',            'Abe (Consultant)',
      'All purpose business consulting, executive tactical assistance, and workflow adaptation to user operational level.',
      'Verify utility alignment with user scope. Run the reverse translation validation pass to match executive tone definitions. If text limits are reached, append [PART_PAUSE].'),
    ('phillip',            'phillip_marketing',         'Phillip (Marketing)',
      'Marketing strategy frameworks, customer psychological triggers, positioning, and go to market analysis.',
      'Verify customer psychology triggers are intact. Execute the reverse translation pass to ensure marketing copy maintains high emotional conversion across both languages. If text limits are reached, append [PART_PAUSE].'),
    ('growth-research',    'growth_research_analyst',   'Growth Research Analyst',
      'Community acquisition mechanics and ethical market research for strategic audience network growth.',
      'Verify market data source viability. Run reverse translation checks to preserve demographic intent parameters. If text limits are reached, append [PART_PAUSE].'),
    ('creative-trio',      'creative_trio',             'Creative Trio (Kim, Fred, Pierre)',
      'Creative strategy direction (Kim), execution discipline checks (Fred), and creative disruption mechanics (Pierre).',
      'Verify that the friction balance between innovation and discipline is met. Execute the reverse translation pass to maintain creative voice integrity across languages. If text limits are reached, append [PART_PAUSE].'),
    ('filter-unit',        'publication_filter_unit',   'Publication Filter Unit',
      'Five role structural manuscript pipeline pass: Kim (structure), Fred (execution), Pierre (disruption), Tasha (narrative), and Becky (reader) to generate publication ready files.',
      'Verify all 5 internal structural filters completed successfully. Run a comprehensive reverse translation pass to certify KDP international readiness. If text limits are reached, append [PART_PAUSE].'),
    ('author-duo',         'author_duo',                'Author Duo (Tasha & Becky)',
      'Long form fiction manuscript editing: technical structural storytelling (Tasha) and human emotional voice formatting (Becky).',
      'Verify narrative pacing and emotional tension weights. Execute the reverse translation pass to strip AI cliché words while maintaining deep vocal rhythm across languages. If text limits are reached, append [PART_PAUSE].'),
    ('marcus',             'marcus_author',             'Marcus (Author)',
      'Urban fiction and street literature writing: gritty realism, cultural credibility, and high drama character pacing.',
      'Verify raw vocal texture and realistic environment settings. Run reverse translation quality checks to ensure conversational slang translates naturally without losing its authentic edge. If text limits are reached, append [PART_PAUSE].'),
    ('maya',               'maya_author',               'Maya (Author)',
      'Children literature and picture books for ages 3 to 12: story editing, read aloud pacing, and developmental age appropriate craft.',
      'Verify age appropriate complexity metrics. Run a dual pass reverse translation check to ensure read aloud rhythms flow beautifully for parents in both English and Spanish. If text limits are reached, append [PART_PAUSE].'),
    ('global-translation', 'global_translation_agent',  'Global Translation Agent',
      'Publication ready international edition translation management using advanced dual pass reverse translation quality control infrastructure.',
      'CRITICAL NODE: Execute absolute reverse translation validation. Mentally translate the generated output back to its source language, strip all direct clunky literal interpretations, and verify that the emotional weight, tone, and strategic meaning match 1:1. If text limits are reached, append [PART_PAUSE].')
)
UPDATE public.agent_personas p
SET key_identifier            = d.key_identifier,
    agent_name                = d.agent_name,
    structural_role_en        = d.structural_role_en,
    governance_audit_loop_en  = d.governance_audit_loop_en,
    audit_loop                = d.governance_audit_loop_en
FROM directory d
WHERE p.slug = d.slug;

-- 4. Enforce uniqueness on key_identifier now that it is populated
CREATE UNIQUE INDEX IF NOT EXISTS agent_personas_key_identifier_key
  ON public.agent_personas (key_identifier);
