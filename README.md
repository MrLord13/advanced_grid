# Advanced Grid — Color Grid, Icons & Personal List Styling (Odoo 19)

Brings the Microsoft Dynamics 365 **Color Grid** experience to every Odoo list view.

Author: **AliReza Nemati** — [ERPishro.com](https://erpishro.com)

---

## What it does

| Dynamics 365 | Advanced Grid (Odoo 19) |
|---|---|
| `Color Grid` command bar button | `Color Grid` button next to **New** in every list view |
| Row colouring by field value | Rule with target **Whole Row** |
| Cell colouring | Rule with target **Single Cell** + column selection |
| Status icons at row start | FontAwesome icon injected in the first field cell |
| Personal view customisation | `Personal` scope — invisible to other users |
| Admin-published scheme | `Shared` scope — reserved to *Advanced Grid Manager* |
| Rule ordering | `sequence` handle, the topmost matching rule wins |

## Installation

1. Copy the `advanced_grid` folder into your addons path.
2. Update the apps list, install **Advanced Grid**.
3. Open any list view — a **Color Grid** button appears next to **New**.

## How a rule is evaluated

1. On every list load the renderer collects the visible `res_id`s
   (including grouped lists, one pass per group).
2. A single RPC `advanced.grid.rule.advanced_grid_evaluate(model, res_ids)`
   returns the rule definitions plus the matched ids per rule.
3. The renderer arbitrates by sequence: the topmost matching row rule gives
   the `<tr>` its class, and a cell rule only claims its column when it
   outranks that row rule.
4. The service writes **one** `<style>` tag holding a class per rule. Row and
   cell selectors are built with *identical* specificity (four classes, two
   elements) and every row block is emitted before every cell block, so the
   cascade merely applies the decision the renderer already made.

No RPC is issued at all for models that have no rule: the list of models
carrying rules is published once in `session_info`.

## Why this does not break standard Odoo

* No view arch is modified and no `ir.ui.view` record is touched.
* `getRowClass` and `getCellClass` are **extended** through `patch()` and always
  call `super()` first — the native `decoration-*` attributes keep working.
* No extra `<td>` and no change to the `<tr>` structure, so column count,
  frozen widths, optional columns, resequencing and the editable list all
  behave exactly as before.
* A broken or unauthorised rule is logged and skipped; the list still renders.
* Colours are validated server-side **and** client-side against a strict hex
  regex before reaching the generated stylesheet (no CSS injection).
* Matching is done with a normal `search()` in the user's own environment,
  so record rules and access rights are fully respected.

## No extra access rights needed

Since Odoo 19 both `ir.model` and `ir.model.fields` are readable by
`base.group_erp_manager` only (`0,0,0,0` for `base.group_user` in base's
`ir.model.access.csv`). The module therefore never exposes them to users:

* the model is stored as a technical name and picked through a raw-SQL
  selection, the same approach as `ir.filters.model_id`;
* field paths are picked with `ModelFieldSelector`, which resolves fields
  through a `fields_get` call - allowed for everyone;
* the value editor gets its type information from the same `field` service;
* server side, field types are resolved from the ORM registry, which needs no
  access right at all.

No ACL of the standard installation is widened by installing this module.

## Security

| Group | Personal rules | Shared rules |
|---|---|---|
| Internal user (`base.group_user`) | full CRUD on own | read only |
| Advanced Grid Manager | full | full |

Two `ir.rule` records split read (own + shared) from write (own personal only).

## Limits and known trade-offs

* Rule background colours use `!important`, so the Bootstrap selection
  highlight is replaced by a subtle inset overlay on styled rows.
* The `Domain` mode is parsed with `ast.literal_eval`, so dynamic helpers such
  as `context_today()` are not accepted — by design, for safety.
* Max 40 active rules per model / scope / user.
* Relational condition fields store an id, so only `=`, `!=`, `is set` and
  `is not set` are meaningful there; use Domain mode for text matching.
* Cell styling only accepts direct fields - a dotted path is not a column.
* Grouped list totals rows are not styled (only record rows are).

## Roadmap (not in 1.0)

* Pin / prioritise individual records to the top of a list per user.
* Per-user override to switch off a shared rule.
* Kanban and Gantt support.
* Auto-generate a full colour scheme from a selection field in one click.
