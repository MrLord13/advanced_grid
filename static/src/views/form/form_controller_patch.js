/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { BRAND_ALT, brandLogoSrc } from "../brand";

const RULE_MODEL = "advanced.grid.rule";

patch(FormController.prototype, {
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
