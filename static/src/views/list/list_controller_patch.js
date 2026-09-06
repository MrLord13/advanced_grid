/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { ListController } from "@web/views/list/list_controller";

patch(ListController.prototype, {
    setup() {
        super.setup(...arguments);
        this.advancedGrid = useService("advanced_grid");
    },

    /**
     * The button is hidden on transient / abstract models and inside x2many
     * dialogs, where personal styling rules would make little sense.
     */
    get agShowColorGridButton() {
        const resModel = this.props.resModel;
        return (
            !!resModel &&
            !resModel.startsWith("ir.") &&
            resModel !== "advanced.grid.rule" &&
            !this.env.inDialog
        );
    },

    async agOpenColorGrid() {
        const resModel = this.props.resModel;
        let action;
        try {
            action = await this.orm.call(
                "advanced.grid.rule",
                "action_open_for_model",
                [resModel]
            );
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
});
