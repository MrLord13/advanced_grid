# -*- coding: utf-8 -*-
import ast
import logging
import re

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError

_logger = logging.getLogger(__name__)

# Only plain hex colours are accepted. This is a hard security requirement:
# the value ends up inside a generated <style> tag, so anything else would
# allow CSS injection.
COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

# Safety net so a user cannot slow down every list view of a model.
MAX_ACTIVE_RULES_PER_MODEL = 40

RELATIONAL_TYPES = ("many2one", "one2many", "many2many")

# Curated FontAwesome 4 icons (already bundled with Odoo).
ICON_SELECTION = [
    ("fa-circle", "Circle"),
    ("fa-square", "Square"),
    ("fa-star", "Star"),
    ("fa-flag", "Flag"),
    ("fa-bolt", "Bolt"),
    ("fa-fire", "Fire"),
    ("fa-snowflake-o", "Snowflake"),
    ("fa-thermometer-half", "Thermometer"),
    ("fa-exclamation-triangle", "Warning"),
    ("fa-exclamation-circle", "Alert"),
    ("fa-check-circle", "Check"),
    ("fa-times-circle", "Cross"),
    ("fa-clock-o", "Clock"),
    ("fa-hourglass-half", "Hourglass"),
    ("fa-arrow-up", "Arrow Up"),
    ("fa-arrow-down", "Arrow Down"),
    ("fa-thumbs-up", "Thumbs Up"),
    ("fa-thumbs-down", "Thumbs Down"),
    ("fa-lock", "Lock"),
    ("fa-user", "User"),
    ("fa-money", "Money"),
    ("fa-trophy", "Trophy"),
    ("fa-heart", "Heart"),
    ("fa-bell", "Bell"),
    ("fa-bookmark", "Bookmark"),
    ("fa-paperclip", "Paperclip"),
]

OPERATOR_SELECTION = [
    ("=", "is equal to"),
    ("!=", "is not equal to"),
    (">", "is greater than"),
    (">=", "is greater than or equal to"),
    ("<", "is less than"),
    ("<=", "is less than or equal to"),
    ("ilike", "contains"),
    ("not ilike", "does not contain"),
    ("set", "is set"),
    ("not set", "is not set"),
]


class AdvancedGridRule(models.Model):
    _name = "advanced.grid.rule"
    _description = "Advanced Grid Styling Rule"
    _order = "sequence, id"

    name = fields.Char(string="Description", required=True)
    active = fields.Boolean(default=True)
    sequence = fields.Integer(
        default=10,
        help="Rules are applied from top to bottom. When two rules set the same "
             "property on the same record, the last one wins.",
    )

    # Since Odoo 19 `ir.model` and `ir.model.fields` are readable by
    # `base.group_erp_manager` only, so an ordinary user cannot be offered a
    # many2one on them. The model is stored as a plain technical name and
    # picked through the same raw-SQL selection `ir.filters` uses, while the
    # field paths are picked client side through `fields_get`, which every
    # user is allowed to call.
    model_name = fields.Selection(
        selection="_list_all_models",
        string="Model",
        required=True,
        index=True,
    )
    model_modules = fields.Char(
        string="In Apps", compute="_compute_model_modules", store=True
    )

    scope = fields.Selection(
        [("personal", "Personal"), ("shared", "Shared")],
        default="personal",
        required=True,
        help="Personal rules only affect their owner. Shared rules affect every user.",
    )
    user_id = fields.Many2one(
        "res.users",
        string="Owner",
        default=lambda self: self.env.user,
        ondelete="cascade",
        index=True,
    )

    # ------------------------------------------------------------------
    # Condition
    # ------------------------------------------------------------------
    condition_mode = fields.Selection(
        [("simple", "Simple"), ("domain", "Domain")],
        default="simple",
        required=True,
    )
    field_name = fields.Char(string="Condition Field")
    operator = fields.Selection(OPERATOR_SELECTION, default="=")
    value = fields.Char(string="Value")
    domain_raw = fields.Char(string="Domain", default="[]")
    computed_domain = fields.Char(
        string="Effective Domain", compute="_compute_computed_domain", store=True
    )

    # ------------------------------------------------------------------
    # Styling
    # ------------------------------------------------------------------
    target = fields.Selection(
        [("row", "Whole Row"), ("cell", "Single Cell")],
        default="row",
        required=True,
    )
    cell_field_name = fields.Char(
        string="Column to Style",
        help="Only used when the target is a single cell. "
             "Defaults to the condition field when left empty.",
    )

    background_color = fields.Char(string="Background", default="#FFF3CD")
    text_color = fields.Char(string="Text Colour")
    bold = fields.Boolean()
    italic = fields.Boolean()
    icon = fields.Selection(ICON_SELECTION, string="Icon")
    icon_color = fields.Char(string="Icon Colour")

    # ==================================================================
    # Selections
    # ==================================================================
    @api.model
    def _list_all_models(self):
        """Same approach as ``ir.filters._list_all_models``.

        A raw query is used on purpose: it lets any internal user pick a model
        without granting them read access on ``ir.model``.
        """
        lang = self.env.lang or "en_US"
        self.env.cr.execute(
            "SELECT model, COALESCE(name->>%s, name->>'en_US') FROM ir_model ORDER BY 2",
            [lang],
        )
        return self.env.cr.fetchall()

    # ==================================================================
    # Compute / constraints
    # ==================================================================
    @api.depends("model_name")
    def _compute_model_modules(self):
        for rule in self:
            modules = False
            if rule.model_name:
                # sudo: ir.model is closed to regular users, but the module
                # list is purely informative metadata.
                model = self.env["ir.model"].sudo()._get(rule.model_name)
                modules = model.modules or False
            rule.model_modules = modules

    @api.depends("condition_mode", "field_name", "operator", "value", "domain_raw",
                 "model_name")
    def _compute_computed_domain(self):
        for rule in self:
            rule.computed_domain = repr(rule._build_domain())

    def _resolve_field(self):
        """Return the ORM field targeted by ``field_name``, dotted paths included.

        Reading the registry needs no access right, unlike ``ir.model.fields``.
        """
        self.ensure_one()
        if not self.field_name or not self.model_name or self.model_name not in self.env:
            return None
        model = self.env[self.model_name]
        field = None
        for part in self.field_name.split("."):
            field = model._fields.get(part)
            if field is None:
                return None
            if field.type in RELATIONAL_TYPES:
                model = self.env[field.comodel_name]
        return field

    def _build_domain(self):
        """Return a plain python domain (list of tuples)."""
        self.ensure_one()
        if self.condition_mode == "domain":
            try:
                domain = ast.literal_eval(self.domain_raw or "[]")
            except (ValueError, SyntaxError):
                return []
            return domain if isinstance(domain, (list, tuple)) else []

        if not self.field_name or not self.operator:
            return []

        if self.operator == "set":
            return [(self.field_name, "!=", False)]
        if self.operator == "not set":
            return [(self.field_name, "=", False)]

        return [(self.field_name, self.operator, self._coerce_value())]

    def _coerce_value(self):
        """Convert the char `value` into something the ORM understands."""
        self.ensure_one()
        raw = (self.value or "").strip()
        field = self._resolve_field()
        ttype = field.type if field else "char"

        if ttype == "boolean":
            return raw.lower() in ("1", "true", "yes", "t")
        if ttype == "integer":
            try:
                return int(raw)
            except ValueError:
                return 0
        if ttype in ("float", "monetary"):
            try:
                return float(raw)
            except ValueError:
                return 0.0
        if ttype in RELATIONAL_TYPES:
            if raw.isdigit() and self.operator in ("=", "!="):
                return int(raw)
            return raw
        return raw

    @api.constrains("background_color", "text_color", "icon_color")
    def _check_colors(self):
        for rule in self:
            for value in (rule.background_color, rule.text_color, rule.icon_color):
                if value and not COLOR_RE.match(value.strip()):
                    raise ValidationError(
                        _("'%s' is not a valid colour. Use a hex value such as #FF8800.")
                        % value
                    )

    @api.constrains("condition_mode", "field_name", "model_name")
    def _check_field_name(self):
        for rule in self:
            if rule.condition_mode != "simple" or not rule.field_name:
                continue
            if rule._resolve_field() is None:
                raise ValidationError(
                    _("'%(field)s' is not a valid field of the selected model.",
                      field=rule.field_name)
                )

    @api.constrains("scope", "user_id")
    def _check_scope(self):
        manager = self.env.user.has_group("advanced_grid.group_advanced_grid_manager")
        for rule in self:
            if rule.scope == "shared" and not manager:
                raise ValidationError(
                    _("Only an Advanced Grid Manager can create shared rules.")
                )
            if rule.scope == "personal" and not rule.user_id:
                raise ValidationError(_("A personal rule must have an owner."))

    @api.constrains("model_name", "active", "user_id", "scope")
    def _check_rule_count(self):
        for rule in self.filtered("active"):
            count = self.with_context(active_test=True).search_count(
                [
                    ("model_name", "=", rule.model_name),
                    ("scope", "=", rule.scope),
                    ("user_id", "=", rule.user_id.id),
                ]
            )
            if count > MAX_ACTIVE_RULES_PER_MODEL:
                raise ValidationError(
                    _("You cannot define more than %s active rules on the same model.")
                    % MAX_ACTIVE_RULES_PER_MODEL
                )

    @api.onchange("scope")
    def _onchange_scope(self):
        if self.scope == "shared":
            self.user_id = False
        elif not self.user_id:
            self.user_id = self.env.user

    @api.onchange("model_name")
    def _onchange_model_name(self):
        self.field_name = False
        self.cell_field_name = False
        self.value = False

    @api.onchange("field_name")
    def _onchange_field_name(self):
        # The stored value is an id / technical key tied to the previous field.
        self.value = False

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("scope", "personal") == "personal" and not vals.get("user_id"):
                vals["user_id"] = self.env.uid
        return super().create(vals_list)

    # ==================================================================
    # Public API used by the web client
    # ==================================================================
    @api.model
    def _get_applicable_rules(self, model_name):
        """Rules visible to the current user for `model_name`.

        Record rules already restrict the result to shared rules plus the
        current user's own personal rules, so no sudo() is used here on purpose.
        """
        if not model_name or model_name not in self.env:
            return self.browse()
        return self.search([("model_name", "=", model_name)])

    @api.model
    def get_enabled_models(self):
        """Model names having at least one rule for the current user."""
        groups = self._read_group([], ["model_name"])
        return [row[0] for row in groups if row[0]]

    @api.model
    def advanced_grid_evaluate(self, model_name, res_ids):
        """Return the styling payload for the given records.

        :return: {
            'rules': [{...serialisable rule definition...}],
            'matches': {res_id: {'row': [rule_id], 'cells': {fname: [rule_id]},
                                 'icon': {...} | None}},
        }
        """
        empty = {"rules": [], "matches": {}}
        if not model_name or model_name not in self.env:
            return empty

        rules = self._get_applicable_rules(model_name)
        if not rules:
            return empty

        payload = [
            {
                "id": rule.id,
                "name": rule.name,
                "sequence": rule.sequence,
                "target": rule.target,
                "field": rule._styled_column() or False,
                "background_color": rule.background_color or "",
                "text_color": rule.text_color or "",
                "bold": rule.bold,
                "italic": rule.italic,
                "icon": rule.icon or "",
                "icon_color": rule.icon_color or "",
            }
            for rule in rules
        ]

        matches = {}
        res_ids = [rid for rid in (res_ids or []) if isinstance(rid, int)]
        if not res_ids:
            return {"rules": payload, "matches": matches}

        Model = self.env[model_name]
        try:
            Model.check_access("read")
        except AccessError:
            return empty

        for rule in rules:
            try:
                domain = ast.literal_eval(rule.computed_domain or "[]")
                if not isinstance(domain, (list, tuple)):
                    continue
                matched = Model.search(
                    [("id", "in", res_ids)] + list(domain), limit=len(res_ids)
                ).ids
            except Exception:  # noqa: BLE001 - a broken rule must never break a list
                _logger.warning(
                    "Advanced Grid: rule %s on %s could not be evaluated",
                    rule.id,
                    model_name,
                    exc_info=True,
                )
                continue

            column = rule._styled_column()
            for res_id in matched:
                entry = matches.setdefault(
                    res_id, {"row": [], "cells": {}, "icon": None}
                )
                if rule.target == "row":
                    entry["row"].append(rule.id)
                elif column:
                    entry["cells"].setdefault(column, []).append(rule.id)
                if rule.icon and not entry["icon"]:
                    entry["icon"] = {
                        "icon": rule.icon,
                        "color": rule.icon_color or "",
                        "title": rule.name,
                    }

        return {"rules": payload, "matches": matches}

    def _styled_column(self):
        """Column name a cell rule paints; only direct fields can be columns."""
        self.ensure_one()
        if self.target != "cell":
            return False
        column = self.cell_field_name or self.field_name or ""
        return column if column and "." not in column else False

    # ==================================================================
    # Actions
    # ==================================================================
    def action_delete_selected(self):
        """Header button of the Color Grid dialog.

        Needed because the web client sets `loadActionMenus: target !== "new"`,
        so the cog menu - and therefore the standard Delete entry - is never
        loaded inside a dialog. Header buttons are rendered from the arch and
        are not subject to that restriction.
        """
        if not self:
            raise UserError(_("Select at least one rule to delete."))
        if self.env.user.has_group("advanced_grid.group_advanced_grid_manager"):
            deletable = self
        else:
            deletable = self.filtered(
                lambda r: r.scope == "personal" and r.user_id == self.env.user
            )
        if not deletable:
            raise UserError(
                _("You can only delete your own personal rules. Shared rules are "
                  "managed by an Advanced Grid Manager.")
            )
        deletable.unlink()
        return False

    def action_reset_model_rules(self):
        """Delete every personal rule of the current user for this list."""
        model_name = self.env.context.get("advanced_grid_model_name")
        domain = [("scope", "=", "personal"), ("user_id", "=", self.env.uid)]
        if model_name:
            domain.append(("model_name", "=", model_name))
        rules = self.with_context(active_test=False).search(domain)
        if not rules:
            raise UserError(_("You have no personal rule to remove on this list."))
        rules.unlink()
        # Closing the dialog triggers the client side refresh of the list.
        return {"type": "ir.actions.act_window_close"}

    @api.model
    def action_open_for_model(self, model_name):
        """Used by the 'Color Grid' button of the list view.

        The action is built from the XML record instead of a hand written dict:
        `_for_xml_id` returns the fully resolved payload, including the `views`
        key that the web client requires for an `ir.actions.act_window`.
        """
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "advanced_grid.action_advanced_grid_rule"
        )
        action.update(
            {
                "name": _("Color Grid"),
                "target": "new",
                "domain": [("model_name", "=", model_name)],
                "context": {
                    "default_model_name": model_name,
                    "default_scope": "personal",
                    "advanced_grid_model_name": model_name,
                },
            }
        )
        return action
