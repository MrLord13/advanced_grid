/** @odoo-module **/

import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { ModelFieldSelector } from "@web/core/model_field_selector/model_field_selector";

/**
 * Char widget that picks a field path on the model stored in `model_name`.
 *
 * It wraps Odoo's own `ModelFieldSelector`, which resolves fields through the
 * `field` service (a `fields_get` call on the target model). That call is
 * allowed for every internal user, unlike reading `ir.model.fields`, which
 * since Odoo 19 is restricted to `base.group_erp_manager`.
 */
export class AdvancedGridFieldPathField extends Component {
    static template = "advanced_grid.FieldPathField";
    static components = { ModelFieldSelector };
    static props = {
        ...standardFieldProps,
        followRelations: { type: Boolean, optional: true },
    };
    static defaultProps = { followRelations: true };

    get resModel() {
        return this.props.record.data.model_name || "";
    }

    get path() {
        return this.props.record.data[this.props.name] || "";
    }

    update(path) {
        this.props.record.update({ [this.props.name]: path || false });
    }
}

export const advancedGridFieldPathField = {
    component: AdvancedGridFieldPathField,
    displayName: _t("Field Path"),
    supportedTypes: ["char"],
    supportedOptions: [
        {
            label: _t("Follow relations"),
            name: "follow_relations",
            type: "boolean",
            default: true,
        },
    ],
    extractProps: ({ options }) => ({
        followRelations: options.follow_relations !== false,
    }),
};

registry.category("fields").add("advanced_grid_field_path", advancedGridFieldPathField);
