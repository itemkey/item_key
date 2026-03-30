# Deploy Notes

Order for fresh environment:

1. Run `supabase/sql/stage1_dictionary.sql`
2. Run `supabase/sql/stage2_word_transformation.sql`
3. Run `supabase/sql/stage3_progress_state.sql`
4. Run `supabase/sql/stage4_hardening_checks.sql`
5. Run `supabase/sql/stage6_onoi_notes_private.sql`
6. Run `supabase/sql/stage7_planning_private.sql`
7. Run `supabase/sql/stage8_accounts_social.sql`
8. Run `supabase/sql/stage9_planning_collab.sql`
9. Run `supabase/sql/stage10_planning_shared_personal_tasks.sql`
10. Run `supabase/sql/stage11_economy_roles_public_dictionary.sql`
11. Run `supabase/sql/stage15_planning_schedule.sql`
12. Run `supabase/sql/stage16_planning_personal_schedule.sql`
13. Run `supabase/sql/stage18_schedule_v2.sql` (**resets schedule domain data**)
14. Run `supabase/sql/stage19_schedule_series_compact.sql`
15. (Optional) Run `supabase/sql/stage12_seed_public_user_dictionaries.sql`
16. (Optional, if stage12 was used) Run `supabase/sql/stage17_fix_memorize_spelling.sql`
17. (Optional, force refresh Unit 24) Run `supabase/sql/stage20_force_update_destination_b1_unit24.sql`

After SQL:

- Verify Auth settings:
  - Email/Password enabled
  - Site URL and Redirect URLs set for GitHub Pages
- Hard reload `student_helper` and `item-user` pages.
- Confirm badges:
  - `dictionary` cloud status not failing
  - `progress cloud: ok` after login
  - `planning cloud: live` after opening planning board
  - `planning` shows board-only UI (no schedule tab/button)
  - `crate/schedule/schedule.html` opens and can create/edit plans + slots
  - assistant `Занятости` tab creates `ik_sched_busy_series` rows
  - assistant can generate suggestions and apply them to real blocks
  - settings save in `ik_sched_prefs`

Operational model:

- `dictionary`: per-account
- `word_transformation`: shared content, admin-only constructor
- `tenses/structure`: local-first + Supabase sync (`sh_user_state`)

Backup/Restore:

- Use footer buttons in Student Helper:
  - `backup` exports local snapshot JSON
  - `restore` imports snapshot JSON and reloads page
