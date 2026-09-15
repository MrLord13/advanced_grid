/** @odoo-module **/

import { Component } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";
import { brandLogoSrc } from "../views/brand";
import { helpSections } from "./advanced_grid_help_content";

/**
 * In-app user guide, shown from the question mark next to the brand logo.
 *
 * The content follows the interface language of the user: every sentence goes
 * through `_t()`, so a Persian user reads the Persian guide and everybody else
 * reads the English one.
 */
export class AdvancedGridHelpDialog extends Component {
    static template = "advanced_grid.HelpDialog";
    static components = { Dialog };
    static props = { close: Function };

    get title() {
        return _t("Advanced List - User guide");
    }

    get sections() {
        return helpSections();
    }

    get logo() {
        return brandLogoSrc();
    }

    get closeLabel() {
        return _t("Close");
    }
}
