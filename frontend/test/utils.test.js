import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { vertexToJson } from '../src/utils.js';

describe('vertexToJson', () => {
    it('flattens vertex with properties into JSON', () => {
        const vertex = { ID: '1', Label: 'person', Properties: { name: 'Alice', age: 30 } };
        const result = JSON.parse(vertexToJson(vertex));
        assert.deepEqual(result, { ID: '1', Label: 'person', name: 'Alice', age: 30 });
    });

    it('handles vertex without properties', () => {
        const vertex = { ID: '2', Label: 'empty' };
        const result = JSON.parse(vertexToJson(vertex));
        assert.deepEqual(result, { ID: '2', Label: 'empty' });
    });

    it('handles vertex with empty properties', () => {
        const vertex = { ID: '3', Label: 'node', Properties: {} };
        const result = JSON.parse(vertexToJson(vertex));
        assert.deepEqual(result, { ID: '3', Label: 'node' });
    });

    it('returns pretty-printed JSON', () => {
        const vertex = { ID: '1', Label: 'x', Properties: { a: 1 } };
        const json = vertexToJson(vertex);
        assert.ok(json.includes('\n'));
    });
});
