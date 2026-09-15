# -*- coding: utf-8 -*-
import json
import logging
import re

from odoo.http import request
from odoo.addons.web.controllers.export import ExcelExport, ExportXlsxWriter

_logger = logging.getLogger(__name__)

HEX_SHORT_RE = re.compile(r"^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$")
HEX_LONG_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

# Beyond this, evaluating the rules would cost more than the colours are worth.
MAX_STYLED_EXPORT_ROWS = 20000


def _xlsx_color(value):
    """xlsxwriter wants a full #RRGGBB string."""
    if not value:
        return None
    value = value.strip()
    if HEX_LONG_RE.match(value):
        return value
    short = HEX_SHORT_RE.match(value)
    if short:
        return "#" + "".join(component * 2 for component in short.groups())
    return None


def _rule_format(rule):
    """Translate a grid rule into xlsxwriter format properties."""
    props = {}
    background = _xlsx_color(rule.get("background_color"))
    font = _xlsx_color(rule.get("text_color"))
    if background:
        props["bg_color"] = background
    if font:
        props["font_color"] = font
    if rule.get("bold"):
        props["bold"] = True
    if rule.get("italic"):
        props["italic"] = True
    return props


class AdvancedGridXlsxWriter(ExportXlsxWriter):
    """Writer that merges the grid rule styling into the standard cell format.

    Rather than duplicating `write_cell` - which carries the type handling,
    the binary field check and the string length guard - only `write` is
    overridden. It receives the format `write_cell` already chose, and swaps it
    for an equivalent format enriched with the rule's colours.
    """

    def __init__(self, fields, columns_headers, row_count, row_styles=None):
        super().__init__(fields, columns_headers, row_count)
        self.ag_row_styles = row_styles or {}
        self._ag_format_cache = {}
        decimal_places = request.env["res.currency"]._read_group(
            [], aggregates=["decimal_places:max"]
        )[0][0]
        places = (decimal_places or 2) * "0"
        # The parent keeps its formats as objects only, so their properties are
        # mapped back here by identity in order to rebuild an enriched format.
        self._ag_base_props = {
            id(self.base_style): {"text_wrap": True},
            id(self.date_style): {"text_wrap": True, "num_format": "yyyy-mm-dd"},
            id(self.datetime_style): {
                "text_wrap": True,
                "num_format": "yyyy-mm-dd hh:mm:ss",
            },
            id(self.float_style): {"text_wrap": True, "num_format": "#,##0.00"},
            id(self.monetary_style): {
                "text_wrap": True,
                "num_format": f"#,##0.{places}",
            },
        }

    def _ag_style_for(self, row, column):
        entry = self.ag_row_styles.get(row)
        if not entry:
            return None
        row_props, cell_props = entry
        return cell_props.get(column) or row_props

    def _ag_merged_format(self, style, props):
        key = (id(style) if style is not None else 0, tuple(sorted(props.items())))
        if key not in self._ag_format_cache:
            merged = dict(self._ag_base_props.get(id(style), {"text_wrap": True}))
            merged.update(props)
            self._ag_format_cache[key] = self.workbook.add_format(merged)
        return self._ag_format_cache[key]

    def write(self, row, column, cell_value, style=None):
        props = self._ag_style_for(row, column)
        if props:
            style = self._ag_merged_format(style, props)
        super().write(row, column, cell_value, style)


class AdvancedGridExcelExport(ExcelExport):
    """Applies the user's Advanced List colours to the xlsx export."""

    def from_data(self, fields, columns_headers, rows):
        try:
            row_styles = self._ag_build_row_styles(fields, rows)
        except Exception:  # noqa: BLE001 - an export must never fail over colours
            _logger.warning("Advanced Grid: could not style the export", exc_info=True)
            row_styles = None

        if not row_styles:
            return super().from_data(fields, columns_headers, rows)

        with AdvancedGridXlsxWriter(
            fields, columns_headers, len(rows), row_styles
        ) as xlsx_writer:
            for row_index, row in enumerate(rows):
                for cell_index, cell_value in enumerate(row):
                    xlsx_writer.write_cell(row_index + 1, cell_index, cell_value)

        return xlsx_writer.value

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _ag_export_params(self):
        """The export payload, re-read from the request.

        Controllers are instantiated once per registry, so nothing may be
        stashed on `self` between `base()` and `from_data()`.
        """
        raw = request.params.get("data")
        return json.loads(raw) if raw else {}

    def _ag_build_row_styles(self, fields, rows):
        """{excel_row: (row_props, {column_index: cell_props})}"""
        params = self._ag_export_params()
        model = params.get("model")
        if not model or model not in request.env:
            return None
        if params.get("import_compat"):
            # A technical export meant to be re-imported: leave it untouched.
            return None
        if not rows or len(rows) > MAX_STYLED_EXPORT_ROWS:
            return None

        Model = request.env[model].with_context(
            import_compat=params.get("import_compat"), **(params.get("context") or {})
        )
        ids = params.get("ids")
        records = Model.browse(ids) if ids else Model.search(params.get("domain") or [])

        # `export_data` emits extra rows when an x2many sub-field is exported,
        # so the row/record mapping is only unambiguous when the counts match.
        if len(records) != len(rows):
            return None

        payload = request.env["advanced.grid.rule"].advanced_grid_evaluate(
            model, records.ids
        )
        rules = payload.get("rules") or []
        matches = payload.get("matches") or {}
        if not rules or not matches:
            return None

        rules = sorted(rules, key=lambda rule: (rule["sequence"], rule["id"]))
        order = {rule["id"]: index for index, rule in enumerate(rules)}
        props_by_rule = {rule["id"]: _rule_format(rule) for rule in rules}

        column_index = {}
        for index, field in enumerate(fields):
            column_index.setdefault(field.get("name"), index)

        styles = {}
        for row_index, res_id in enumerate(records.ids):
            match = matches.get(res_id) or matches.get(str(res_id))
            if not match:
                continue
            row_rule = (match.get("row") or [None])[0]
            row_props = props_by_rule.get(row_rule) if row_rule else None

            cell_props = {}
            for field_name, rule_ids in (match.get("cells") or {}).items():
                index = column_index.get(field_name)
                if index is None or not rule_ids:
                    continue
                candidate = rule_ids[0]
                # Same arbitration as the list view: the topmost rule wins.
                if row_rule and order.get(candidate, 0) >= order.get(row_rule, 0):
                    continue
                props = props_by_rule.get(candidate)
                if props:
                    cell_props[index] = props

            if row_props or cell_props:
                styles[row_index + 1] = (row_props, cell_props)

        return styles or None
