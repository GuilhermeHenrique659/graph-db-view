import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionModel } from '../src/model/connection-model.js';
import { DataModel } from '../src/model/data-model.js';
import { GraphModel } from '../src/model/graph-model.js';
import { QueryModel } from '../src/model/query-model.js';

describe('ConnectionModel', () => {
    it('has correct defaults', () => {
        const model = new ConnectionModel();
        assert.equal(model.get('connected'), false);
        assert.equal(model.get('serverUrl'), '');
        assert.equal(model.get('error'), null);
        assert.equal(model.get('loading'), false);
    });

    it('set/get works', () => {
        const model = new ConnectionModel();
        model.set('serverUrl', 'ws://localhost:8182/gremlin');
        assert.equal(model.get('serverUrl'), 'ws://localhost:8182/gremlin');
        model.set('connected', true);
        assert.equal(model.get('connected'), true);
    });

    it('subscribe notifies on change', () => {
        const model = new ConnectionModel();
        let notified = false;
        model.subscribe('connected', () => { notified = true; });
        model.set('connected', true);
        assert.equal(notified, true);
    });
});

describe('DataModel', () => {
    it('has correct defaults', () => {
        const model = new DataModel();
        assert.deepEqual(model.get('labels'), []);
        assert.equal(model.get('selectedLabel'), null);
        assert.deepEqual(model.get('vertices'), []);
        assert.deepEqual(model.get('propertyKeys'), []);
        assert.equal(model.get('labelFilter'), '');
        assert.equal(model.get('currentPage'), 0);
        assert.equal(model.get('hasNextPage'), false);
        assert.equal(model.get('filterKey'), '');
        assert.equal(model.get('filterValue'), '');
    });

    it('set/get works for arrays', () => {
        const model = new DataModel();
        const labels = ['person', 'software', 'company'];
        model.set('labels', labels);
        assert.deepEqual(model.get('labels'), labels);
    });

    it('set/get works for null values', () => {
        const model = new DataModel();
        model.set('selectedLabel', 'person');
        assert.equal(model.get('selectedLabel'), 'person');
        model.set('selectedLabel', null);
        assert.equal(model.get('selectedLabel'), null);
    });
});

describe('GraphModel', () => {
    it('has correct defaults', () => {
        const model = new GraphModel();
        assert.equal(model.get('activeTab'), 'table');
        assert.equal(model.get('graphData'), null);
        assert.equal(model.get('graphQuery'), '');
        assert.equal(model.get('selectedElement'), null);
        assert.equal(model.get('graphLoading'), false);
    });

    it('set/get works for objects', () => {
        const model = new GraphModel();
        const element = { type: 'vertex', data: { ID: '1', Label: 'person' } };
        model.set('selectedElement', element);
        assert.deepEqual(model.get('selectedElement'), element);
    });
});

describe('QueryModel', () => {
    it('has correct defaults', () => {
        const model = new QueryModel();
        assert.equal(model.get('queryPanelOpen'), false);
        assert.equal(model.get('queryResult'), null);
    });

    it('set/get works', () => {
        const model = new QueryModel();
        model.set('queryPanelOpen', true);
        assert.equal(model.get('queryPanelOpen'), true);
        model.set('queryResult', { data: [1, 2] });
        assert.deepEqual(model.get('queryResult'), { data: [1, 2] });
    });
});
