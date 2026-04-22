import { Observable } from './observable.js';

export class DataModel extends Observable {
    constructor() {
        super({
            labels: [],
            selectedLabel: null,
            vertices: [],
            propertyKeys: [],
            labelFilter: '',
            currentPage: 0,
            hasNextPage: false,
            filterKey: '',
            filterValue: '',
            vertexRelationships: {},
            expandingVertex: null,
        });
    }
}
