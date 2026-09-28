/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";

/**
 * Content of the in-app user guide.
 *
 * Every sentence is an individual `_t()` call rather than a block of text in
 * the template: each one becomes its own exact msgid, which keeps the
 * translation robust and lets a translator work sentence by sentence.
 *
 * It is a function, not a constant, because `_t` must be evaluated after the
 * translations are loaded.
 */
export function helpSections() {
    return [
        {
            id: "what",
            title: _t("What this module does"),
            items: [
                _t("It lets you colour the rows and the cells of any list view according to your own criteria."),
                _t("Rules are personal by default: what you configure is visible to you and to nobody else."),
                _t("No view is modified, so the standard behaviour of Odoo is never altered."),
            ],
        },
        {
            id: "create",
            title: _t("Creating your first rule"),
            steps: [
                _t("Open any list view and click the Color Grid button, next to New."),
                _t("Add a line: the model is already filled in with the list you came from."),
                _t("Give the rule a short description, so you recognise it later."),
                _t("Pick the field the condition applies to, then the operator and the value."),
                _t("Choose a background colour, and optionally a text colour, bold, italic or an icon."),
                _t("Close the dialog: the list is repainted immediately."),
            ],
        },
        {
            id: "condition",
            title: _t("Simple condition or domain"),
            items: [
                _t("Simple mode builds a single condition out of a field, an operator and a value."),
                _t("The value editor adapts to the field: an autocomplete for a linked record, a dropdown for a selection, a date picker for a date."),
                _t("Domain mode opens the same editor as the custom filters of Odoo, for conditions that combine several criteria with and/or."),
                _t("Use domain mode whenever one condition is not enough, or to search on the name of a linked record."),
                _t("The domain editor is only available in the form view: select a rule and click Form View in the toolbar."),
            ],
        },
        {
            id: "target",
            title: _t("Whole row or single cell"),
            items: [
                _t("A row rule paints every cell of the matching records."),
                _t("A cell rule paints one column only, which you choose in Column to Style."),
                _t("A cell rule is the way to highlight one value without drowning the whole line in colour."),
            ],
        },
        {
            id: "icons",
            title: _t("Icons and country flags"),
            items: [
                _t("Any rule can carry an icon, picked from a searchable grid grouped by theme."),
                _t("The last category holds the flag of every country of your database, so you can flag records by country."),
                _t("A row rule draws its icon at the start of the record; a cell rule draws it inside its own column, right next to the value."),
                _t("Icons never change the height of the rows."),
            ],
        },
        {
            id: "priority",
            title: _t("Priority between rules"),
            items: [
                _t("Rules are evaluated from top to bottom and the first one that matches wins."),
                _t("Drag a rule with the handle on its left to move it up or down."),
                _t("A cell rule only paints its column when it sits above the row rule that also matches; otherwise the row colour keeps the cell."),
                _t("Reordering takes effect once you close the dialog."),
            ],
        },
        {
            id: "scope",
            title: _t("Personal and shared rules"),
            items: [
                _t("Your rules are personal: other users keep their own lists untouched."),
                _t("A user belonging to the Advanced Grid Manager group can publish shared rules, which apply to everybody."),
                _t("Duplicating a shared rule gives you a personal copy you are free to edit."),
            ],
        },
        {
            id: "manage",
            title: _t("Managing your rules"),
            items: [
                _t("Select one or more rules and click Duplicate to copy them, or Delete to remove them."),
                _t("Reset This List removes every personal rule you created on the current list, in one click."),
                _t("Settings, Users, then the List Personalisation tab shows every list a user has customised, and lets you clear them."),
            ],
        },
        {
            id: "export",
            title: _t("Excel export"),
            items: [
                _t("The xlsx export carries the same colours, bold and italic as the list."),
                _t("Icons have no equivalent in a spreadsheet and are therefore not exported."),
                _t("Grouped exports, exports that include sub-lines and the import compatible export are exported without colours."),
            ],
        },
    ];
}
