# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gremlin Viewer** is a visualization tool for graph databases that use the Gremlin query language (Apache TinkerPop). Inspired by traditional relational database GUI tools (like DBeaver, pgAdmin, TablePlus), it presents graph data in a tabular format organized by vertex labels — each label acts like a "table" showing all vertices with that label and their properties as columns.

### Core Concepts

- **Labels as tables**: Each unique vertex label in the graph is presented as a navigable table
- **Properties as columns**: Vertex properties become columns in the table view for that label
- **Gremlin connectivity**: Connects to any Gremlin-compatible graph database (JanusGraph, Neptune, CosmosDB, TinkerGraph, etc.)

## Tech Stack

- **Language**: Go — single binary output, easy to distribute
- **Desktop GUI**: [Wails](https://wails.io/) — Go backend + web frontend compiled into a native desktop app
- **Future**: CLI mode planned alongside the GUI (same Go backend, two frontends)

## Architecture

### Backend — Ports & Adapters (Hexagonal)

O core de domínio não conhece detalhes de infraestrutura. A comunicação com o mundo externo acontece via interfaces (ports), implementadas por adapters concretos.

```
internal/
  core/
    domain/     — modelos de domínio (Vertex, Label, Property)
    ports/      — interfaces (GraphRepository, ConnectionManager)
    services/   — lógica de negócio, orquestra ports
  adapters/
    gremlin/    — implementação concreta do GraphRepository via Gremlin
    wails/      — bindings Wails que expõem services ao frontend
cmd/
  desktop/      — entry point Wails
  cli/          — entry point CLI (futuro)
```

- **Ports** (`ports/`): interfaces Go que definem o que o core precisa (ex: `GraphRepository`)
- **Services** (`services/`): usam ports, nunca dependem de adapters diretamente
- **Adapters** (`adapters/`): implementam ports — Gremlin adapter, Wails bindings, futuro CLI adapter
- Testar o core é simples: basta injetar mocks dos ports

### Frontend — MVC com Observable

O frontend web (dentro do Wails) segue MVC com Model reativo (Observer pattern):

```
User Event → Controller → model.set(key, value) → Views notificadas automaticamente
```

- **Model** (`src/model/`): `Observable` genérico com subscribe per-key + `AppModel` que define o estado da app. Cada `set()` notifica apenas os subscribers daquela chave.
- **View** (`src/view/`): classes que estendem `BaseView`. Cada View faz `subscribe(key, callback)` no Model e se atualiza sozinha quando notificada. Gerencia seu próprio DOM.
- **Controller** (`src/controller.js`): classe pura — recebe Model + Backend no constructor. Handlers só fazem chamadas ao backend e `model.set()`. Zero referência a DOM ou Views.
- **Backend** (`src/backend.js`): wrapper isolado dos bindings Wails (`window.go.main.App`), facilitando mock nos testes.

```
frontend/src/
  model/
    observable.js       — classe Observable (subscribe/set/get per-key)
    app-model.js        — AppModel extends Observable (17 keys de estado)
  view/
    base-view.js        — classe base com mount/destroy/subscribe helpers
    connection-view.js  — tela de conexão
    sidebar-view.js     — lista de labels
    table-view.js       — tabela de vértices
    graph-view.js       — visualização do grafo + query bar
    query-panel-view.js — modal de query raw
  controller.js         — handlers de evento + chamadas backend + model.set()
  backend.js            — wrapper Wails bindings
  graph.js              — force-directed graph (SVG puro, sem MVC)
  utils.js              — escapeHtml, filterLabels, filterVertices
  main.js               — entry point, instancia Model → Controller → Views

frontend/test/
  observable.test.js    — testes do Observable (node:test)
  app-model.test.js     — testes do AppModel
  controller.test.js    — testes do Controller com mock do backend
```

## Regras de Negócio (GUI)

### 1. Conexão

- Ao iniciar, a app exibe uma tela pedindo a URL do Gremlin Server (formato: `ws://host:porta/gremlin`)
- Compatível com Neptune, Gremlin Server e JanusGraph
- Se a conexão falhar, exibe o erro e pede uma nova URL (não trava, não fecha)

### 2. Navegação por Labels

- Ao conectar com sucesso, executa uma query para listar todos os vertex labels do grafo
- Os labels são exibidos em uma **navbar/sidebar**
- Ao clicar em um label:
  - Busca todos os vértices com aquele label
  - Exibe em **tabela**: colunas = property keys, linhas = valores de cada vértice

## Workflow por Task (TDD)

Para cada tarefa, seguir este ciclo:

1. **Escrever teste do caminho feliz** — antes de qualquer implementação
2. **Rodar o teste** — deve falhar (red)
3. **Implementar o mínimo** para o teste passar (green)
4. **Rodar os testes** — se passar, continuar; se falhar, corrigir
5. **Avaliar cobertura** — identificar cenários faltando (erros, edge cases) e adicionar mais testes
6. **Repetir** passos 2-5 até cobertura > 70% na package
7. **Commitar** — só quando todos os testes passam e cobertura está adequada

```bash
# Rodar testes com cobertura
go test ./internal/... -cover

# Cobertura detalhada por package
go test ./internal/... -coverprofile=coverage.out && go tool cover -func=coverage.out
```

## Build & Dev Commands

```bash
# Install Wails CLI (prerequisite)
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Run in dev mode (hot reload)
wails dev

# Build production binary
wails build

# Run tests
go test ./...

# Run a single test
go test ./internal/gremlin -run TestFunctionName

# Run frontend tests (node:test)
node --test frontend/test/*.test.js
```
