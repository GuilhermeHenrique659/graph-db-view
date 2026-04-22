export class BaseView {
    constructor(controller) {
        this.controller = controller;
        this.el = null;
        this._unsubscribers = [];
    }

    subscribeTo(model, key, callback) {
        this._unsubscribers.push(model.subscribe(key, callback));
    }

    mount(container) {
        this.container = container;
    }

    update() {}

    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
        this._unsubscribers = [];
        if (this.el && this.el.parentNode) {
            this.el.remove();
        }
        this.el = null;
    }
}
