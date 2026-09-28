# -*- coding: utf-8 -*-
import logging

from odoo import models

_logger = logging.getLogger(__name__)


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    def session_info(self):
        """Expose the models having at least one grid rule.

        This lets the web client skip the evaluation RPC entirely for the
        (vast majority of) list views that have no styling rule at all.
        """
        result = super().session_info()
        try:
            result["advanced_grid_models"] = self.env[
                "advanced.grid.rule"
            ].get_enabled_models()
        except Exception:  # noqa: BLE001 - never break the session bootstrap
            _logger.warning("Advanced Grid: unable to build session info", exc_info=True)
            result["advanced_grid_models"] = []
        return result
