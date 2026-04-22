import { BaseView } from './base-view.js';
import { escapeHtml } from '../utils.js';
import { mountGraph } from '../graph.js';

export class GraphView extends BaseView {
    constructor(graphModel, controller) {
        super(controller);
        this.graphModel = graphModel;
        this._graphDestroy = null;
        this.subscribeTo(this.graphModel, 'activeTab', () => this.updateVisibility());
        this.subscribeTo(this.graphModel, 'graphData', () => this.updateGraph());
        this.subscribeTo(this.graphModel, 'graphQuery', () => this.updateQueryInput());
        this.subscribeTo(this.graphModel, 'selectedElement', () => this.updateDetail());
        this.subscribeTo(this.graphModel, 'graphLoading', () => this.updateLoadingState());
    }

    mount(container) {
        super.mount(container);
        this.el = document.createElement('div');
        this.el.className = 'graph-container';

        const defaultQuery = 'g.V().outE().inV().path().limit(100).by(__.elementMap())';
        this.el.innerHTML = `
            <div class="graph-query-bar">
                <input type="text" class="filter-input graph-query-input"
                    placeholder="${escapeHtml(defaultQuery)}" value="">
                <button class="btn-primary graph-query-btn">Execute</button>
            </div>
            <div class="graph-viewport"></div>
        `;
        container.appendChild(this.el);
        this._bindEvents();
        this.updateVisibility();
    }

    _bindEvents() {
        const btn = this.el.querySelector('.graph-query-btn');
        const input = this.el.querySelector('.graph-query-input');

        btn.addEventListener('click', () => this.controller.handleExecuteGraphQuery(input.value));
        input.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.key === 'Enter') {
                e.preventDefault();
                this.controller.handleExecuteGraphQuery(input.value);
            }
        });
    }

    updateVisibility() {
        if (!this.el) return;
        const visible = this.graphModel.get('activeTab') === 'graph';
        this.el.style.display = visible ? '' : 'none';

        if (visible && !this.graphModel.get('graphData')) {
            this.controller.handleExecuteGraphQuery('');
        }
    }

    updateGraph() {
        if (!this.el) return;
        if (this._graphDestroy) {
            this._graphDestroy.destroy();
            this._graphDestroy = null;
        }

        const viewport = this.el.querySelector('.graph-viewport');
        if (!viewport) return;

        const graphData = this.graphModel.get('graphData');
        if (!graphData) {
            viewport.innerHTML = '<p class="placeholder">Enter a query and click Execute, or leave empty for auto-query</p>';
            return;
        }

        viewport.innerHTML = '';
        this._graphDestroy = mountGraph(viewport, graphData, (element) => {
            if (element) {
                this.controller.handleSelectElement(element);
            } else {
                this.controller.handleDeselectElement();
            }
        });
    }

    updateQueryInput() {
        if (!this.el) return;
        const input = this.el.querySelector('.graph-query-input');
        if (input) input.value = this.graphModel.get('graphQuery') || '';
    }

    updateLoadingState() {
        if (!this.el) return;
        const btn = this.el.querySelector('.graph-query-btn');
        const loading = this.graphModel.get('graphLoading');
        if (btn) {
            btn.disabled = loading;
            btn.textContent = loading ? 'Loading...' : 'Execute';
        }
    }

    updateDetail() {
        if (!this.el) return;
        const existing = this.el.querySelector('.detail-panel');
        if (existing) existing.remove();

        const element = this.graphModel.get('selectedElement');
        if (!element) return;

        const { type, data } = element;
        const title = type === 'vertex' ? `Vertex: ${escapeHtml(data.Label)}` : `Edge: ${escapeHtml(data.Label)}`;

        let rows = `<tr><td class="detail-key">ID</td><td>${escapeHtml(String(data.ID))}</td></tr>`;
        rows += `<tr><td class="detail-key">Label</td><td>${escapeHtml(data.Label)}</td></tr>`;

        if (type === 'edge') {
            rows += `<tr><td class="detail-key">From</td><td>${escapeHtml(data.OutV)} (${escapeHtml(data.OutVLabel)})</td></tr>`;
            rows += `<tr><td class="detail-key">To</td><td>${escapeHtml(data.InV)} (${escapeHtml(data.InVLabel)})</td></tr>`;
        }

        if (data.Properties) {
            for (const [k, v] of Object.entries(data.Properties)) {
                rows += `<tr><td class="detail-key">${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`;
            }
        }

        const panel = document.createElement('div');
        panel.className = 'detail-panel';
        panel.innerHTML = `
            <div class="detail-header">
                <h3>${title}</h3>
                <button class="icon-btn close-detail-btn">&times;</button>
            </div>
            <table class="detail-table">${rows}</table>
        `;
        this.el.appendChild(panel);

        panel.querySelector('.close-detail-btn').addEventListener('click', () => this.controller.handleDeselectElement());
    }

    destroy() {
        if (this._graphDestroy) {
            this._graphDestroy.destroy();
            this._graphDestroy = null;
        }
        super.destroy();
    }
}
