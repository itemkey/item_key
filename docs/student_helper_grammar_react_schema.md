# Student Helper Grammar (React) data schema

This is the schema used by the new React/Tailwind grammar section.

React grammar is now the only active runtime. Legacy `tenses.js` is no longer loaded.
`panel-tenses` in `student_helper.html` is now a minimal React host panel.

## Files

- Index: `crate/student_helper/db/tenses/index.json`
- Topic docs: `crate/student_helper/db/tenses/<topic-file>.json`

## Index entry

Each item in `index.json`:

```json
{
  "id": "presentSimple",
  "title": "Present Simple",
  "subtitle": "habit / fact / schedule",
  "hint": "quick hint",
  "file": "presentSimple.json",
  "group": "present",
  "subgroup": "verbs",
  "kind": "tense",
  "levels": ["A2-B1", "B1-B2"]
}
```

Required for React app:

- `id`
- `title`
- `file`

Recommended:

- `subtitle`, `hint`, `group`, `subgroup`, `kind`, `levels`, `aliases`

Used by constructor and compare logic:

- `levels` (for level-aware constructor ranking)
- `kind` (`tense` topics participate in compare mode)

## Topic doc

```json
{
  "id": "presentSimple",
  "title": "Present Simple",
  "subtitle": "...",
  "ruleBlocks": [],
  "practice": {
    "exercises": []
  }
}
```

### `ruleBlocks` supported types

- `heading` (`text`)
- `text` (`text`)
- `highlight` (`title`, `lines[]`)
- `table` (`caption`, `columns[]`, `rows[][]`)
- `examples` (`items[]` with `en`, `ru`)
- `topicLinks` (`title`, `note`, `items[]` with `id`, `label`, `note`)
- `image` (`src`, optional `title`, `note`, `alt`)
- `imageGallery` (`title`, `note`, `items[]` with `src`, optional `alt`, `caption`)

### `practice.exercises` supported kinds

- `choice`
- `input`
- `correction`
- `multi`
- `multi_input`
- `inline_select`
- `match`
- `drag_sort`

The React runner reads `kind` and renders by schema. If a future kind is unknown, it is shown as unsupported JSON block.

Important for mistakes mode:

- Each `item` should have stable `id`.
- Mistakes retry uses stored item ids per topic.

## Local storage keys used by React grammar

- Per-topic progress: `sh_tenses_progress_<topicId>`
  - shape: `{ mastery, best, mistakes }`
- Daily cache: `sh_tenses_daily_v1`
- Last topic: `sh_grammar_last_topic_v1`
- Last React grammar view: `sh_tenses_last_view_react`
- Optional level hint for constructor: `sh_grammar_level_v1`

## Add a new rule/topic

1. Add entry to `index.json`.
2. Create topic file in `db/tenses`.
3. Fill `ruleBlocks` and optional `practice.exercises`.
4. Reload page; topic appears in React grammar section.
