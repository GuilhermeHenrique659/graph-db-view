# Spec: Visualizador de Grafo

## Resumo

Adicionar uma aba de visualização de grafo ao Gremlin Viewer. O usuário pode inserir uma query Gremlin que retorna paths, ou o sistema infere uma query automática para visualizar o banco inteiro. O frontend renderiza o grafo com vértices e arestas interativos (clicáveis para ver propriedades).

## Decisões Técnicas

| Decisão | Escolha |
|---------|---------|
| Renderização | Canvas/SVG puro (zero dependências extras) |
| Auto-query | `g.V().outE().inV().path().limit(100).by(__.elementMap())` |
| Layout UI | Nova aba/tab ao lado da tabela (sidebar de labels continua visível) |
| Layout algoritmo | Force-directed (spring simulation) |

## Requisitos Funcionais

### RF-01: Input de Query
- Campo de texto para o usuário inserir uma query Gremlin
- Se vazio, usa a auto-query padrão
- Botão "Executar" + Shift+Enter como atalho
- Validação: query não pode ser string vazia (quando explícita)

### RF-02: Auto-Query
- Query padrão: `g.V().outE().inV().path().limit(100).by(__.elementMap())`
- Retorna paths com elementMap (ID, label, properties de cada elemento)
- Limite de 100 paths para não sobrecarregar

### RF-03: Renderização do Grafo
- Canvas/SVG puro, sem bibliotecas externas
- Layout force-directed (simulação de molas)
- Vértices como círculos com label visível
- Arestas como linhas com label do edge
- Cores distintas por label do vértice
- Arestas direcionadas (seta indicando direção)

### RF-04: Interatividade
- **Click em vértice**: mostra painel lateral com ID, label e todas as properties
- **Click em aresta**: mostra painel lateral com ID, label, inV, outV e properties
- **Drag**: arrastar vértices para reposicionar
- **Zoom**: scroll do mouse para zoom in/out
- **Pan**: arrastar o canvas (fundo) para mover a visualização

### RF-05: Layout UI
- Nova aba/tab no conteúdo principal (ao lado da aba "Table")
- Sidebar de labels continua visível e funcional
- Tab "Table" = visão atual (tabela de vértices)
- Tab "Graph" = visualizador de grafo
- O input de query fica dentro da aba Graph (não no modal antigo)

## Requisitos Não-Funcionais

- Suportar até ~500 nós sem travar (performance razoável)
- Renderização responsiva (preenche o espaço disponível)
- Manter o dark theme consistente

## Camadas Afetadas

### Backend

#### Domain (`internal/core/domain/`)
- Novo modelo `Edge` (ID, Label, InV, InVLabel, OutV, OutVLabel, Properties)
- Novo modelo `GraphPath` (Objects []interface{} — alternando Vertex/Edge)
- Novo modelo `GraphData` (Vertices []Vertex, Edges []Edge) — estrutura "achatada" para o frontend

#### Port (`internal/core/ports/`)
- Novo método: `GetGraphPaths(query string) ([]GraphPath, error)`
  - Se query vazia, usa auto-query
  - Retorna paths parseados

#### Service (`internal/core/services/`)
- `GetGraphData(query string) (*GraphData, error)`
  - Chama `repo.GetGraphPaths(query)`
  - Converte paths em GraphData (deduplica vértices/arestas)
  - Retorna estrutura "achatada" para o frontend

#### Adapter Gremlin (`internal/adapters/gremlin/`)
- Implementar `GetGraphPaths`:
  - Se query vazia → submeter auto-query
  - Se query preenchida → submeter query do usuário
  - Parsear resultado como lista de paths
  - Cada path contém objetos alternados (vertex, edge, vertex, ...)

#### App Binding (`app.go`)
- Novo método `GetGraphData(query string) (*domain.GraphData, error)`
  - Delega para `service.GetGraphData(query)`

### Frontend

#### Model (`model.js`)
- `activeTab`: 'table' | 'graph'
- `graphData`: { vertices: [], edges: [] }
- `graphQuery`: string (query atual do visualizador)
- `selectedElement`: null | { type: 'vertex'|'edge', data: {...} }
- `graphLoading`: boolean

#### View (`view.js`)
- `renderTabs(activeTab, callbacks)` — tabs Table/Graph
- `renderGraphTab(graphData, selectedElement, callbacks)` — container do grafo
- `renderGraphCanvas(graphData)` — canvas SVG com force-directed layout
- `renderElementDetail(element)` — painel lateral com detalhes do elemento clicado

#### Controller (`controller.js`)
- `handleSwitchTab(tab)` — alterna entre table/graph
- `handleExecuteGraphQuery(query)` — chama backend + renderiza
- `handleSelectElement(element)` — mostra detalhes do vértice/aresta
- `handleDeselectElement()` — fecha painel de detalhes

#### CSS (`style.css`)
- Estilos das tabs
- Container do grafo (SVG)
- Painel de detalhes do elemento
- Estilos dos nós (círculos) e arestas (linhas)
- Cores por label

## Fluxo do Usuário

```
1. Conecta ao servidor → vê labels + aba Table ativa
2. Clica na aba "Graph"
3. Vê campo de query (pré-preenchido com auto-query) + botão Executar
4. Clica "Executar" (ou Shift+Enter)
5. Backend executa query → retorna GraphData
6. Frontend renderiza grafo com force-directed layout
7. Clica em um vértice → painel lateral mostra properties
8. Clica em uma aresta → painel lateral mostra properties + inV/outV
9. Arrasta vértice → reposiciona
10. Scroll → zoom in/out
11. Pode voltar à aba Table a qualquer momento
```

## Estimativa de Complexidade

| Camada | Arquivos | Estimativa |
|--------|----------|------------|
| Domain | 1 editado | Baixa |
| Port | 1 editado | Baixa |
| Service | 2 editados | Média |
| Adapter | 2 editados | Média |
| App | 2 editados | Baixa |
| Frontend Model | 1 editado | Baixa |
| Frontend View | 1 editado + 1 novo (graph renderer) | Alta |
| Frontend Controller | 1 editado | Média |
| CSS | 1 editado | Média |
| **Total** | ~12 arquivos | **Alta** |
