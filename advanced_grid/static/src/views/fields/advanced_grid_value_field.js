/** @odoo-module **/

import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { RecordSelector } from "@web/core/record_selectors/record_selector";

const RELATIONAL_TYPES = ["many2one", "many2many", "one2many"];
const NUMERIC_TYPES = ["integer", "float", "monetary"];

/**
 * Editor for `advanced.grid.rule.value`.
 *
 * The stored value stays a plain char (an id for relational fields, the
 * technical key for selections), but the editor adapts to the type of the
 * field chosen in `field_name` - the same experience as Odoo's own custom
 * filters, where picking a many2one gives you an autocomplete instead of a
 * free text input.
 *
 * Field metadata comes from the `field` service, i.e. a `fields_get` call on
 * the target model. `ir.model.fields` is deliberately never read: since Odoo
 * 19 it is restricted to `base.group_erp_manager`, so an ordinary user would
 * hit an AccessError.
 */
export class AdvancedGridValueField extends Component {
    static template = "advanced_grid.ValueField";
    static components = { RecordSelector };
    static props = {
        ...standardFieldProps,
        placeholder: { type: String, optional: true },
    };

    setup() {
        this.fieldService = useService("field");
        this.nameService = useService("name");
        this.state = useState({
            ttype: false,
            relation: false,
            selection: [],
            displayValue: "",
        });
        onWillStart(() => this.load(this.props));
        onWillUpdateProps((nextProps) => this.load(nextProps));
    }

    // ------------------------------------------------------------------
    // Data
    // ------------------------------------------------------------------
    get rawValue() {
        return this.props.record.data[this.props.name] || "";
    }

    async load(props) {
        const resModel = props.record.data.model_name || "";
        const path = props.record.data.field_name || "";
        const rawValue = props.record.data[props.name] || "";
        if (
            resModel === this._loadedModel &&
            path === this._loadedPath &&
            rawValue === this._loadedValue
        ) {
            return;
        }
        this._loadedModel = resModel;
        this._loadedPath = path;
        this._loadedValue = rawValue;

        let info = { ttype: false, relation: false, selection: [] };
        if (resModel && path) {
            try {
                const { fieldDef } = await this.fieldService.loadFieldInfo(
                    resModel,
                    path
                );
                if (fieldDef) {
                    info = {
                        ttype: fieldDef.type,
                        relation: fieldDef.relation || false,
                        selection: this.buildSelection(fieldDef),
                    };
                }
            } catch {
                // Unknown or unreadable path: fall back to a text input.
            }
        }
        Object.assign(this.state, info);
        this.state.displayValue = await this.computeDisplayValue(rawValue, info);
    }

    /**
     * `fields_get` already returns the selection labels in the user's
     * language, so nothing has to be translated here.
     */
    buildSelection(fieldDef) {
        if (fieldDef.type === "boolean") {
            return [
                ["True", _t("Yes")],
                ["False", _t("No")],
            ];
        }
        if (fieldDef.type === "selection") {
            return fieldDef.selection || [];
        }
        return [];
    }

    async computeDisplayValue(rawValue, info) {
        if (!rawValue) {
            return "";
        }
        if (RELATIONAL_TYPES.includes(info.ttype) && info.relation) {
            const resId = Number.parseInt(rawValue, 10);
            if (!Number.isNaN(resId)) {
                try {
                    const names = await this.nameService.loadDisplayNames(
                        info.relation,
                        [resId]
                    );
                    return names[resId] || rawValue;
                } catch {
                    return rawValue;
                }
            }
        }
        if (info.selection.length) {
            const option = info.selection.find((opt) => opt[0] === rawValue);
            if (option) {
                return option[1];
            }
        }
        return rawValue;
    }

    // ------------------------------------------------------------------
    // Rendering helpers
    // ------------------------------------------------------------------
    get editor() {
        if (RELATIONAL_TYPES.includes(this.state.ttype) && this.state.relation) {
            return "record";
        }
        if (this.state.selection.length) {
            return "selection";
        }
        return "input";
    }

    get inputType() {
        if (NUMERIC_TYPES.includes(this.state.ttype)) {
            return "number";
        }
        if (this.state.ttype === "date") {
            return "date";
        }
        if (this.state.ttype === "datetime") {
            return "datetime-local";
        }
        return "text";
    }

    get recordId() {
        const resId = Number.parseInt(this.rawValue, 10);
        return Number.isNaN(resId) ? false : resId;
    }

    // ------------------------------------------------------------------
    // Updates
    // ------------------------------------------------------------------
    updateRecord(resId) {
        this.updateRaw(resId ? String(resId) : false);
    }

    updateRaw(value) {
        this.props.record.update({ [this.props.name]: value || false });
    }
}

export const advancedGridValueField = {
    component: AdvancedGridValueField,
    displayName: _t("Grid Rule Value"),
    supportedTypes: ["char"],
    extractProps: ({ attrs }) => ({ placeholder: attrs.placeholder }),
};

registry.category("fields").add("advanced_grid_value", advancedGridValueField);
