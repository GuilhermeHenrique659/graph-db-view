# Gremlin Viewer

Uma interface desktop para explorar bancos de dados de grafo que utilizam [Gremlin](https://tinkerpop.apache.org/gremlin.html) — a linguagem de consulta do Apache TinkerPop.

Se você já quis navegar em um banco de grafos da mesma forma que o DBeaver ou TablePlus permitem navegar em bancos relacionais, essa ferramenta é pra você. O Gremlin Viewer trata cada **vertex label como uma tabela**, transformando propriedades em colunas e vértices em linhas, permitindo explorar o grafo sem precisar escrever queries para cada consulta.

## Feito por IA

A arquitetura e as decisões técnicas foram feitas por um humano. Todo o código — backend, frontend e testes — foi 100% escrito por agentes de IA (Claude Code).

## Funcionalidades

**Visualização em Tabela** — Navegue pelos vértices organizados por label. Paginado, filtrável por propriedade (`name=John`), com linhas expansíveis que mostram relacionamentos de entrada e saída.

**Visualização em Grafo** — Grafo interativo com layout force-directed renderizado em SVG puro. Arraste nós, clique para inspecionar propriedades e execute traversals customizados. Vértices são coloridos por label.

**Painel de Query** — Execute queries Gremlin arbitrárias e veja os resultados como JSON formatado. Útil para exploração ad-hoc ou debug de traversals.

**Gerenciamento de Conexão** — Aponte para qualquer endpoint compatível com Gremlin (`ws://host:porta/gremlin`) e comece a explorar. Troque de conexão sem reiniciar.

## Bancos de Dados Compatíveis

Qualquer banco que exponha um endpoint WebSocket Gremlin:

- Apache TinkerPop Gremlin Server
- Amazon Neptune
- JanusGraph
- Azure Cosmos DB (Gremlin API)
- TinkerGraph (local/embarcado)

## Como Usar

1. **Conectar** — Insira a URL do servidor Gremlin (padrão: `ws://localhost:8182/gremlin`)
2. **Navegar pelos labels** — A sidebar lista todos os vertex labels do grafo
3. **Explorar dados** — Clique em um label para ver seus vértices em tabela; alterne para a aba Grafo para uma visão visual
4. **Consultar** — Use o painel de query para qualquer coisa que a interface ainda não cubra

## Como Começar

### Pré-requisitos

- [Go 1.25+](https://go.dev/dl/)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```
- Um banco Gremlin rodando (ou use a [imagem Docker do TinkerPop](https://tinkerpop.apache.org/docs/current/reference/#gremlin-server-docker))

### Rodar em Desenvolvimento

```bash
wails dev
```

Abre a app com hot reload. Um servidor de dev também fica disponível em `http://localhost:34115` para desenvolvimento no browser com acesso aos bindings Go.

### Build de Produção

```bash
wails build
```

Gera um binário nativo único (`gremlin-viewer`) — sem dependências de runtime.

## Tech Stack

| Camada   | Tecnologia                       |
|----------|----------------------------------|
| Backend  | Go + Apache TinkerPop Gremlin-Go |
| Frontend | Vanilla JS (Observable MVC)      |
| Desktop  | Wails v2                         |
| Build    | Vite                             |

## Arquitetura

O backend segue **arquitetura hexagonal** (ports & adapters): a lógica de domínio depende de interfaces, não de infraestrutura. O frontend usa um padrão **Observable MVC** onde mudanças no model propagam automaticamente para as views via subscriptions por chave.

```
backend:   App ─→ Service ─→ Port (interface) ←─ Gremlin Adapter
frontend:  User Event → Controller → Model.set() → Views re-render
```

## Testes

```bash
# Backend
go test ./...

# Frontend
node --test frontend/test/*.test.js
```
