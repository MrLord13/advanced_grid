/** @odoo-module **/

import { user } from "@web/core/user";

const LOGO_FA = "/advanced_grid/static/src/img/erpishro_logo_fa.png";
const LOGO_EN = "/advanced_grid/static/src/img/erpishro_logo_en.png";

/**
 * Logo matching the user's interface language.
 *
 * `user.lang` is already normalised to a BCP 47 tag by `pyToJsLocale`, so a
 * Persian user gets "fa-IR" and the check only has to look at the prefix.
 * Anything else falls back to the English logo.
 */
export function brandLogoSrc() {
    const lang = (user.lang || "").toLowerCase();
    return lang.startsWith("fa") ? LOGO_FA : LOGO_EN;
}

export const BRAND_ALT = "ERPishro.com";
