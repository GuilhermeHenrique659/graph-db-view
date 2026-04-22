import { BaseView } from './base-view.js';
import { escapeHtml, filterLabels } from '../utils.js';

export class SidebarView extends BaseView {
    constructor(dataModel, controller) {
        super(controller);
        this.dataModel = dataModel;
        this.subscribeTo(this.dataModel, 'labels', () => this.updateList());
        this.subscribeTo(this.dataModel, 'selectedLabel', () => this.updateList());
        this.subscribeTo(this.dataModel, 'labelFilter', () => this.updateList());
    }

    mount(container) {
        super.mount(container);
        this.el = container;
        this.el.innerHTML = `
            <div class="sidebar-header">
                <h2>Labels</h2>
                <div class="sidebar-actions">
                    <button class="icon-btn query-btn" title="Raw Gremlin Query">&#x276F;_</button>
                    <button class="icon-btn reload-labels-btn" title="Reload labels">&#x21bb;</button>
                </div>
            </div>
            <div class="sidebar-filter">
                <input type="text" class="filter-input label-filter-input" placeholder="Filter labels..." value="">
            </div>
            <ul class="label-list"></ul>
        `;
        this._bindEvents();
        this.updateList();
    }

    _bindEvents() {
        this.el.querySelector('.reload-labels-btn').addEventListener('click', () => this.controller.handleReloadLabels());
        this.el.querySelector('.query-btn').addEventListener('click', () => this.controller.handleOpenQuery());
        this.el.querySelector('.label-filter-input').addEventListener('input', (e) => this.controller.handleFilterLabels(e.target.value));
    }

    updateList() {
        const ul = this.el?.querySelector('.label-list');
        if (!ul) return;

        const labels = this.dataModel.get('labels');
        const filter = this.dataModel.get('labelFilter');
        const selected = this.dataModel.get('selectedLabel');
        const filtered = filterLabels(labels, filter);

        ul.innerHTML = filtered.map(l => `
            <li class="label-item ${l === selected ? 'active' : ''}" data-label="${escapeHtml(l)}">
                ${escapeHtml(l)}
            </li>
        `).join('');

        ul.querySelectorAll('.label-item').forEach(item => {
            item.addEventListener('click', () => this.controller.handleSelectLabel(item.dataset.label));
        });
    }

    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
        this._unsubscribers = [];
        this.el = null;
    }
}
