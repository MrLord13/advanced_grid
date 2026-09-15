/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { FormController } from "@web/views/form/form_controller";
import { BRAND_ALT, brandLogoSrc } from "../brand";
import { AdvancedGridHelpDialog } from "../../help/advanced_grid_help_dialog";

const RULE_MODEL = "advanced.grid.rule";

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        this.agDialog = useService("dialog");
    },

    agOpenHelp() {
        this.agDialog.add(AdvancedGridHelpDialog, {});
    },

    get agBrandLogo() {
        return brandLogoSrc();
    },

    get agBrandAlt() {
        return BRAND_ALT;
    },

    /**
     * Only the rule form opened as a dialog from the Advanced List carries the
     * brand. The guard also protects the portal: outside a dialog its target
     * (`.modal-header .modal-title`) simply does not exist.
     */
    get agShowBrand() {
        return this.props.resModel === RULE_MODEL && !!this.env.inDialog;
    },
});
