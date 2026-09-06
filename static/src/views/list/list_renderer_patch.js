/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { ListRenderer } from "@web/views/list/list_renderer";
import { useEffect, useState } from "@odoo/owl";

/**
 * Collect the resIds currently displayed, including grouped lists.
 */
function collectResIds(list, acc = []) {
    if (!list) {
        return acc;
    }
    if (list.isGrouped && list.groups) {
        for (const group of list.groups) {
            collectResIds(group.list, acc);
        }
        return acc;
    }
    for (const record of list.records || []) {
        if (typeof record.resId === "number") {
            acc.push(record.resId);
        }
    }
    return acc;
}

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        this.advancedGrid = useService("advanced_grid");
        this.agState = useState({ matches: {} });
        this.agShared = useState(this.advancedGrid.state);

        useEffect(
            () => {
                this.agLoadStyles();
            },
            () => {
                const list = this.props.list;
                const version = this.agShared.version;
                if (!list || !this.advancedGrid.isEnabled(list.resModel)) {
                    return [false, version];
                }
                return [list.resModel, collectResIds(list).join("|"), version];
            }
        );
    },

    async agLoadStyles() {
        const list = this.props.list;
        if (!list || !this.advancedGrid.isEnabled(list.resModel)) {
            if (Object.keys(this.agState.matches).length) {
                this.agState.matches = {};
            }
            return;
        }
        const resIds = collectResIds(list);
        const matches = await this.advancedGrid.evaluate(list.resModel, resIds);
        this.agState.matches = matches;
    },

    /**
     * @param {RelationalRecord} record
     * @returns {Object|null}
     */
    agGetMatch(record) {
        if (!record || typeof record.resId !== "number") {
            return null;
        }
        return this.agState.matches[record.resId] || null;
    },

    getRowClass(record) {
        const classNames = super.getRowClass(...arguments);
        const match = this.agGetMatch(record);
        if (!match || !match.row || !match.row.length) {
            return classNames;
        }
        const extra = match.row.map((id) => `o_ag_rule_${id}`).join(" ");
        return `${classNames} o_ag_styled_row ${extra}`;
    },

    getCellClass(column, record) {
        const classNames = super.getCellClass(...arguments);
        const match = this.agGetMatch(record);
        if (!match || !match.cells || column.type !== "field") {
            return classNames;
        }
        const ruleIds = match.cells[column.name];
        if (!ruleIds || !ruleIds.length) {
            return classNames;
        }
        return `${classNames} ${ruleIds.map((id) => `o_ag_rule_${id}`).join(" ")}`;
    },

    /**
     * The icon is rendered inside the first *field* column so that the table
     * layout, the column count and the header alignment stay untouched.
     */
    agIsFirstFieldColumn(column, record) {
        const columns = this.getColumns(record);
        const first = columns.find((col) => col.type === "field");
        return !!first && first.id === column.id;
    },

    agRowIcon(record) {
        const match = this.agGetMatch(record);
        if (!match || !match.icon) {
            return null;
        }
        return this.advancedGrid.sanitizeIcon(match.icon);
    },

    agIconStyle(icon) {
        return icon && icon.color ? `color:${icon.color};` : "";
    },
});
