---
name: new-feature
description: Use when the user wants to implement a new feature in the Gremlin Viewer project. Covers the full TDD workflow across hexagonal architecture (port, service, adapter, app binding) and frontend MVC. Triggers on requests like "implement feature", "add feature", "nova feature", "quero implementar", "adicionar funcionalidade".
---

# New Feature Implementation — Gremlin Viewer

Workflow completo para implementar features neste projeto, seguindo TDD e arquitetura hexagonal.

## Architecture Quick Reference

### Backend — Hexagonal (Ports & Adapters)

```
internal/
  core/
    domain/domain.go       — modelos (Vertex, etc.)
    ports/ports.go         — interface GraphRepository
    services/services.go   — GraphService (orquestra ports)
  adapters/
    gremlin/gremlin.go     — implementa GraphRepository via gremlin-go
app.go                     — Wails bindings (interface local graphService + struct App)
main.go                    — DI wiring: repo → service → app → wails.Run
```

**Dependency flow**: `app.go` → `services/` → `ports/` ← `adapters/gremlin/`

### Frontend — Observable MVC (Vanilla JS + Vite)

```
frontend/src/
  model/
    observable.js     — classe Observable (subscribe/set/get per-key)
    app-model.js      — AppModel extends Observable (estado da app)
  view/
    base-view.js      — classe base com mount/destroy/subscribe helpers
    *.js              — Views concretas (extends BaseView)
  controller.js       — classe Controller (handlers + model.set, zero DOM)
  backend.js          — wrapper Wails bindings
  utils.js            — escapeHtml, filterLabels, filterVertices
  main.js             — entry point (wiring model → controller → views)
```

**Fluxo**: `User Event → Controller.handleXxx() → model.set(key, value) → Views notificadas via subscribe`

**Backend call pattern** (controller.js):
```js
async handleAction(param) {
    this.model.set('loading', true);
    try {
        const result = await this.backend.call('MetodoBackend', param);
        this.model.set('data', result);
    } catch (err) {
        this.model.set('error', err.message || 'Failed');
    } finally {
        this.model.set('loading', false);
    }
}
```

**View pattern** — classes que fazem subscribe e se atualizam:
```js
export class NovaView extends BaseView {
    constructor(model, controller) {
        super(model, controller);
        this.subscribe('data', () => this.update());
    }
    mount(container) { /* cria DOM + bind events + update() */ }
    update() { /* re-renderiza baseado em model.get() */ }
}
```

**Wails bindings** (auto-gerados em `frontend/wailsjs/go/main/App.js` ao rodar `wails dev`).

---

## TDD Implementation Order

Para cada feature, seguir esta ordem EXATA. Cada passo tem ciclo red-green.

### Step 1: Port (interface)

**Arquivo**: `internal/core/ports/ports.go`

1. Adicionar o novo método à interface `GraphRepository`
2. Atualizar o mock em `internal/core/ports/ports_test.go` (adicionar método ao `mockGraphRepository`)
3. `go test ./internal/core/ports/` — deve passar

**Pattern da interface**:
```go
type GraphRepository interface {
    Connect(url string) error
    Close() error
    ListLabels() ([]string, error)
    GetVerticesByLabel(label string) ([]domain.Vertex, error)
    ExecuteQuery(query string) (interface{}, error)
    // NovoMetodo(...) (ReturnType, error)  ← adicionar aqui
}
```

**Pattern do mock em ports_test.go**:
```go
type mockGraphRepository struct{}
func (m *mockGraphRepository) NovoMetodo(...) (ReturnType, error) { return ..., nil }
var _ GraphRepository = (*mockGraphRepository)(nil)  // compile-time check
```

### Step 2: Service (lógica de negócio)

**Arquivos**: `internal/core/services/services.go` + `graph_service_test.go`

1. **TEST FIRST** — Atualizar `mockRepo` no test file:
   - Adicionar campos para resultado e erro do novo método
   - Implementar o método no mock
2. Escrever testes: `TestNovoMetodo_Success`, `TestNovoMetodo_Error`, + edge cases
3. `go test` → RED (método não existe no service)
4. Implementar em `services.go` — validações de input vão aqui
5. `go test` → GREEN
6. Verificar coverage: `go test ./internal/core/services/ -cover` → deve ser >=70%

**Pattern do mock em graph_service_test.go**:
```go
type mockRepo struct {
    // campos existentes...
    novoResult  ReturnType
    novoErr     error
}
func (m *mockRepo) NovoMetodo(...) (ReturnType, error) {
    return m.novoResult, m.novoErr
}
```

**Pattern do service**:
```go
func (s *GraphService) NovoMetodo(param string) (ReturnType, error) {
    // Validações de input ficam AQUI (não no adapter)
    if strings.TrimSpace(param) == "" {
        return nil, errors.New("param must not be empty")
    }
    return s.repo.NovoMetodo(param)
}
```

**Pattern dos testes**:
```go
func TestNovoMetodo_Success(t *testing.T) {
    repo := &mockRepo{novoResult: expectedData}
    svc := NewGraphService(repo)
    result, err := svc.NovoMetodo("input")
    if err != nil { t.Fatalf("expected no error, got %v", err) }
    // assertions no result...
}

func TestNovoMetodo_Error(t *testing.T) {
    repo := &mockRepo{novoErr: errors.New("fail")}
    svc := NewGraphService(repo)
    _, err := svc.NovoMetodo("input")
    if err == nil { t.Fatal("expected error, got nil") }
}
```

### Step 3: Adapter (implementação concreta)

**Arquivos**: `internal/adapters/gremlin/gremlin.go` + `repository_test.go`

1. **TEST FIRST** — Escrever `TestNovoMetodo_NotConnected` (pattern existente)
2. Escrever testes para helpers/parsers se criados
3. `go test` → RED
4. Implementar usando a lib gremlin-go (`r.conn` e `r.g`)
5. `go test` → GREEN

**Pattern not-connected test**:
```go
func TestNovoMetodo_NotConnected(t *testing.T) {
    repo := NewRepository()
    _, err := repo.NovoMetodo("input")
    if err == nil { t.Fatal("expected error when not connected, got nil") }
}
```

**Pattern do adapter**:
```go
func (r *Repository) NovoMetodo(param string) (ReturnType, error) {
    if r.conn == nil {
        return nil, errors.New("not connected to a Gremlin Server")
    }
    // Usar r.g (GraphTraversalSource) para queries fluent
    // Usar r.conn.Submit(string) para raw queries
    // ...
}
```

**APIs gremlin-go disponíveis**:
- `r.g.V().HasLabel(l).ElementMap().ToList()` → `[]*Result, error` (fluent API)
- `r.conn.Submit(queryString)` → `ResultSet, error` (raw query)
- `resultSet.All()` → `[]*Result, error`
- `result.GetInterface()` → `interface{}`
- Tipos retornáveis: `*gremlingo.Vertex`, `*gremlingo.Edge`, `*gremlingo.Path`, `*gremlingo.VertexProperty`, `*gremlingo.Property`, `map[interface{}]interface{}`, primitivos

**IMPORTANTE**: `map[interface{}]interface{}` NÃO é JSON-serializável. Sempre converter para `map[string]interface{}` via `fmt.Sprintf("%v", key)`.

### Step 4: App Binding (expor ao frontend)

**Arquivos**: `app.go` + `app_test.go`

1. **TEST FIRST** — Atualizar `mockGraphService` no test file:
   - Adicionar campos + método
2. Escrever `TestApp_NovoMetodo_Success` e `TestApp_NovoMetodo_Error`
3. `go test` → RED
4. Adicionar à interface `graphService` em `app.go`
5. Adicionar método público no `App` struct
6. `go test` → GREEN

**Pattern da interface local (app.go)**:
```go
type graphService interface {
    // métodos existentes...
    NovoMetodo(param string) (ReturnType, error)
}
```

**Pattern do binding**:
```go
func (a *App) NovoMetodo(param string) (ReturnType, error) {
    return a.service.NovoMetodo(param)
}
```

**Pattern do mock em app_test.go**:
```go
type mockGraphService struct {
    // campos existentes...
    novoResult  ReturnType
    novoErr     error
}
func (m *mockGraphService) NovoMetodo(param string) (ReturnType, error) {
    return m.novoResult, m.novoErr
}
```

### Step 5: Verificar tudo

```bash
go test ./... -cover
```

Coverage targets: domain 100%, services >=70%, adapters >=35%, app >=30%.

### Step 6: Frontend

Ordem: **controller → testes → view → CSS → main.js**

Consultar `/mvc-observable` para patterns detalhados de cada componente.

#### 6a. AppModel (`frontend/src/model/app-model.js`)

Adicionar campos de estado no `super()`:
```js
super({
    // existentes...
    novoField: null,
    novoLoading: false,
});
```

#### 6b. Controller (`frontend/src/controller.js`)

Adicionar handler na classe Controller. So faz `model.set()` + `backend.call()`, zero DOM:
```js
async handleNovo(param) {
    this.model.set('novoLoading', true);
    try {
        const result = await this.backend.call('NovoMetodo', param);
        this.model.set('novoField', result);
    } catch (err) {
        this.model.set('error', typeof err === 'string' ? err : err.message || 'Failed');
    } finally {
        this.model.set('novoLoading', false);
    }
}
```

#### 6c. Testes do Controller (`frontend/test/controller.test.js`)

Adicionar testes com mock do backend:
```js
describe('handleNovo', () => {
    it('on success: sets novoField', async () => {
        const backend = createMockBackend({ NovoMetodo: expectedResult });
        const ctrl = new Controller(model, backend);
        await ctrl.handleNovo('param');
        assert.deepEqual(model.get('novoField'), expectedResult);
        assert.equal(model.get('novoLoading'), false);
    });

    it('on failure: sets error', async () => {
        const backend = createMockBackend({ NovoMetodo: new Error('fail') });
        const ctrl = new Controller(model, backend);
        await ctrl.handleNovo('param');
        assert.equal(model.get('error'), 'fail');
    });
});
```

Rodar: `node --test frontend/test/controller.test.js`

#### 6d. View (`frontend/src/view/nova-view.js`)

Criar nova View class extends BaseView:
```js
import { BaseView } from './base-view.js';
import { escapeHtml } from '../utils.js';

export class NovaView extends BaseView {
    constructor(model, controller) {
        super(model, controller);
        this.subscribe('novoField', () => this.update());
        this.subscribe('novoLoading', () => this.updateLoading());
    }

    mount(container) {
        super.mount(container);
        this.el = document.createElement('div');
        this.el.className = 'novo-container';
        this.el.innerHTML = `<!-- HTML -->`;
        container.appendChild(this.el);
        this._bindEvents();
        this.update();
    }

    _bindEvents() {
        this.el.querySelector('.action-btn')
            .addEventListener('click', () => this.controller.handleNovo('param'));
    }

    update() {
        if (!this.el) return;
        const data = this.model.get('novoField');
        // re-renderizar baseado no estado
    }

    updateLoading() {
        if (!this.el) return;
        const btn = this.el.querySelector('.action-btn');
        const loading = this.model.get('novoLoading');
        if (btn) {
            btn.disabled = loading;
            btn.textContent = loading ? 'Loading...' : 'Action';
        }
    }
}
```

#### 6e. Wiring (`frontend/src/main.js`)

Importar e montar a nova View:
```js
import { NovaView } from './view/nova-view.js';
// dentro da funcao mountMain():
const nova = new NovaView(model, controller);
nova.mount(container);
views.push(nova);
```

#### 6f. CSS (`frontend/src/style.css`)

**Cores do design system**:
- Background: `#1b2636`
- Sidebar/headers: `#1e2a3a`
- Input/hover bg: `#253040`
- Border: `#2a3a4c`
- Accent (primary): `#5a9fd4`
- Accent hover: `#4a8fc4`
- Text primary: `#e0e0e0`
- Text secondary: `#6a7a8a`
- Text on accent: `#fff`
- Error: `#e57373`
- Success/code: `#a0d0a0`

**Pattern de overlay**:
```css
.novo-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}
.novo-panel {
    width: 80%;
    height: 80%;
    background: #1b2636;
    border: 1px solid #2a3a4c;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
```

**Pattern de botão primary**:
```css
.btn-primary {
    padding: 6px 16px;
    border: none;
    border-radius: 4px;
    background: #5a9fd4;
    color: #fff;
    font-size: 13px;
    cursor: pointer;
}
.btn-primary:hover { background: #4a8fc4; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
```

### Step 7: Teste manual

```bash
wails dev
```

1. Conectar ao Gremlin Server
2. Testar a nova feature
3. Verificar golden path + edge cases na UI

### Step 8: Refactor — executar `/refactor`

Rodar a skill `/refactor` para analisar coesao dos arquivos editados e dividir em modulos menores se necessario.

---

## Checklist Resumo

- [ ] Port: novo método na interface `GraphRepository`
- [ ] Port test: mock atualizado + compile-time check passa
- [ ] Service test: testes escritos ANTES (red)
- [ ] Service: implementação mínima (green), coverage >=70%
- [ ] Adapter test: testes escritos ANTES (red)
- [ ] Adapter: implementação (green)
- [ ] App test: testes escritos ANTES (red)
- [ ] App: interface + binding (green)
- [ ] `go test ./... -cover` — tudo verde
- [ ] Frontend: AppModel state → Controller handler → Controller test → View class → CSS → main.js wiring
- [ ] `node --test frontend/test/*.test.js` — testes frontend passando
- [ ] `wails dev` — teste manual funcional
- [ ] `/refactor` — analise de coesao dos arquivos editados
