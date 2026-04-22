import { BaseView } from './base-view.js';
import { escapeHtml } from '../utils.js';

export class QueryPanelView extends BaseView {
    constructor(queryModel, controller) {
        super(controller);
        this.queryModel = queryModel;
        this.subscribeTo(this.queryModel, 'queryPanelOpen', () => this.update());
        this.subscribeTo(this.queryModel, 'queryResult', () => this.updateResult());
    }

    mount(container) {
        super.mount(container);
        this.el = document.createElement('div');
        this.el.className = 'query-overlay';
        this.el.style.display = 'none';
        this.el.innerHTML = `
            <div class="query-panel">
                <div class="query-toolbar">
                    <h3>Raw Gremlin Query</h3>
                    <div class="query-actions">
                        <button class="btn-primary execute-query-btn">Execute</button>
                        <button class="icon-btn close-query-btn">&times;</button>
                    </div>
                </div>
                <div class="query-body">
                    <div class="query-input-section">
                        <textarea class="query-textarea" placeholder="g.V().limit(10)" spellcheck="false"></textarea>
                    </div>
                    <div class="query-result-section">
                        <pre class="query-result"><code>Results will appear here...</code></pre>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(this.el);
        this._bindEvents();
    }

    _bindEvents() {
        const textarea = this.el.querySelector('.query-textarea');
        const executeBtn = this.el.querySelector('.execute-query-btn');
        const closeBtn = this.el.querySelector('.close-query-btn');

        executeBtn.addEventListener('click', () => this.controller.handleExecuteQuery(textarea.value));
        closeBtn.addEventListener('click', () => this.controller.handleCloseQuery());

        this.el.addEventListener('click', (e) => {
            if (e.target === this.el) this.controller.handleCloseQuery();
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.key === 'Enter') {
                e.preventDefault();
                this.controller.handleExecuteQuery(textarea.value);
            }
        });
    }

    update() {
        if (!this.el) return;
        const open = this.queryModel.get('queryPanelOpen');
        this.el.style.display = open ? '' : 'none';

        if (open) {
            const textarea = this.el.querySelector('.query-textarea');
            if (textarea) textarea.focus();
            const result = this.el.querySelector('.query-result');
            if (result) {
                result.className = 'query-result';
                result.innerHTML = '<code>Results will appear here...</code>';
            }
        }
    }

    updateResult() {
        if (!this.el) return;
        const result = this.queryModel.get('queryResult');
        const pre = this.el.querySelector('.query-result');
        if (!pre || !result) return;

        if (result.error) {
            pre.className = 'query-result error-text';
            pre.innerHTML = `<code>${escapeHtml(result.error)}</code>`;
        } else {
            pre.className = 'query-result';
            pre.innerHTML = `<code>${escapeHtml(JSON.stringify(result.data, null, 2))}</code>`;
        }
    }
}
