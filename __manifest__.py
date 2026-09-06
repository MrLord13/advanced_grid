# -*- coding: utf-8 -*-
{
    "name": "Advanced Grid - Color Grid, Icons & Personal List Styling",
    "summary": "Dynamics 365 style personal color coding, row/cell highlighting and "
               "icons for any Odoo list view - without touching the view arch.",
    "description": """
Advanced Grid
=============

Bring the Microsoft Dynamics 365 "Color Grid" experience to Odoo 19.

* Personal rules: every user styles their own lists, nobody else is affected.
* Shared rules: managers publish company-wide colour schemes.
* Row level and cell level colouring, bold / italic, FontAwesome icons.
* Simple condition builder (field / operator / value) or a full domain.
* Rule priority (sequence) - later rules win on conflicting properties.
* Zero impact on the standard Odoo behaviour: no view arch is modified,
  no core method is replaced, only additive OWL patches.
""",
    "version": "19.0.1.0.0",
    "category": "Productivity",
    "author": "AliReza Nemati",
    "maintainer": "ERPishro.com",
    "website": "https://erpishro.com",
    "license": "OPL-1",
    "depends": ["web"],
    "data": [
        "security/advanced_grid_groups.xml",
        "security/ir.model.access.csv",
        "security/advanced_grid_rules.xml",
        "views/advanced_grid_rule_views.xml",
        "views/advanced_grid_menus.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "advanced_grid/static/src/scss/advanced_grid.scss",
            "advanced_grid/static/src/services/advanced_grid_service.js",
            "advanced_grid/static/src/views/list/list_renderer_patch.js",
            "advanced_grid/static/src/views/list/list_renderer_patch.xml",
            "advanced_grid/static/src/views/list/list_controller_patch.js",
            "advanced_grid/static/src/views/list/list_controller_patch.xml",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
