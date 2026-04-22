import { BaseView } from './base-view.js';
import { escapeHtml } from '../utils.js';

export class ConnectionView extends BaseView {
    constructor(connectionModel, controller) {
        super(controller);
        this.connectionModel = connectionModel;
        this.subscribeTo(this.connectionModel, 'error', () => this.updateError());
        this.subscribeTo(this.connectionModel, 'loading', () => this.updateLoading());
    }

    mount(container) {
        super.mount(container);
        this.el = document.createElement('div');
        this.el.className = 'connection-screen';
        this.el.innerHTML = `
            <h1>Gremlin Viewer</h1>
            <p>Connect to a Gremlin Server</p>
            <div class="connection-form">
                <input type="text" class="connection-input"
                    placeholder="ws://localhost:8182/gremlin"
                    value="ws://localhost:8182/gremlin" autofocus />
                <button class="connection-btn">Connect</button>
            </div>
            <div class="error-msg error hidden"></div>
        `;
        container.appendChild(this.el);
        this._bindEvents();
    }

    _bindEvents() {
        const input = this.el.querySelector('.connection-input');
        const btn = this.el.querySelector('.connection-btn');

        btn.addEventListener('click', () => this.controller.handleConnect(input.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.controller.handleConnect(input.value);
        });
    }

    updateError() {
        const el = this.el?.querySelector('.error-msg');
        if (!el) return;
        const error = this.connectionModel.get('error');
        if (error) {
            el.textContent = error;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    updateLoading() {
        const btn = this.el?.querySelector('.connection-btn');
        if (!btn) return;
        const loading = this.connectionModel.get('loading');
        btn.disabled = loading;
        btn.textContent = loading ? 'Connecting...' : 'Connect';
    }
}
