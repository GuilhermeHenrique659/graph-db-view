import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionModel } from '../src/model/connection-model.js';
import { DataModel } from '../src/model/data-model.js';
import { GraphModel } from '../src/model/graph-model.js';
import { QueryModel } from '../src/model/query-model.js';
import { Controller } from '../src/controller.js';

function createMockBackend(responses = {}) {
    const calls = [];
    return {
        calls,
        async call(method, ...args) {
            calls.push({ method, args });
            if (responses[method] instanceof Error) throw responses[method];
            if (typeof responses[method] === 'function') return responses[method](...args);
            return responses[method];
        }
    };
}

function createModels() {
    return {
        connection: new ConnectionModel(),
        data: new DataModel(),
        graph: new GraphModel(),
        query: new QueryModel(),
    };
}

describe('Controller', () => {
    let models;

    beforeEach(() => {
        models = createModels();
    });

    describe('handleConnect', () => {
        it('on success: sets connected=true, labels, serverUrl', async () => {
            const backend = createMockBackend({
                Connect: undefined,
                ListLabels: ['person', 'software'],
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleConnect('ws://localhost:8182/gremlin');

            assert.equal(models.connection.get('connected'), true);
            assert.deepEqual(models.data.get('labels'), ['person', 'software']);
            assert.equal(models.connection.get('serverUrl'), 'ws://localhost:8182/gremlin');
            assert.equal(models.connection.get('error'), null);
        });

        it('sets loading=true during connection', async () => {
            const loadingStates = [];
            models.connection.subscribe('loading', (v) => loadingStates.push(v));

            const backend = createMockBackend({ Connect: undefined, ListLabels: [] });
            const ctrl = new Controller(models, backend);
            await ctrl.handleConnect('ws://localhost:8182/gremlin');

            assert.equal(loadingStates[0], true);
        });

        it('on failure: sets error, connected=false, loading=false', async () => {
            const backend = createMockBackend({
                Connect: new Error('Connection refused'),
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleConnect('ws://bad:1234');

            assert.equal(models.connection.get('connected'), false);
            assert.equal(models.connection.get('error'), 'Connection refused');
            assert.equal(models.connection.get('loading'), false);
        });

        it('on failure with string error', async () => {
            const mockBackend = {
                async call(method) {
                    if (method === 'Connect') throw 'string error';
                }
            };
            const ctrl = new Controller(models, mockBackend);
            await ctrl.handleConnect('ws://bad');
            assert.equal(models.connection.get('error'), 'string error');
        });

        it('resets selectedLabel, vertices, and pagination state on new connection', async () => {
            models.data.set('selectedLabel', 'old');
            models.data.set('vertices', [{ ID: '1' }]);
            models.data.set('currentPage', 3);
            models.data.set('hasNextPage', true);

            const backend = createMockBackend({ Connect: undefined, ListLabels: ['new'] });
            const ctrl = new Controller(models, backend);
            await ctrl.handleConnect('ws://localhost:8182/gremlin');

            assert.equal(models.data.get('selectedLabel'), null);
            assert.deepEqual(models.data.get('vertices'), []);
            assert.deepEqual(models.data.get('propertyKeys'), []);
            assert.equal(models.data.get('currentPage'), 0);
            assert.equal(models.data.get('hasNextPage'), false);
            assert.equal(models.data.get('filterKey'), '');
            assert.equal(models.data.get('filterValue'), '');
        });
    });

    describe('handleSelectLabel', () => {
        it('sets selectedLabel, vertices, propertyKeys, and pagination state', async () => {
            const vertices = [
                { ID: '1', Label: 'person', Properties: { name: 'Alice', age: 30 } },
                { ID: '2', Label: 'person', Properties: { name: 'Bob' } },
            ];
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: vertices, HasMore: true },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleSelectLabel('person');

            assert.equal(models.data.get('selectedLabel'), 'person');
            assert.deepEqual(models.data.get('vertices'), vertices);
            assert.deepEqual(models.data.get('propertyKeys'), ['ID', 'Label', 'age', 'name']);
            assert.equal(models.data.get('currentPage'), 0);
            assert.equal(models.data.get('hasNextPage'), true);
        });

        it('clears filter state', async () => {
            models.data.set('filterKey', 'name');
            models.data.set('filterValue', 'Alice');
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: [], HasMore: false },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleSelectLabel('person');
            assert.equal(models.data.get('filterKey'), '');
            assert.equal(models.data.get('filterValue'), '');
        });

        it('calls backend with offset=0 and empty filter', async () => {
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: [], HasMore: false },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleSelectLabel('person');
            assert.deepEqual(backend.calls[0], { method: 'GetVerticesByLabel', args: ['person', 0, '', ''] });
        });

        it('on failure: sets error, clears vertices', async () => {
            const backend = createMockBackend({
                GetVerticesByLabel: new Error('Network error'),
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleSelectLabel('person');

            assert.equal(models.connection.get('error'), 'Network error');
            assert.deepEqual(models.data.get('vertices'), []);
            assert.deepEqual(models.data.get('propertyKeys'), []);
        });
    });

    describe('handleApplyFilter', () => {
        it('parses property=value and fetches filtered page 0', async () => {
            models.data.set('selectedLabel', 'person');
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: [{ ID: '1', Label: 'person', Properties: { name: 'Alice' } }], HasMore: false },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleApplyFilter('name=Alice');

            assert.equal(models.data.get('filterKey'), 'name');
            assert.equal(models.data.get('filterValue'), 'Alice');
            assert.equal(models.data.get('currentPage'), 0);
            assert.deepEqual(backend.calls[0], { method: 'GetVerticesByLabel', args: ['person', 0, 'name', 'Alice'] });
        });

        it('handles value with = sign', async () => {
            models.data.set('selectedLabel', 'config');
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: [], HasMore: false },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleApplyFilter('expr=a=b');

            assert.equal(models.data.get('filterKey'), 'expr');
            assert.equal(models.data.get('filterValue'), 'a=b');
        });

        it('clears filter when input is empty', async () => {
            models.data.set('selectedLabel', 'person');
            models.data.set('filterKey', 'name');
            models.data.set('filterValue', 'Alice');
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: [], HasMore: false },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleApplyFilter('');

            assert.equal(models.data.get('filterKey'), '');
            assert.equal(models.data.get('filterValue'), '');
            assert.deepEqual(backend.calls[0], { method: 'GetVerticesByLabel', args: ['person', 0, '', ''] });
        });

        it('does nothing if no selectedLabel', async () => {
            const backend = createMockBackend();
            const ctrl = new Controller(models, backend);

            await ctrl.handleApplyFilter('name=Alice');
            assert.equal(backend.calls.length, 0);
        });

        it('clears filter when input has no =', async () => {
            models.data.set('selectedLabel', 'person');
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: [], HasMore: false },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleApplyFilter('noequals');

            assert.equal(models.data.get('filterKey'), '');
            assert.equal(models.data.get('filterValue'), '');
        });
    });

    describe('handleNextPage', () => {
        it('increments page and fetches with correct offset', async () => {
            models.data.set('selectedLabel', 'person');
            models.data.set('currentPage', 0);
            models.data.set('filterKey', 'name');
            models.data.set('filterValue', 'A');
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: [], HasMore: false },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleNextPage();

            assert.deepEqual(backend.calls[0], { method: 'GetVerticesByLabel', args: ['person', 100, 'name', 'A'] });
            assert.equal(models.data.get('currentPage'), 1);
        });

        it('does nothing if no selectedLabel', async () => {
            const backend = createMockBackend();
            const ctrl = new Controller(models, backend);
            await ctrl.handleNextPage();
            assert.equal(backend.calls.length, 0);
        });
    });

    describe('handlePrevPage', () => {
        it('decrements page and fetches with correct offset', async () => {
            models.data.set('selectedLabel', 'person');
            models.data.set('currentPage', 2);
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: [], HasMore: true },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handlePrevPage();

            assert.deepEqual(backend.calls[0], { method: 'GetVerticesByLabel', args: ['person', 100, '', ''] });
            assert.equal(models.data.get('currentPage'), 1);
        });

        it('does nothing if on page 0', async () => {
            models.data.set('selectedLabel', 'person');
            models.data.set('currentPage', 0);
            const backend = createMockBackend();
            const ctrl = new Controller(models, backend);

            await ctrl.handlePrevPage();
            assert.equal(backend.calls.length, 0);
        });

        it('does nothing if no selectedLabel', async () => {
            const backend = createMockBackend();
            const ctrl = new Controller(models, backend);
            await ctrl.handlePrevPage();
            assert.equal(backend.calls.length, 0);
        });
    });

    describe('handleReloadLabels', () => {
        it('updates labels from backend', async () => {
            const backend = createMockBackend({ ListLabels: ['a', 'b', 'c'] });
            const ctrl = new Controller(models, backend);

            await ctrl.handleReloadLabels();
            assert.deepEqual(models.data.get('labels'), ['a', 'b', 'c']);
        });

        it('clears selectedLabel if it no longer exists', async () => {
            models.data.set('selectedLabel', 'old');
            models.data.set('vertices', [{ ID: '1' }]);
            const backend = createMockBackend({ ListLabels: ['new'] });
            const ctrl = new Controller(models, backend);

            await ctrl.handleReloadLabels();
            assert.equal(models.data.get('selectedLabel'), null);
            assert.deepEqual(models.data.get('vertices'), []);
        });

        it('keeps selectedLabel if it still exists', async () => {
            models.data.set('selectedLabel', 'kept');
            const backend = createMockBackend({ ListLabels: ['kept', 'other'] });
            const ctrl = new Controller(models, backend);

            await ctrl.handleReloadLabels();
            assert.equal(models.data.get('selectedLabel'), 'kept');
        });
    });

    describe('handleFilterLabels', () => {
        it('sets labelFilter', () => {
            const ctrl = new Controller(models, createMockBackend());
            ctrl.handleFilterLabels('per');
            assert.equal(models.data.get('labelFilter'), 'per');
        });
    });

    describe('handleSwitchTab', () => {
        it('sets activeTab and clears selectedElement', () => {
            models.graph.set('selectedElement', { type: 'vertex', data: {} });
            const ctrl = new Controller(models, createMockBackend());

            ctrl.handleSwitchTab('graph');
            assert.equal(models.graph.get('activeTab'), 'graph');
            assert.equal(models.graph.get('selectedElement'), null);
        });
    });

    describe('handleExecuteGraphQuery', () => {
        it('on success: sets graphData and graphQuery', async () => {
            const data = { Vertices: [], Edges: [] };
            const backend = createMockBackend({ GetGraphData: data });
            const ctrl = new Controller(models, backend);

            await ctrl.handleExecuteGraphQuery('g.V()');
            assert.deepEqual(models.graph.get('graphData'), data);
            assert.equal(models.graph.get('graphQuery'), 'g.V()');
            assert.equal(models.graph.get('graphLoading'), false);
        });

        it('on failure: sets graphData=null', async () => {
            const backend = createMockBackend({ GetGraphData: new Error('fail') });
            const ctrl = new Controller(models, backend);

            await ctrl.handleExecuteGraphQuery('bad query');
            assert.equal(models.graph.get('graphData'), null);
            assert.equal(models.graph.get('graphLoading'), false);
        });

        it('sets graphLoading during execution', async () => {
            const states = [];
            models.graph.subscribe('graphLoading', v => states.push(v));

            const backend = createMockBackend({ GetGraphData: { Vertices: [], Edges: [] } });
            const ctrl = new Controller(models, backend);
            await ctrl.handleExecuteGraphQuery('g.V()');

            assert.equal(states[0], true);
            assert.equal(states[states.length - 1], false);
        });
    });

    describe('handleSelectElement / handleDeselectElement', () => {
        it('sets and clears selectedElement', () => {
            const ctrl = new Controller(models, createMockBackend());
            const element = { type: 'vertex', data: { ID: '1' } };

            ctrl.handleSelectElement(element);
            assert.deepEqual(models.graph.get('selectedElement'), element);

            ctrl.handleDeselectElement();
            assert.equal(models.graph.get('selectedElement'), null);
        });
    });

    describe('handleOpenQuery / handleCloseQuery', () => {
        it('handleOpenQuery sets queryPanelOpen=true and queryResult=null', () => {
            const ctrl = new Controller(models, createMockBackend());
            ctrl.handleOpenQuery();
            assert.equal(models.query.get('queryPanelOpen'), true);
            assert.equal(models.query.get('queryResult'), null);
        });

        it('handleCloseQuery sets queryPanelOpen=false and queryResult=null', () => {
            models.query.set('queryPanelOpen', true);
            models.query.set('queryResult', { data: 'something' });
            const ctrl = new Controller(models, createMockBackend());

            ctrl.handleCloseQuery();
            assert.equal(models.query.get('queryPanelOpen'), false);
            assert.equal(models.query.get('queryResult'), null);
        });
    });

    describe('handleExecuteQuery', () => {
        it('on success: sets queryResult with data', async () => {
            const backend = createMockBackend({ ExecuteQuery: [{ id: 1 }] });
            const ctrl = new Controller(models, backend);

            await ctrl.handleExecuteQuery('g.V().limit(1)');
            assert.deepEqual(models.query.get('queryResult'), { data: [{ id: 1 }] });
        });

        it('on failure: sets queryResult with error', async () => {
            const backend = createMockBackend({ ExecuteQuery: new Error('syntax error') });
            const ctrl = new Controller(models, backend);

            await ctrl.handleExecuteQuery('bad');
            assert.deepEqual(models.query.get('queryResult'), { error: 'syntax error' });
        });
    });

    describe('handleDisconnect', () => {
        it('calls Disconnect, resets state including pagination, sets connected=false', async () => {
            models.connection.set('connected', true);
            models.connection.set('serverUrl', 'ws://localhost:8182/gremlin');
            models.data.set('labels', ['person']);
            models.data.set('selectedLabel', 'person');
            models.data.set('vertices', [{ ID: '1' }]);
            models.data.set('propertyKeys', ['ID', 'Label', 'name']);
            models.data.set('currentPage', 2);
            models.data.set('hasNextPage', true);
            models.data.set('filterKey', 'name');
            models.data.set('filterValue', 'Alice');

            const backend = createMockBackend({ Disconnect: undefined });
            const ctrl = new Controller(models, backend);

            await ctrl.handleDisconnect();

            assert.equal(models.connection.get('connected'), false);
            assert.equal(models.connection.get('serverUrl'), '');
            assert.deepEqual(models.data.get('labels'), []);
            assert.equal(models.data.get('selectedLabel'), null);
            assert.deepEqual(models.data.get('vertices'), []);
            assert.deepEqual(models.data.get('propertyKeys'), []);
            assert.equal(models.data.get('currentPage'), 0);
            assert.equal(models.data.get('hasNextPage'), false);
            assert.equal(models.data.get('filterKey'), '');
            assert.equal(models.data.get('filterValue'), '');
            assert.deepEqual(backend.calls[0], { method: 'Disconnect', args: [] });
        });

        it('disconnects even if backend fails', async () => {
            models.connection.set('connected', true);
            const backend = createMockBackend({ Disconnect: new Error('fail') });
            const ctrl = new Controller(models, backend);

            await ctrl.handleDisconnect();

            assert.equal(models.connection.get('connected'), false);
        });
    });

    describe('handleExpandRelationships', () => {
        it('sets vertexRelationships on success', async () => {
            const relationships = [
                { Direction: 'OUT', EdgeLabel: 'knows', TargetLabel: 'Person', TargetID: '2' }
            ];
            const backend = createMockBackend({ GetVertexRelationships: relationships });
            const ctrl = new Controller(models, backend);

            await ctrl.handleExpandRelationships('1');

            assert.deepStrictEqual(models.data.get('vertexRelationships'), { '1': relationships });
            assert.strictEqual(models.data.get('expandingVertex'), null);
        });

        it('sets expandingVertex during loading', async () => {
            const states = [];
            models.data.subscribe('expandingVertex', v => states.push(v));

            const backend = createMockBackend({ GetVertexRelationships: [] });
            const ctrl = new Controller(models, backend);
            await ctrl.handleExpandRelationships('1');

            assert.strictEqual(states[0], '1');
            assert.strictEqual(states[states.length - 1], null);
        });

        it('sets error on failure', async () => {
            const backend = createMockBackend({ GetVertexRelationships: new Error('fail') });
            const ctrl = new Controller(models, backend);

            await ctrl.handleExpandRelationships('1');

            assert.strictEqual(models.connection.get('error'), 'fail');
            assert.strictEqual(models.data.get('expandingVertex'), null);
        });

        it('sets error on string throw', async () => {
            const mockBackend = {
                async call(method) {
                    if (method === 'GetVertexRelationships') throw 'string error';
                }
            };
            const ctrl = new Controller(models, mockBackend);
            await ctrl.handleExpandRelationships('1');
            assert.strictEqual(models.connection.get('error'), 'string error');
        });

        it('calls backend with vertexId, limit=5, offset=0', async () => {
            const backend = createMockBackend({ GetVertexRelationships: [] });
            const ctrl = new Controller(models, backend);

            await ctrl.handleExpandRelationships('v42');

            assert.deepStrictEqual(backend.calls[0], {
                method: 'GetVertexRelationships',
                args: ['v42', 5, 0]
            });
        });
    });

    describe('handleLoadMoreRelationships', () => {
        it('appends to existing relationships', async () => {
            const existing = [{ Direction: 'OUT', EdgeLabel: 'knows', TargetLabel: 'Person', TargetID: '2' }];
            const more = [{ Direction: 'IN', EdgeLabel: 'created', TargetLabel: 'Software', TargetID: '3' }];
            const backend = createMockBackend({ GetVertexRelationships: more });
            const ctrl = new Controller(models, backend);
            models.data.set('vertexRelationships', { '1': existing });

            await ctrl.handleLoadMoreRelationships('1');

            assert.deepStrictEqual(models.data.get('vertexRelationships')['1'], [...existing, ...more]);
        });

        it('calls backend with correct offset based on existing count', async () => {
            const existing = [
                { Direction: 'OUT', EdgeLabel: 'knows', TargetLabel: 'Person', TargetID: '2' },
                { Direction: 'OUT', EdgeLabel: 'likes', TargetLabel: 'Software', TargetID: '3' },
            ];
            const backend = createMockBackend({ GetVertexRelationships: [] });
            const ctrl = new Controller(models, backend);
            models.data.set('vertexRelationships', { '1': existing });

            await ctrl.handleLoadMoreRelationships('1');

            assert.deepStrictEqual(backend.calls[0], {
                method: 'GetVertexRelationships',
                args: ['1', 5, 2]
            });
        });

        it('works when no existing relationships for vertex', async () => {
            const more = [{ Direction: 'OUT', EdgeLabel: 'knows', TargetLabel: 'Person', TargetID: '2' }];
            const backend = createMockBackend({ GetVertexRelationships: more });
            const ctrl = new Controller(models, backend);

            await ctrl.handleLoadMoreRelationships('1');

            assert.deepStrictEqual(models.data.get('vertexRelationships')['1'], more);
        });

        it('sets error on failure', async () => {
            const backend = createMockBackend({ GetVertexRelationships: new Error('fail') });
            const ctrl = new Controller(models, backend);

            await ctrl.handleLoadMoreRelationships('1');

            assert.strictEqual(models.connection.get('error'), 'fail');
            assert.strictEqual(models.data.get('expandingVertex'), null);
        });

        it('sets expandingVertex during loading', async () => {
            const states = [];
            models.data.subscribe('expandingVertex', v => states.push(v));

            const backend = createMockBackend({ GetVertexRelationships: [] });
            const ctrl = new Controller(models, backend);
            await ctrl.handleLoadMoreRelationships('1');

            assert.strictEqual(states[0], '1');
            assert.strictEqual(states[states.length - 1], null);
        });
    });

    describe('handleNavigateToRelated', () => {
        it('sets filter to ID=targetId and fetches vertices for target label', async () => {
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: [{ ID: '42', Label: 'Person', Properties: {} }], HasMore: false },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleNavigateToRelated('Person', '42');

            assert.strictEqual(models.data.get('selectedLabel'), 'Person');
            assert.strictEqual(models.data.get('filterKey'), 'ID');
            assert.strictEqual(models.data.get('filterValue'), '42');
            assert.deepStrictEqual(backend.calls[0], {
                method: 'GetVerticesByLabel',
                args: ['Person', 0, 'ID', '42']
            });
        });
    });

    describe('handleReloadTable', () => {
        it('does nothing if no selectedLabel', async () => {
            const backend = createMockBackend();
            const ctrl = new Controller(models, backend);
            await ctrl.handleReloadTable();
            assert.equal(backend.calls.length, 0);
        });

        it('re-fetches vertices for current label with current page and filter', async () => {
            models.data.set('selectedLabel', 'person');
            models.data.set('currentPage', 1);
            models.data.set('filterKey', 'name');
            models.data.set('filterValue', 'Alice');
            const vertices = [{ ID: '1', Label: 'person', Properties: { name: 'Alice' } }];
            const backend = createMockBackend({
                GetVerticesByLabel: { Vertices: vertices, HasMore: false },
            });
            const ctrl = new Controller(models, backend);

            await ctrl.handleReloadTable();
            assert.deepEqual(models.data.get('vertices'), vertices);
            assert.deepEqual(backend.calls[0], { method: 'GetVerticesByLabel', args: ['person', 100, 'name', 'Alice'] });
        });
    });
});
