/** @odoo-module **/

import { registry } from "@web/core/registry";
import { session } from "@web/session";
import { reactive } from "@odoo/owl";

const STYLE_ELEMENT_ID = "o_advanced_grid_dynamic_styles";

// Defence in depth: the server already refuses anything but a hex colour,
// but we never inject a value into CSS without re-validating it here.
const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ICON_RE = /^fa-[a-z0-9-]+$/;

function safeColor(value) {
    return typeof value === "string" && COLOR_RE.test(value.trim())
        ? value.trim()
        : null;
}

function declarations(rule) {
    const decls = [];
    const bg = safeColor(rule.background_color);
    const fg = safeColor(rule.text_color);
    if (bg) {
        decls.push(`background-color:${bg} !important`);
    }
    if (fg) {
        decls.push(`color:${fg} !important`);
    }
    if (rule.bold) {
        decls.push("font-weight:700 !important");
    }
    if (rule.italic) {
        decls.push("font-style:italic !important");
    }
    return decls.join(";");
}

/**
 * Row and cell selectors are built with the SAME specificity - four classes
 * and two elements each - and every row block is emitted before every cell
 * block. So when both a row class and a cell class end up on the same <td>,
 * the cell wins purely on source order.
 *
 * That matters: the previous selectors gave rows a higher specificity than
 * cells, which made a row rule beat a cell rule no matter how the user
 * ordered them. Arbitration now happens in the renderer, by sequence, and CSS
 * only has to apply the decision.
 */
function buildCss(rules) {
    let rowCss = "";
    let cellCss = "";
    for (const rule of rules) {
        const body = declarations(rule);
        if (!body) {
            continue;
        }
        if (rule.target === "row") {
            rowCss +=
                `.o_list_renderer tr.o_data_row.o_ag_row_${rule.id} > ` +
                `td:not(.o_list_record_selector){${body}}\n`;
        } else {
            cellCss +=
                `.o_list_renderer tr.o_data_row td.o_ag_cell.o_ag_cell_${rule.id}` +
                `{${body}}\n`;
        }
    }
    return rowCss + cellCss;
}

export const advancedGridService = {
    dependencies: ["orm"],

    start(env, { orm }) {
        /** model name -> true when the model is known to have at least one rule */
        const enabledModels = new Set(session.advanced_grid_models || []);
        /** model name -> css string, so several models can be styled at once */
        const cssByModel = new Map();
        /** model name -> signature of the last rule set, to avoid useless DOM writes */
        const signatureByModel = new Map();
        /** bumped whenever the rules changed, so open list views re-evaluate */
        const state = reactive({ version: 0 });

        function getStyleElement() {
            let el = document.getElementById(STYLE_ELEMENT_ID);
            if (!el) {
                el = document.createElement("style");
                el.id = STYLE_ELEMENT_ID;
                el.setAttribute("type", "text/css");
                document.head.appendChild(el);
            }
            return el;
        }

        function refreshStyleSheet() {
            getStyleElement().textContent = [...cssByModel.values()].join("");
        }

        function applyRules(resModel, rules) {
            const signature = JSON.stringify(rules);
            if (signatureByModel.get(resModel) === signature) {
                return;
            }
            signatureByModel.set(resModel, signature);
            cssByModel.set(resModel, buildCss(rules));
            refreshStyleSheet();
        }

        return {
            state,

            isEnabled(resModel) {
                return enabledModels.has(resModel);
            },

            /**
             * Called after the user edited their rules: from now on the model
             * must be evaluated even if the session said otherwise, and every
             * open list view has to re-evaluate its records.
             */
            markEnabled(resModel) {
                enabledModels.add(resModel);
                signatureByModel.delete(resModel);
                cssByModel.delete(resModel);
                refreshStyleSheet();
                state.version++;
            },

            /**
             * @returns {Object} {matches, order}
             *   matches: res_id -> {row: [ids], cells: {field: [ids]}, icon}
             *   order:   rule id -> priority index, 0 being the top of the list
             */
            async evaluate(resModel, resIds) {
                const empty = { matches: {}, order: {} };
                if (!resModel || !enabledModels.has(resModel) || !resIds.length) {
                    return empty;
                }
                let result;
                try {
                    result = await orm.call(
                        "advanced.grid.rule",
                        "advanced_grid_evaluate",
                        [resModel, resIds]
                    );
                } catch {
                    // A styling feature must never make a list view fail.
                    return empty;
                }
                if (!result || !result.rules) {
                    return empty;
                }
                // The server already returns the rules ordered by sequence,
                // but sorting again keeps the client independent of that.
                const rules = [...result.rules].sort(
                    (a, b) => a.sequence - b.sequence || a.id - b.id
                );
                applyRules(resModel, rules);
                const order = {};
                rules.forEach((rule, index) => {
                    order[rule.id] = index;
                });
                return { matches: result.matches || {}, order };
            },

            /**
             * Returns {icon, color, title} or null, validated for safe rendering.
             */
            sanitizeIcon(icon) {
                if (!icon || !ICON_RE.test(icon.icon || "")) {
                    return null;
                }
                return {
                    icon: icon.icon,
                    color: safeColor(icon.color),
                    title: icon.title || "",
                };
            },
        };
    },
};

registry.category("services").add("advanced_grid", advancedGridService);
