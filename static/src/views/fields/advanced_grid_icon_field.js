/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { usePopover } from "@web/core/popover/popover_hook";
import { useAutofocus } from "@web/core/utils/hooks";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

// The colour comes from our own hex validated field, but it is re-checked
// before being written into an inline style.
const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ICON_RE = /^fa-[a-z0-9-]+$/;

function safeIconStyle(color) {
    return typeof color === "string" && COLOR_RE.test(color.trim())
        ? `color:${color.trim()};`
        : "";
}

/**
 * Popover content: a search box and a grid of clickable icons.
 */
export class AdvancedGridIconPicker extends Component {
    static template = "advanced_grid.IconPicker";
    static props = {
        options: Array,
        selected: [String, Boolean],
        iconStyle: { type: String, optional: true },
        onSelect: Function,
        close: Function,
    };

    setup() {
        this.state = useState({ query: "" });
        useAutofocus();
    }

    get filteredOptions() {
        const query = this.state.query.trim().toLowerCase();
        if (!query) {
            return this.props.options;
        }
        return this.props.options.filter(
            ([value, label]) =>
                label.toLowerCase().includes(query) ||
                value.slice(3).replace(/-/g, " ").includes(query)
        );
    }

    select(value) {
        this.props.onSelect(value);
        this.props.close();
    }
}

/**
 * Field widget for the `icon` selection.
 *
 * A plain selection shows the icon *names* as text, which tells the user
 * nothing about what the icon actually looks like. This renders the glyphs
 * themselves, in the colour configured on the rule.
 */
export class AdvancedGridIconField extends Component {
    static template = "advanced_grid.IconField";
    static props = { ...standardFieldProps };

    setup() {
        this.popover = usePopover(AdvancedGridIconPicker, {
            popoverClass: "o_ag_icon_picker_popover",
        });
    }

    get options() {
        const selection = this.props.record.fields[this.props.name].selection || [];
        return selection.filter(([value]) => value && ICON_RE.test(value));
    }

    get value() {
        const value = this.props.record.data[this.props.name];
        return value && ICON_RE.test(value) ? value : false;
    }

    get label() {
        const option = this.options.find(([value]) => value === this.value);
        return option ? option[1] : "";
    }

    get iconStyle() {
        return safeIconStyle(this.props.record.data.icon_color);
    }

    get emptyLabel() {
        return _t("Choose an icon");
    }

    open(ev) {
        if (this.props.readonly) {
            return;
        }
        this.popover.open(ev.currentTarget, {
            options: this.options,
            selected: this.value,
            iconStyle: this.iconStyle,
            onSelect: (value) =>
                this.props.record.update({ [this.props.name]: value || false }),
        });
    }
}

export const advancedGridIconField = {
    component: AdvancedGridIconField,
    displayName: _t("Icon Picker"),
    supportedTypes: ["selection"],
};

registry.category("fields").add("advanced_grid_icon", advancedGridIconField);
