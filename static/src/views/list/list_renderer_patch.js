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
        this.agState = useState({ matches: {}, order: {} });
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
                this.agState.order = {};
            }
            return;
        }
        const resIds = collectResIds(list);
        const { matches, order } = await this.advancedGrid.evaluate(
            list.resModel,
            resIds
        );
        this.agState.matches = matches;
        this.agState.order = order;
    },

    /**
     * Priority is top-down: the rule sitting highest in the Advanced List wins.
     *
     * The server returns every matching rule id already ordered by sequence,
     * so the first entry of each array is the highest priority one.
     */
    agRowRule(record) {
        const match = this.agGetMatch(record);
        return match && match.row && match.row.length ? match.row[0] : false;
    },

    /**
     * A cell rule only paints its column when it outranks the row rule that
     * would otherwise cover the whole row. Otherwise the row rule keeps the
     * cell, which is what "the topmost rule wins" means for a single cell.
     */
    agCellRule(record, columnName) {
        const match = this.agGetMatch(record);
        if (!match || !match.cells) {
            return false;
        }
        const candidates = match.cells[columnName];
        if (!candidates || !candidates.length) {
            return false;
        }
        const candidate = candidates[0];
        const rowRule = this.agRowRule(record);
        if (!rowRule) {
            return candidate;
        }
        const order = this.agState.order;
        return order[candidate] < order[rowRule] ? candidate : false;
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
        const ruleId = this.agRowRule(record);
        if (!ruleId) {
            return classNames;
        }
        return `${classNames} o_ag_styled_row o_ag_row_${ruleId}`;
    },

    getCellClass(column, record) {
        const classNames = super.getCellClass(...arguments);
        if (column.type !== "field") {
            return classNames;
        }
        const ruleId = this.agCellRule(record, column.name);
        if (!ruleId) {
            return classNames;
        }
        return `${classNames} o_ag_cell o_ag_cell_${ruleId}`;
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

    /** The icon of the highest priority matching rule, if any. */
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
