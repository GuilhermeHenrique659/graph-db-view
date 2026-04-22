import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Observable } from '../src/model/observable.js';

describe('Observable', () => {
    it('set() updates state and get() returns new value', () => {
        const obs = new Observable({ name: 'alice' });
        obs.set('name', 'bob');
        assert.equal(obs.get('name'), 'bob');
    });

    it('get() returns initial value before any set', () => {
        const obs = new Observable({ count: 0, flag: true });
        assert.equal(obs.get('count'), 0);
        assert.equal(obs.get('flag'), true);
    });

    it('get() returns undefined for unknown keys', () => {
        const obs = new Observable({ a: 1 });
        assert.equal(obs.get('b'), undefined);
    });

    it('subscribe() is called when key is changed via set()', () => {
        const obs = new Observable({ x: 1 });
        let called = false;
        obs.subscribe('x', () => { called = true; });
        obs.set('x', 2);
        assert.equal(called, true);
    });

    it('subscriber receives the new value as argument', () => {
        const obs = new Observable({ x: 1 });
        let received;
        obs.subscribe('x', (val) => { received = val; });
        obs.set('x', 42);
        assert.equal(received, 42);
    });

    it('unsubscribe removes the callback', () => {
        const obs = new Observable({ x: 1 });
        let callCount = 0;
        const unsub = obs.subscribe('x', () => { callCount++; });
        obs.set('x', 2);
        assert.equal(callCount, 1);

        unsub();
        obs.set('x', 3);
        assert.equal(callCount, 1);
    });

    it('subscriber of key A is not notified when key B changes', () => {
        const obs = new Observable({ a: 1, b: 2 });
        let called = false;
        obs.subscribe('a', () => { called = true; });
        obs.set('b', 99);
        assert.equal(called, false);
    });

    it('multiple subscribers on the same key are all notified', () => {
        const obs = new Observable({ x: 0 });
        const values = [];
        obs.subscribe('x', (v) => values.push(`first:${v}`));
        obs.subscribe('x', (v) => values.push(`second:${v}`));
        obs.set('x', 10);
        assert.deepEqual(values, ['first:10', 'second:10']);
    });

    it('set() notifies even when value is the same', () => {
        const obs = new Observable({ x: 1 });
        let callCount = 0;
        obs.subscribe('x', () => { callCount++; });
        obs.set('x', 1);
        assert.equal(callCount, 1);
    });

    it('handles setting null, undefined, arrays, and objects', () => {
        const obs = new Observable({ a: null });
        obs.set('a', [1, 2, 3]);
        assert.deepEqual(obs.get('a'), [1, 2, 3]);

        obs.set('a', { key: 'val' });
        assert.deepEqual(obs.get('a'), { key: 'val' });

        obs.set('a', null);
        assert.equal(obs.get('a'), null);

        obs.set('a', undefined);
        assert.equal(obs.get('a'), undefined);
    });
});
