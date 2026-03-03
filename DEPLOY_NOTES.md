# Deploy Notes

Order for fresh environment:

1. Run `supabase/sql/stage1_dictionary.sql`
2. Run `supabase/sql/stage2_word_transformation.sql`
3. Run `supabase/sql/stage3_progress_state.sql`
4. Run `supabase/sql/stage4_hardening_checks.sql`
5. Run `supabase/sql/stage6_onoi_notes_private.sql`
6. Run `supabase/sql/stage7_planning_private.sql`
7. Run `supabase/sql/stage8_accounts_social.sql`

After SQL:

- Verify Auth settings:
  - Email/Password enabled
  - Site URL and Redirect URLs set for GitHub Pages
- Hard reload `student_helper` and `item-user` pages.
- Confirm badges:
  - `dictionary` cloud status not failing
  - `progress cloud: ok` after login

Operational model:

- `dictionary`: per-account
- `word_transformation`: shared content, admin-only constructor
- `tenses/structure`: local-first + Supabase sync (`sh_user_state`)

Backup/Restore:

- Use footer buttons in Student Helper:
  - `backup` exports local snapshot JSON
  - `restore` imports snapshot JSON and reloads page
