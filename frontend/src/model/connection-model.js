import { Observable } from './observable.js';

export class ConnectionModel extends Observable {
    constructor() {
        super({
            connected: false,
            serverUrl: '',
            error: null,
            loading: false,
        });
    }
}
