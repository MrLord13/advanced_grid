# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ResUsers(models.Model):
    _inherit = "res.users"

    advanced_grid_rule_ids = fields.One2many(
        "advanced.grid.rule",
        "user_id",
        string="List Personalisation",
        domain=[("scope", "=", "personal")],
        context={"active_test": False},
        help="Every list view this user has personalised with their own "
             "colours and icons.",
    )
    advanced_grid_rule_count = fields.Integer(
        string="Personalised Lists", compute="_compute_advanced_grid_rule_count"
    )

    @api.depends("advanced_grid_rule_ids")
    def _compute_advanced_grid_rule_count(self):
        for user in self:
            user.advanced_grid_rule_count = len(user.advanced_grid_rule_ids)

    def action_advanced_grid_clear_personalisation(self):
        """Remove every personal grid rule of the selected users."""
        self.advanced_grid_rule_ids.unlink()
        return False
