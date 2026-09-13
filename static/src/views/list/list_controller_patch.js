/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { ListController } from "@web/views/list/list_controller";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

const RULE_MODEL = "advanced.grid.rule";
// Brand mark shown in the header of the Advanced List dialog.
const BRAND_NAME = "ERPishro.com";
const BRAND_LOGO = "/advanced_grid/static/src/img/erpishro_mark.png";

patch(ListController.prototype, {
    setup() {
        super.setup(...arguments);
        this.advancedGrid = useService("advanced_grid");
        this.agDialog = useService("dialog");
        this.agNotification = useService("notification");
    },

    // ==================================================================
    // "Color Grid" button, shown on ordinary list views
    // ==================================================================
    /**
     * The button is hidden on transient / abstract models and inside x2many
     * dialogs, where personal styling rules would make little sense.
     */
    get agShowColorGridButton() {
        const resModel = this.props.resModel;
        return (
            !!resModel &&
            !resModel.startsWith("ir.") &&
            resModel !== RULE_MODEL &&
            !this.env.inDialog
        );
    },

    async agOpenColorGrid() {
        const resModel = this.props.resModel;
        let action;
        try {
            action = await this.orm.call(RULE_MODEL, "action_open_for_model", [resModel]);
        } catch {
            return;
        }
        this.actionService.doAction(action, {
            onClose: async () => {
                this.advancedGrid.markEnabled(resModel);
                await this.model.load();
            },
        });
    },

    // ==================================================================
    // Toolbar of the Color Grid dialog itself
    // ==================================================================
    get agIsRuleList() {
        return this.props.resModel === RULE_MODEL;
    },

    get agBrandName() {
        return BRAND_NAME;
    },

    get agBrandLogo() {
        return BRAND_LOGO;
    },

    /**
     * The brand mark is portalled into the dialog title, so it must only be
     * rendered for the dialog opened by the Color Grid button - never for the
     * same list shown inline (users form tab) or full screen (Technical menu),
     * where the portal target would not exist.
     */
    get agShowBrand() {
        return (
            this.agIsRuleList &&
            !!this.env.inDialog &&
            !!(this.props.context && this.props.context.advanced_grid_model_name)
        );
    },

    get agSelectedRuleIds() {
        const root = this.model.root;
        if (!root || !root.selection) {
            return [];
        }
        return root.selection
            .map((record) => record.resId)
            .filter((resId) => typeof resId === "number");
    },

    get agHasSelection() {
        return this.agSelectedRuleIds.length > 0;
    },

    /**
     * Opens the full form of a rule in a stacked dialog.
     *
     * The Color Grid list is `editable="bottom"`, so clicking a row edits it
     * inline and the form view is never reached - yet the form is where the
     * advanced options live, the Domain editor above all. With nothing
     * selected the form opens on a new rule instead.
     */
    agOpenRuleForm() {
        const ruleIds = this.agSelectedRuleIds;
        if (ruleIds.length > 1) {
            this.agNotification.add(_t("Select a single rule to open its form."), {
                type: "warning",
            });
            return;
        }
        this.actionService.doAction(
            {
                type: "ir.actions.act_window",
                name: ruleIds.length ? _t("Grid Rule") : _t("New Grid Rule"),
                res_model: RULE_MODEL,
                res_id: ruleIds[0] || false,
                views: [[false, "form"]],
                target: "new",
                context: this.props.context,
            },
            { onClose: () => this.model.load() }
        );
    },

    /**
     * Rules are handled with a plain ORM call rather than a view button.
     *
     * A view button goes through `doActionButton`, which turns any falsy
     * python return value into `{type: "ir.actions.act_window_close"}` - that
     * is what used to close the Color Grid dialog after each action. Calling
     * the method directly leaves the dialog untouched.
     */
    async agCallOnSelection(method) {
        const ruleIds = this.agSelectedRuleIds;
        if (!ruleIds.length) {
            this.agNotification.add(_t("Select at least one rule first."), {
                type: "warning",
            });
            return;
        }
        await this.orm.call(RULE_MODEL, method, [ruleIds]);
        await this.model.load();
    },

    agDuplicateRules() {
        return this.agCallOnSelection("action_duplicate_selected");
    },

    agDeleteRules() {
        this.agDialog.add(ConfirmationDialog, {
            title: _t("Delete rules"),
            body: _t("Delete the selected rules? This cannot be undone."),
            confirmLabel: _t("Delete"),
            confirm: () => this.agCallOnSelection("action_delete_selected"),
            cancel: () => {},
        });
    },

    agResetRules() {
        this.agDialog.add(ConfirmationDialog, {
            title: _t("Reset this list"),
            body: _t("Remove all of your personal rules on this list?"),
            confirmLabel: _t("Reset"),
            confirm: async () => {
                await this.orm.call(RULE_MODEL, "action_reset_model_rules", [[]], {
                    context: this.props.context,
                });
                await this.model.load();
            },
            cancel: () => {},
        });
    },
});
