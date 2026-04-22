import { Observable } from './observable.js';

export class GraphModel extends Observable {
    constructor() {
        super({
            activeTab: 'table',
            graphData: null,
            graphQuery: '',
            selectedElement: null,
            graphLoading: false,
        });
    }
}
