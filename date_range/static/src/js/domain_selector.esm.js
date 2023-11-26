/** @odoo-module **/
import {domainFromTreeDateRange, treeFromDomainDateRange} from "./condition_tree.esm";
import {onWillStart, useChildSubEnv} from "@odoo/owl";
import {Domain} from "@web/core/domain";
import {DomainSelector} from "@web/core/domain_selector/domain_selector";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";

const ARCHIVED_DOMAIN = `[("active", "in", [True, False])]`;

patch(DomainSelector.prototype, {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.dateRanges = [];
        useChildSubEnv({domain: this});
        onWillStart(async () => {
            this.dateRanges = await this.orm.call("date.range", "search_read", []);
        });
    },

    async onPropsUpdated(p) {
        await super.onPropsUpdated.apply(this, arguments);
        let domain = null;
        let isSupported = true;
        try {
            domain = new Domain(p.domain);
        } catch {
            isSupported = false;
        }
        if (!isSupported) {
            this.tree = null;
            this.defaultCondition = null;
            this.fieldDefs = {};
            this.showArchivedCheckbox = false;
            this.includeArchived = false;
            return;
        }

        this.tree = treeFromDomainDateRange(domain, {
            getFieldDef: this.getFieldDef.bind(this),
            distributeNot: !p.isDebugMode,
        });
    },
    getOperatorEditorInfo(node) {
        const info = super.getOperatorEditorInfo(node);
        const fieldDef = this.getFieldDef(node.path);
        const dateRanges = this.dateRanges;
        patch(info, {
            extractProps({value: [operator]}) {
                const props = super.extractProps.apply(this, arguments);
                if (
                    fieldDef &&
                    (fieldDef.type === "date" || fieldDef.type === "datetime") &&
                    dateRanges.length
                ) {
                    if (operator === "daterange") {
                        props.value = "daterange";
                        props.options.pop();
                    }
                    props.options.push(["daterange", "daterange"]);
                }
                return props;
            },
            isSupported([operator]) {
                if (node.operator === "daterange") {
                    return typeof operator === "string" && operator === "daterange";
                }
                return super.isSupported.apply(this, arguments);
            },
        });
        return info;
    },
    update(tree) {
        const archiveDomain = this.includeArchived ? ARCHIVED_DOMAIN : `[]`;
        const domain = tree
            ? Domain.and([domainFromTreeDateRange(tree), archiveDomain]).toString()
            : archiveDomain;
        this.props.update(domain);
    },
});
