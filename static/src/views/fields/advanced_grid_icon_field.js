/** @odoo-module **/

import { Component, onWillStart, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { usePopover } from "@web/core/popover/popover_hook";
import { useAutofocus, useService } from "@web/core/utils/hooks";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import {
    FLAG_CATEGORY_ID,
    ICON_CATEGORIES,
    iconLabel,
    loadFlagIcons,
} from "./advanced_grid_icon_catalog";

// The colour comes from our own hex validated field, but it is re-checked
// before being written into an inline style.
const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function safeIconStyle(color) {
    return typeof color === "string" && COLOR_RE.test(color.trim())
        ? `color:${color.trim()};`
        : "";
}

/**
 * Popover content: category shortcuts, a search box, and sections of icons.
 */
export class AdvancedGridIconPicker extends Component {
    static template = "advanced_grid.IconPicker";
    static props = {
        selected: [String, Boolean],
        iconStyle: { type: String, optional: true },
        onSelect: Function,
        close: Function,
    };

    setup() {
        this.orm = useService("orm");
        this.rootRef = useRef("root");
        this.state = useState({ query: "", flags: [] });
        useAutofocus();
        onWillStart(async () => {
            this.state.flags = await loadFlagIcons(this.orm);
        });
    }

    get flagCategoryLabel() {
        return _t("Country flags");
    }

    /**
     * @returns {Array} [{id, label, tab, entries: [{value, label, src}]}]
     */
    get sections() {
        const query = this.state.query.trim().toLowerCase();
        const matches = (entry) =>
            !query ||
            entry.label.toLowerCase().includes(query) ||
            entry.value.toLowerCase().includes(query);

        const sections = [];
        for (const category of ICON_CATEGORIES) {
            const entries = category.icons
                .map(([value, label]) => ({ value, label: label() }))
                .filter(matches);
            if (entries.length) {
                sections.push({
                    id: category.id,
                    label: category.label,
                    tab: category.tab,
                    entries,
                });
            }
        }
        const flags = this.state.flags.filter(matches);
        if (flags.length) {
            sections.push({
                id: FLAG_CATEGORY_ID,
                label: this.flagCategoryLabel,
                tab: false,
                entries: flags,
            });
        }
        return sections;
    }

    get hasResults() {
        return this.sections.length > 0;
    }

    scrollTo(categoryId) {
        const root = this.rootRef.el;
        const section = root && root.querySelector(`[data-category="${categoryId}"]`);
        if (section) {
            section.scrollIntoView({ block: "start", behavior: "smooth" });
        }
    }

    select(value) {
        this.props.onSelect(value);
        this.props.close();
    }
}

/**
 * Field widget for the `icon` char.
 *
 * A raw text input would tell the user nothing about what the icon looks
 * like, so the glyph itself - or the country flag image - is rendered.
 */
export class AdvancedGridIconField extends Component {
    static template = "advanced_grid.IconField";
    static props = { ...standardFieldProps };

    setup() {
        this.orm = useService("orm");
        this.state = useState({ flags: [] });
        this.popover = usePopover(AdvancedGridIconPicker, {
            popoverClass: "o_ag_icon_picker_popover",
        });
        onWillStart(async () => {
            if (this.isFlag) {
                this.state.flags = await loadFlagIcons(this.orm);
            }
        });
    }

    get value() {
        return this.props.record.data[this.props.name] || false;
    }

    get isFlag() {
        return typeof this.value === "string" && this.value.startsWith("flag:");
    }

    get flagSrc() {
        const flag = this.state.flags.find((entry) => entry.value === this.value);
        return flag ? flag.src : false;
    }

    get label() {
        return iconLabel(this.value, this.state.flags);
    }

    get iconStyle() {
        return safeIconStyle(this.props.record.data.icon_color);
    }

    get emptyLabel() {
        return _t("Choose an icon");
    }

    async open(ev) {
        if (this.props.readonly) {
            return;
        }
        this.popover.open(ev.currentTarget, {
            selected: this.value,
            iconStyle: this.iconStyle,
            onSelect: async (value) => {
                await this.props.record.update({ [this.props.name]: value || false });
                if (this.isFlag && !this.state.flags.length) {
                    this.state.flags = await loadFlagIcons(this.orm);
                }
            },
        });
    }
}

export const advancedGridIconField = {
    component: AdvancedGridIconField,
    displayName: _t("Icon Picker"),
    supportedTypes: ["char"],
};

registry.category("fields").add("advanced_grid_icon", advancedGridIconField);
