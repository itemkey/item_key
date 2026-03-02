# Student Helper Stage 4 Validation Matrix

Goal: confirm zero-loss behavior after Supabase integration.

## Accounts

- A (regular user)
- B (regular user)
- Admin (`itemkeygithub@gmail.com`)
- Guest (logged out)

## Module Checks

### Dictionary (per-account)

1. A creates section + word -> reload -> exists.
2. A deletes section -> reload -> does not reappear.
3. Switch A -> B -> A data is not visible in B.
4. Logout -> only stock sections visible.
5. Re-login A -> A data restored.

### Word Transformation (shared)

1. A sees practice tasks.
2. B sees same shared task set as A.
3. Admin sees `constructor`; A/B do not.
4. Admin add/delete task -> reload -> change persists for A/B.
5. If cloud unavailable, fallback keeps tasks visible.

### Tenses / Structure Progress (per-account)

1. A completes run and creates mistakes.
2. Reload A -> mastery/mistakes retained.
3. Switch A -> B -> B does not inherit A progress.
4. Return to A -> A progress restored.
5. `progress cloud: ok` while signed in.

## Regression Checks

1. No page reload loops.
2. No `tasks: 0` on GitHub Pages in normal flow.
3. Footer status badges remain readable.

## Backup / Restore Checks

1. Export backup from footer `backup`.
2. Change dictionary/progress data.
3. Restore file from footer `restore`.
4. Reload -> state matches backup snapshot.
