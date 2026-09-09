/** @odoo-module **/

import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { RecordSelector } from "@web/core/record_selectors/record_selector";

/** fieldId -> Promise<{ttype, relation, selection}> */
const FIELD_INFO_CACHE = new Map();

const RELATIONAL_TYPES = ["many2one", "many2many", "one2many"];
const NUMERIC_TYPES = ["integer", "float", "monetary"];

/**
 * Editor for `advanced.grid.rule.value`.
 *
 * The stored value stays a plain char (an id for relational fields, the
 * technical key for selections), but the editor adapts to the type of the
 * field chosen in `field_id` - the same experience as Odoo's own custom
 * filters, where picking a many2one gives you an autocomplete instead of a
 * free text input.
 */
export class AdvancedGridValueField extends Component {
    static template = "advanced_grid.ValueField";
    static components = { RecordSelector };
    static props = {
        ...standardFieldProps,
        placeholder: { type: String, optional: true },
    };

    setup() {
        this.orm = useService("orm");
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
    /**
     * In Odoo 19 a many2one value is `{id, display_name}`; older shapes are
     * handled too so the widget survives a data format change.
     */
    conditionFieldId(props) {
        const raw = props.record.data.field_id;
        if (!raw) {
            return false;
        }
        if (typeof raw === "number") {
            return raw;
        }
        if (Array.isArray(raw)) {
            return raw[0];
        }
        return raw.id || false;
    }

    get rawValue() {
        return this.props.record.data[this.props.name] || "";
    }

    async load(props) {
        const fieldId = this.conditionFieldId(props);
        const rawValue = props.record.data[props.name] || "";
        if (fieldId === this._loadedFieldId && rawValue === this._loadedValue) {
            return;
        }
        this._loadedFieldId = fieldId;
        this._loadedValue = rawValue;

        let info = { ttype: false, relation: false, selection: [] };
        if (fieldId) {
            if (!FIELD_INFO_CACHE.has(fieldId)) {
                FIELD_INFO_CACHE.set(fieldId, this.fetchFieldInfo(fieldId));
            }
            try {
                info = await FIELD_INFO_CACHE.get(fieldId);
            } catch {
                FIELD_INFO_CACHE.delete(fieldId);
            }
        }
        Object.assign(this.state, info);
        this.state.displayValue = await this.computeDisplayValue(rawValue, info);
    }

    async fetchFieldInfo(fieldId) {
        const [record] = await this.orm.read(
            "ir.model.fields",
            [fieldId],
            ["ttype", "relation", "model", "name"]
        );
        const info = {
            ttype: record.ttype,
            relation: record.relation || false,
            selection: [],
        };
        if (record.ttype === "boolean") {
            info.selection = [
                ["True", _t("Yes")],
                ["False", _t("No")],
            ];
        } else if (record.ttype === "selection") {
            // fields_get is available to every user and already returns the
            // labels in the user's language.
            const fieldsInfo = await this.orm.call(record.model, "fields_get", [
                [record.name],
                ["selection"],
            ]);
            info.selection = (fieldsInfo[record.name] || {}).selection || [];
        }
        return info;
    }

    async computeDisplayValue(rawValue, info) {
        if (!rawValue) {
            return "";
        }
        if (RELATIONAL_TYPES.includes(info.ttype) && info.relation) {
            const resId = Number.parseInt(rawValue, 10);
            if (!Number.isNaN(resId)) {
                try {
                    const names = await this.nameService.loadDisplayNames(info.relation, [
                        resId,
                    ]);
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
