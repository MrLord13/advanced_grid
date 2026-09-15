/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";

/**
 * Catalogue of pickable icons, grouped the way the picker displays them.
 *
 * The labels live here rather than in a python Selection because the
 * catalogue also holds country flags, which are images served by Odoo
 * (`/base/static/img/country_flags/*.png`) and not FontAwesome glyphs.
 */
export const ICON_CATEGORIES = [
    {
        id: "status",
        get label() {
            return _t("Status");
        },
        tab: "fa-check-circle",
        icons: [
            ["fa-circle", () => _t("Circle")],
            ["fa-circle-o", () => _t("Circle Outline")],
            ["fa-square", () => _t("Square")],
            ["fa-square-o", () => _t("Square Outline")],
            ["fa-star", () => _t("Star")],
            ["fa-star-o", () => _t("Star Outline")],
            ["fa-flag", () => _t("Flag")],
            ["fa-flag-o", () => _t("Flag Outline")],
            ["fa-bookmark", () => _t("Bookmark")],
            ["fa-check-circle", () => _t("Check")],
            ["fa-check-square-o", () => _t("Checkbox")],
            ["fa-times-circle", () => _t("Cross")],
            ["fa-ban", () => _t("Blocked")],
            ["fa-exclamation-triangle", () => _t("Warning")],
            ["fa-exclamation-circle", () => _t("Alert")],
            ["fa-question-circle", () => _t("Question")],
            ["fa-info-circle", () => _t("Information")],
            ["fa-bell", () => _t("Bell")],
            ["fa-shield", () => _t("Shield")],
            ["fa-eye", () => _t("Visible")],
            ["fa-eye-slash", () => _t("Hidden")],
        ],
    },
    {
        id: "energy",
        get label() {
            return _t("Temperature and energy");
        },
        tab: "fa-fire",
        icons: [
            ["fa-fire", () => _t("Fire")],
            ["fa-bolt", () => _t("Bolt")],
            ["fa-snowflake-o", () => _t("Snowflake")],
            ["fa-thermometer-half", () => _t("Thermometer")],
            ["fa-tint", () => _t("Drop")],
            ["fa-sun-o", () => _t("Sun")],
            ["fa-moon-o", () => _t("Moon")],
            ["fa-leaf", () => _t("Leaf")],
            ["fa-rocket", () => _t("Rocket")],
            ["fa-lightbulb-o", () => _t("Idea")],
        ],
    },
    {
        id: "time",
        get label() {
            return _t("Time");
        },
        tab: "fa-clock-o",
        icons: [
            ["fa-clock-o", () => _t("Clock")],
            ["fa-hourglass-half", () => _t("Hourglass")],
            ["fa-calendar", () => _t("Calendar")],
            ["fa-calendar-check-o", () => _t("Scheduled")],
            ["fa-history", () => _t("History")],
            ["fa-refresh", () => _t("Refresh")],
        ],
    },
    {
        id: "direction",
        get label() {
            return _t("Direction");
        },
        tab: "fa-arrow-up",
        icons: [
            ["fa-arrow-up", () => _t("Arrow Up")],
            ["fa-arrow-down", () => _t("Arrow Down")],
            ["fa-arrow-circle-up", () => _t("Circled Arrow Up")],
            ["fa-arrow-circle-down", () => _t("Circled Arrow Down")],
            ["fa-long-arrow-up", () => _t("Long Arrow Up")],
            ["fa-long-arrow-down", () => _t("Long Arrow Down")],
            ["fa-level-up", () => _t("Escalate")],
        ],
    },
    {
        id: "people",
        get label() {
            return _t("People");
        },
        tab: "fa-user",
        icons: [
            ["fa-user", () => _t("User")],
            ["fa-users", () => _t("Team")],
            ["fa-user-circle", () => _t("Contact")],
            ["fa-building", () => _t("Company")],
            ["fa-briefcase", () => _t("Business")],
            ["fa-handshake-o", () => _t("Agreement")],
            ["fa-phone", () => _t("Phone")],
            ["fa-envelope", () => _t("Email")],
            ["fa-comments-o", () => _t("Comments")],
        ],
    },
    {
        id: "sales",
        get label() {
            return _t("Money and sales");
        },
        tab: "fa-money",
        icons: [
            ["fa-money", () => _t("Money")],
            ["fa-credit-card", () => _t("Card")],
            ["fa-usd", () => _t("Currency")],
            ["fa-line-chart", () => _t("Line Chart")],
            ["fa-bar-chart", () => _t("Bar Chart")],
            ["fa-pie-chart", () => _t("Pie Chart")],
            ["fa-shopping-cart", () => _t("Cart")],
            ["fa-tag", () => _t("Tag")],
            ["fa-tags", () => _t("Tags")],
            ["fa-trophy", () => _t("Trophy")],
            ["fa-heart", () => _t("Heart")],
            ["fa-thumbs-up", () => _t("Thumbs Up")],
            ["fa-thumbs-down", () => _t("Thumbs Down")],
        ],
    },
    {
        id: "operations",
        get label() {
            return _t("Operations");
        },
        tab: "fa-cube",
        icons: [
            ["fa-truck", () => _t("Delivery")],
            ["fa-cube", () => _t("Product")],
            ["fa-cubes", () => _t("Stock")],
            ["fa-archive", () => _t("Archive Box")],
            ["fa-wrench", () => _t("Repair")],
            ["fa-cog", () => _t("Settings")],
            ["fa-lock", () => _t("Lock")],
            ["fa-unlock", () => _t("Unlock")],
            ["fa-key", () => _t("Key")],
            ["fa-paperclip", () => _t("Paperclip")],
            ["fa-map-marker", () => _t("Location")],
            ["fa-medkit", () => _t("Medical")],
        ],
    },
];

export const FLAG_CATEGORY_ID = "flags";

/** Countries are fetched once per session and shared by every picker. */
let flagsPromise = null;

/**
 * @returns {Promise<Array>} [{value: "flag:US", label: "United States", src}]
 */
export function loadFlagIcons(orm) {
    if (!flagsPromise) {
        flagsPromise = orm
            .searchRead("res.country", [], ["name", "code", "image_url"], {
                order: "name",
            })
            .then((countries) =>
                countries
                    .filter((country) => country.code && country.image_url)
                    .map((country) => ({
                        value: `flag:${country.code}`,
                        label: country.name,
                        src: country.image_url,
                    }))
            )
            .catch(() => {
                flagsPromise = null;
                return [];
            });
    }
    return flagsPromise;
}

/** Flatten the static catalogue into {value, label} entries. */
export function fontIcons() {
    const entries = [];
    for (const category of ICON_CATEGORIES) {
        for (const [value, label] of category.icons) {
            entries.push({ value, label: label() });
        }
    }
    return entries;
}

/** Label of a stored icon value, falling back to the raw value. */
export function iconLabel(value, flags = []) {
    if (!value) {
        return "";
    }
    if (value.startsWith("flag:")) {
        const flag = flags.find((entry) => entry.value === value);
        return flag ? flag.label : value.slice(5).toUpperCase();
    }
    const match = fontIcons().find((entry) => entry.value === value);
    return match ? match.label : value;
}
