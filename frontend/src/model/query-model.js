import { Observable } from './observable.js';

export class QueryModel extends Observable {
    constructor() {
        super({
            queryPanelOpen: false,
            queryResult: null,
        });
    }
}
