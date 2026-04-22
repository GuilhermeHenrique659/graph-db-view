export class Observable {
    #state;
    #subscribers;

    constructor(initialState) {
        this.#state = { ...initialState };
        this.#subscribers = new Map();
    }

    get(key) {
        return this.#state[key];
    }

    set(key, value) {
        this.#state[key] = value;
        const subs = this.#subscribers.get(key);
        if (subs) subs.forEach(cb => cb(value));
    }

    subscribe(key, callback) {
        if (!this.#subscribers.has(key)) {
            this.#subscribers.set(key, new Set());
        }
        this.#subscribers.get(key).add(callback);
        return () => this.#subscribers.get(key).delete(callback);
    }
}
