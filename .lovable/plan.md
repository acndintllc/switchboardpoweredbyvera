# Plan: Trim Writing Agents to a Single Service Persona

## Goal
You intended to remove about 6 of the 7 Writing assets from the persona roster, but all 7 are still in the database. After this change, **Publication Filter Unit** will be the only Writing asset left. The 9 Business assets stay untouched.

## Current state (verified)
The `agent_personas` table has 7 Writing assets:
1. Marcus — slug `marcus`
2. Maya Okonkwo-Reyes — slug `maya`
3. The Author Duo — Tasha & Becky — slug `author-duo`
4. The Creative Trio — Kim, Fred & Pierre — slug `creative-trio`
5. The Architect — slug `the_architect`
6. The Publication Filter Unit — slug `filter-unit` (KEEP)
7. Global Translation Agent — slug `global-translation` (DELETE)

Business assets (9) are unchanged.

## What changes

### 1. Delete 6 Writing asset rows (data only, no schema change)
Use the `run_sql` tool (not a migration, since this is a data operation) to delete the 6 rows by slug:

```sql
DELETE FROM public.agent_personas
WHERE slug IN ('marcus','maya','author-duo','creative-trio','the_architect','global-translation');
```

This leaves Publication Filter Unit (`filter-unit`) as the sole Writing asset, plus all 9 Business assets. Total roster goes from 16 to 10 personas.

### 2. No frontend or schema changes required
- The persona dropdown reads from the `agent_personas_public` view (`src/routes/index.tsx` line 283), which is a live view over the table. Deleted rows disappear from the menu automatically.
- The `agent_personas_public` view, RLS policies, grants, and the `/api/chat` persona fetcher all remain valid. No code edits.
- Category headers in the dropdown ("Writing assets" / "Business assets") still render from the data, so the "Writing assets" group will now contain just Publication Filter Unit.

## Verification
After the delete runs:
- Re-query `SELECT slug, name, category FROM agent_personas ORDER BY category, sort_order;` and confirm 10 rows remain (1 Writing + 9 Business).
- Confirm the dropdown in the preview shows Publication Filter Unit under Writing assets and no other writing personas.

## Notes
- This is a hard delete, not a hide. The 6 personas and their 6-pillar instruction data are gone for good. If you want any back later, they must be re-inserted with full pillar text.
- Per the project rule, no `*` or `-` characters are used as em dashes in any text this change touches.
