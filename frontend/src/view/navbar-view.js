import { BaseView } from './base-view.js';

export class NavbarView extends BaseView {
    constructor(connectionModel, controller) {
        super(controller);
        this.connectionModel = connectionModel;
        this._onDocumentClick = (e) => this._handleOutsideClick(e);
    }

    mount(container) {
        super.mount(container);
        this.el = container;
        this.el.innerHTML = `
            <span class="navbar-title">Gremlin Viewer</span>
            <span class="navbar-server-url"></span>
            <div class="navbar-settings">
                <button class="icon-btn navbar-settings-btn" title="Settings">&#x2699;</button>
                <div class="settings-dropdown hidden">
                    <button class="settings-dropdown-item" data-action="change-connection">Trocar conex\u00e3o</button>
                </div>
            </div>
        `;

        this.subscribeTo(this.connectionModel, 'serverUrl', (url) => this._updateServerUrl(url));
        this._updateServerUrl(this.connectionModel.get('serverUrl'));
        this._bindEvents();
    }

    _updateServerUrl(url) {
        const el = this.el.querySelector('.navbar-server-url');
        if (el) el.textContent = url || '';
    }

    _bindEvents() {
        this.el.querySelector('.navbar-settings-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleDropdown();
        });

        this.el.querySelector('[data-action="change-connection"]').addEventListener('click', () => {
            this._closeDropdown();
            this.controller.handleDisconnect();
        });

        document.addEventListener('click', this._onDocumentClick);
    }

    _toggleDropdown() {
        this.el.querySelector('.settings-dropdown').classList.toggle('hidden');
    }

    _closeDropdown() {
        this.el.querySelector('.settings-dropdown').classList.add('hidden');
    }

    _handleOutsideClick(e) {
        if (!this.el.querySelector('.navbar-settings').contains(e.target)) {
            this._closeDropdown();
        }
    }

    destroy() {
        document.removeEventListener('click', this._onDocumentClick);
        super.destroy();
    }
}
