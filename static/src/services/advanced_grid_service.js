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

function ruleToCss(rule) {
    const declarations = [];
    const bg = safeColor(rule.background_color);
    const fg = safeColor(rule.text_color);
    if (bg) {
        declarations.push(`background-color:${bg} !important`);
    }
    if (fg) {
        declarations.push(`color:${fg} !important`);
    }
    if (rule.bold) {
        declarations.push("font-weight:700 !important");
    }
    if (rule.italic) {
        declarations.push("font-style:italic !important");
    }
    if (!declarations.length) {
        return "";
    }
    const body = declarations.join(";");
    if (rule.target === "row") {
        return (
            `.o_list_renderer tr.o_data_row.o_ag_rule_${rule.id} > td` +
            `:not(.o_list_record_selector){${body}}\n`
        );
    }
    return `.o_list_renderer tr.o_data_row td.o_ag_rule_${rule.id}{${body}}\n`;
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
            const sorted = [...rules].sort(
                (a, b) => a.sequence - b.sequence || a.id - b.id
            );
            const signature = JSON.stringify(sorted);
            if (signatureByModel.get(resModel) === signature) {
                return;
            }
            signatureByModel.set(resModel, signature);
            cssByModel.set(resModel, sorted.map(ruleToCss).join(""));
            refreshStyleSheet();
        }

        return {
            state,

            /**
             * True when it is worth asking the server for this model.
             */
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
                state.version++;
            },

            /**
             * @returns {Object} res_id -> {row: [ids], cells: {field: [ids]}, icon}
             */
            async evaluate(resModel, resIds) {
                if (!resModel || !enabledModels.has(resModel) || !resIds.length) {
                    return {};
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
                    return {};
                }
                if (!result || !result.rules) {
                    return {};
                }
                applyRules(resModel, result.rules);
                return result.matches || {};
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

            async getModelId(resModel) {
                const ids = await orm.search("ir.model", [["model", "=", resModel]], {
                    limit: 1,
                });
                return ids.length ? ids[0] : false;
            },
        };
    },
};

registry.category("services").add("advanced_grid", advancedGridService);
