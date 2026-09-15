# Plan: Retire the Writing Group, Convert the Filter to a Business Document Filter

## Goal
Cut the roster down to business only. All 6 author and translation personas are deleted, and the Publication Filter Unit is converted into a **Business Document Filter** with an internal roster reduced from five roles to just Kim and Tasha.

## Current state (verified in the database)
Writing assets (7):
1. Marcus — `marcus`
2. Maya Okonkwo-Reyes — `maya`
3. The Author Duo, Tasha & Becky — `author-duo`
4. The Creative Trio, Kim, Fred & Pierre — `creative-trio`
5. The Architect — `the_architect`
6. The Publication Filter Unit — `filter-unit` (five role pipeline: Kim structure, Fred execution, Pierre disruption, Tasha narrative, Becky reader)
7. Global Translation Agent — `global-translation`

Business assets (9): Master System Operator, Growth Research Analyst, Janet, Phillip, Ralph, Sam, Tom, Abe, Jill. These stay exactly as they are.

## What changes

### 1. Delete the 6 writing personas
Data operation, no schema change:

```sql
DELETE FROM public.agent_personas
WHERE slug IN ('marcus','maya','author-duo','creative-trio','the_architect','global-translation');
```

### 2. Convert `filter-unit` into the Business Document Filter
Update the same row in place so it keeps its slug and existing wiring:

- `category` moves from "Writing assets" to "Business assets"
- `agent_name` becomes "Business Document Filter"
- `name` becomes "Business Document Filter"
- `display_label` becomes "[Service] Business Document Filter, Document Review and Editing"
- `display_label_es` becomes "[Servicio] Filtro de Documentos de Negocios, Revisión y edición de documentos"
- `description` / `description_es` rewritten to "Two role business document pass, Kim (structure) and Tasha (narrative)"
- `sort_order` set to place it at the end of the Business group

### 3. Rewrite its 6 pillars for two roles, business scope
Every pillar currently describes a five role manuscript pipeline aimed at publication ready book files. Each is rewritten so that:

- Only **Kim (structure)** and **Tasha (narrative)** remain. Fred, Pierre, and Becky are removed from every pillar.
- The subject matter shifts from manuscripts and book publishing to business documents: reports, proposals, memos, policies, decks, and client facing deliverables.
- The Global Translation Reverse-Translation QC Pass stays embedded in the governance audit loop, consistent with the rest of the roster.
- Both the `_en` and `_es` pillar columns are updated, plus the legacy base columns (`role`, `personality`, `constitution`, `boundaries`, `engagement`, `audit_loop`) so the server prompt compiler has no stale fallback text.

### 4. No frontend or schema changes required
- The dropdown reads from the `agent_personas_public` view, so deleted rows vanish and the converted row reappears under the Business group automatically.
- The "Writing assets" group header simply renders nothing once no rows carry that category. The existing Spanish label mapping in `src/routes/index.tsx` is left in place and harmless.
- RLS, grants, the public view, and the `/api/chat` pillar fetcher all stay valid.

## Result
10 personas total, all under Business assets: the 9 existing business agents plus the Business Document Filter.

## Verification
- Re-query the table and confirm 10 rows, all `category = 'Business assets'`.
- Confirm the filter row shows the new name, labels, and two role pillar text with no mention of Fred, Pierre, or Becky.
- Open the preview and confirm the persona dropdown shows one group with 10 entries.

## Notes
- The 6 deletions are permanent. Their 6-pillar instruction text is not recoverable without re-seeding it.
- No `*` or `-` characters are used as em dashes in any new text.
