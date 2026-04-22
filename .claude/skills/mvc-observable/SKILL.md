---
name: mvc-observable
description: Referencia da arquitetura Observable MVC do frontend. Use para criar novas Views, adicionar estado ao Model, implementar handlers no Controller, ou entender o fluxo reativo. Triggers on "mvc observable", "observable model", "criar view", "nova view", "adicionar estado", "frontend architecture", "como funciona o frontend".
---

# Observable MVC — Frontend Architecture Reference

## Fluxo

```
User Event → Controller.handleXxx() → model.set(key, value) → Views notificadas via subscribe
```

O Controller NUNCA toca no DOM. As Views NUNCA chamam o backend. O Model NUNCA sabe quem observa.

## Estrutura de Arquivos

```
frontend/src/
  model/
    observable.js       — classe Observable generica (subscribe/set/get per-key)
    app-model.js        — AppModel extends Observable (estado da app)
  view/
    base-view.js        — classe base com mount/destroy/subscribe helpers
    connection-view.js  — tela de conexao
    sidebar-view.js     — lista de labels
    table-view.js       — tabela de vertices
    graph-view.js       — visualizacao do grafo + query bar
    query-panel-view.js — modal de query raw
  controller.js         — classe Controller (handlers + model.set)
  backend.js            — wrapper Wails bindings
  graph.js              — force-directed graph (SVG puro, sem MVC)
  utils.js              — escapeHtml, filterLabels, filterVertices
  main.js               — entry point, wiring

frontend/test/
  observable.test.js    — testes do Observable (node:test)
  app-model.test.js     — testes do AppModel
  controller.test.js    — testes do Controller com mock do backend
```

---

## 1. Observable (`model/observable.js`)

Classe generica com subscribe per-key. Cada `set()` notifica imediatamente.

```js
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
```

**Regras**:
- `set()` SEMPRE notifica, mesmo se o valor for igual ao anterior
- `subscribe()` retorna funcao de unsubscribe
- Subscriber de key A NAO e notificado quando key B muda

---

## 2. AppModel (`model/app-model.js`)

Extends Observable com estado inicial da app. Para adicionar novo estado, basta incluir no `super()`.

```js
import { Observable } from './observable.js';

export class AppModel extends Observable {
    constructor() {
        super({
            connected: false, serverUrl: '', labels: [], selectedLabel: null,
            vertices: [], propertyKeys: [], error: null, loading: false,
            queryPanelOpen: false, queryResult: null, labelFilter: '', tableFilter: '',
            activeTab: 'table', graphData: null, graphQuery: '', selectedElement: null,
            graphLoading: false,
        });
    }
}
```

**Para adicionar novo estado**:
```js
super({
    // existentes...
    novoField: null,
    novoLoading: false,
});
```

---

## 3. BaseView (`view/base-view.js`)

Classe base que gerencia subscriptions e lifecycle.

```js
export class BaseView {
    constructor(model, controller) {
        this.model = model;
        this.controller = controller;
        this.el = null;
        this._unsubscribers = [];
    }

    subscribe(key, callback) {
        this._unsubscribers.push(this.model.subscribe(key, callback));
    }

    mount(container) { this.container = container; }
    update() {}

    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
        this._unsubscribers = [];
        if (this.el && this.el.parentNode) this.el.remove();
        this.el = null;
    }
}
```

---

## 4. Criar Nova View — Pattern

```js
import { BaseView } from './base-view.js';
import { escapeHtml } from '../utils.js';

export class NovaView extends BaseView {
    constructor(model, controller) {
        super(model, controller);
        // Subscribe nas keys que esta View precisa
        this.subscribe('keyA', () => this.update());
        this.subscribe('keyB', () => this.update());
    }

    mount(container) {
        super.mount(container);
        this.el = document.createElement('div');
        this.el.className = 'nova-container';
        this.el.innerHTML = `<!-- HTML inicial -->`;
        container.appendChild(this.el);
        this._bindEvents();
        this.update();
    }

    _bindEvents() {
        // Eventos de usuario → controller
        this.el.querySelector('.action-btn')
            .addEventListener('click', () => this.controller.handleAction());
    }

    update() {
        if (!this.el) return;
        const data = this.model.get('keyA');
        // Re-renderizar DOM baseado no estado
    }
}
```

**Regras**:
- Subscribe no constructor, ANTES do mount
- `mount()` cria DOM + bind events + chama `update()` inicial
- `update()` sempre checa `if (!this.el) return` (pode ser chamado apos destroy)
- Eventos de usuario SEMPRE delegam para `this.controller.handleXxx()`
- NUNCA chamar `this.model.set()` direto da View

---

## 5. Controller — Pattern

```js
export class Controller {
    constructor(model, backend) {
        this.model = model;
        this.backend = backend;
    }

    // Handlers sincronos: so model.set()
    handleFilterLabels(value) {
        this.model.set('labelFilter', value);
    }

    // Handlers assincronos: backend.call() + model.set()
    async handleAction(param) {
        this.model.set('loading', true);
        try {
            const result = await this.backend.call('MetodoBackend', param);
            this.model.set('data', result);
        } catch (err) {
            this.model.set('error', typeof err === 'string' ? err : err.message || 'Failed');
        } finally {
            this.model.set('loading', false);
        }
    }
}
```

**Regras**:
- ZERO referencia a DOM (querySelector, createElement, innerHTML)
- ZERO import de Views
- SEMPRE usa `this.model.set()` para mudar estado
- SEMPRE usa `this.backend.call()` para chamar Go backend
- `this.model.get()` para ler estado quando necessario

---

## 6. Backend (`backend.js`)

```js
export const backend = {
    async call(method, ...args) {
        return window['go']['main']['App'][method](...args);
    }
};
```

Wrapper isolado — facilita mock nos testes do Controller.

---

## 7. Wiring (`main.js`)

```js
import { AppModel } from './model/app-model.js';
import { Controller } from './controller.js';
import { backend } from './backend.js';
import { NovaView } from './view/nova-view.js';

const model = new AppModel();
const controller = new Controller(model, backend);
const app = document.getElementById('app');

let views = [];

function destroyViews() {
    views.forEach(v => v.destroy());
    views = [];
}

// Transicao de tela via subscribe no model
model.subscribe('connected', (connected) => {
    connected ? mountMain() : mountConnection();
});

function mountMain() {
    destroyViews();
    // criar DOM containers + instanciar Views + mount
}
```

**Para adicionar nova View**:
1. Importar no main.js
2. Instanciar dentro da funcao de mount relevante
3. Chamar `.mount(container)`
4. Adicionar ao array `views` para cleanup

---

## 8. Testes — Patterns

### Observable / AppModel (`node:test`)

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

it('subscribe e notificado no set', () => {
    const obs = new Observable({ x: 1 });
    let received;
    obs.subscribe('x', (v) => { received = v; });
    obs.set('x', 42);
    assert.equal(received, 42);
});
```

### Controller com mock backend

```js
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

it('handleAction atualiza model no sucesso', async () => {
    const model = new AppModel();
    const backend = createMockBackend({ MetodoBackend: expectedResult });
    const ctrl = new Controller(model, backend);

    await ctrl.handleAction('param');

    assert.deepEqual(model.get('data'), expectedResult);
    assert.equal(model.get('loading'), false);
});
```

**Rodar testes**:
```bash
node --test frontend/test/*.test.js
```

---

## Mapeamento Views → Model Keys

| View | Subscriptions | Responsabilidade |
|------|--------------|------------------|
| ConnectionView | `error`, `loading` | Tela de login |
| SidebarView | `labels`, `selectedLabel`, `labelFilter` | Lista de labels |
| TableView | `selectedLabel`, `vertices`, `propertyKeys`, `tableFilter`, `activeTab` | Tabela de dados |
| GraphView | `activeTab`, `graphData`, `graphQuery`, `selectedElement`, `graphLoading` | Grafo SVG |
| QueryPanelView | `queryPanelOpen`, `queryResult` | Modal query raw |

---

## Checklist — Adicionar Feature no Frontend

1. [ ] Adicionar estado no AppModel (`super({ ..., novoField: null })`)
2. [ ] Adicionar handler no Controller (`handleNovo()` com `model.set()` + `backend.call()`)
3. [ ] Adicionar teste do handler no `controller.test.js`
4. [ ] Criar View class extends BaseView com subscribe nas keys relevantes
5. [ ] Instanciar e montar View no `main.js`
6. [ ] Adicionar CSS se necessario
7. [ ] `node --test frontend/test/*.test.js` — testes passando
8. [ ] `wails dev` — teste manual
