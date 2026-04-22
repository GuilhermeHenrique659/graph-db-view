---
name: refactor
description: Analisa coesao dos arquivos editados e divide em modulos menores se necessario. Use ao final de uma task, apos implementar uma feature, ou quando o usuario pedir para revisar/refatorar arquivos. Triggers on "refactor", "refatorar", "analisar coesao", "dividir arquivo", "modularizar", "arquivo grande", "simplify".
---

# Refactor — Analise de Coesao e Modularizacao

## Quando executar

- Ao final de cada feature implementada (Step 8 do workflow `/new-feature`)
- Quando o usuario pedir explicitamente para refatorar
- Quando notar um arquivo crescendo demais durante implementacao

## Passo a passo

### 1. Identificar arquivos candidatos

Contar linhas de cada arquivo editado/criado na task:

```bash
wc -l <arquivo>
```

**Thresholds**:
- Go / JS: > 200 linhas → analisar
- CSS: > 300 linhas → analisar
- Arquivos de teste (`_test.go`): ignorar (testes grandes sao aceitaveis)

Se nenhum arquivo passa do threshold → reportar que tudo esta coeso e encerrar.

### 2. Analisar coesao do arquivo

Para cada arquivo que passou do threshold, responder 3 perguntas:

1. **Responsabilidade unica** — o arquivo faz mais de uma coisa? Cada arquivo deve ter um motivo claro para existir.
2. **Agrupamento logico** — as funcoes/structs se relacionam entre si? Ou existem grupos distintos que poderiam ser separados?
3. **Acoplamento interno** — as funcoes dependem umas das outras ou sao independentes? Grupos independentes sao candidatos a split.

### 3. Mapear clusters

Identificar **clusters de funcoes** dentro do arquivo:

- Funcoes que se chamam entre si → mesmo cluster
- Funcoes que operam no mesmo tipo/struct → mesmo cluster
- Funcoes utilitarias genericas sem relacao com o dominio principal do arquivo → cluster separado

**Se existe apenas 1 cluster** → arquivo esta coeso, nao dividir.
**Se existem 2+ clusters distintos** → candidato a split.

### 4. Decidir: dividir ou nao

**DIVIDIR quando**:
- 2+ clusters que nao se chamam entre si
- Helper grande (ex: funcao recursiva com muitos cases) que poderia ser seu proprio modulo
- Bloco de CSS de uma feature especifica misturado com estilos base

**NAO dividir quando**:
- Tudo se relaciona fortemente (mesmo que >200 linhas)
- Dividir criaria acoplamento cruzado entre os novos arquivos
- Dividir criaria arquivos pequenos demais (<50 linhas) sem identidade propria

**NUNCA criar dependencia circular**:
- Antes de mover codigo, mapear o grafo de dependencias: quem importa quem
- Se A importa B, entao B NUNCA pode importar A (nem indiretamente via C)
- Ao dividir um arquivo em dois (ex: `gremlin.go` → `gremlin.go` + `normalize.go`), a dependencia so pode fluir em uma direcao
- No Go, dependencia circular entre packages causa erro de compilacao — mas dentro do mesmo package (mesmo diretorio) nao ha esse guard, entao a disciplina e manual
- No frontend (JS modules), circular imports causam `undefined` silencioso em runtime — mais perigoso que Go porque nao da erro na build
- **Teste rapido**: apos o split, verificar com `go vet ./...` (backend) e buscar por imports cruzados entre os novos arquivos (frontend)
- Se um split criaria dependencia circular, e sinal de que os clusters nao sao realmente independentes — **nao dividir**

**Regra de ouro**: um arquivo de 250 linhas coeso e melhor que 3 arquivos de 80 linhas com acoplamento cruzado.

### 5. Executar o split

Se decidiu dividir:

1. Criar novo arquivo no **mesmo diretorio** (mesmo package Go / mesmo `src/` no frontend)
2. Mover funcoes/blocos para o novo arquivo
3. Atualizar imports/exports
4. Rodar testes para garantir que nada quebrou:
   ```bash
   go test ./...                              # backend
   node --test frontend/test/*.test.js        # frontend
   wails dev                                  # verificar manualmente
   ```
5. Verificar que coverage nao caiu: `go test ./... -cover`

### 6. Reportar resultado

Ao final, listar:
- Arquivos analisados + contagem de linhas
- Decisao por arquivo (coeso / dividido)
- Se dividiu: quais clusters foram para qual arquivo

---

## Exemplos de splits validos neste projeto

| Arquivo original | Sinal de split | Resultado |
|---|---|---|
| `gremlin.go` (>200 linhas) | Repository methods + normalizeResult + parseVertex sao clusters distintos | `gremlin.go` (Repository) + `normalize.go` (normalizeResult + helpers de conversao) |
| `controller.js` (>200 linhas) | Handlers de navigation + handlers de query + handlers de graph | Dividir por dominio: `controller.js` (core) + criar Views separadas que absorvem logica |
| `style.css` (>300 linhas) | Blocos CSS por feature | `style.css` (base + layout) + `query.css` (estilos do query panel) |
| View class (>150 linhas) | Metodos de render + metodos de update + bind events muito grandes | Extrair helpers para `utils.js` ou criar sub-views |

## Exemplos onde NAO dividir

| Arquivo | Linhas | Por que manter junto |
|---|---|---|
| `services.go` (~50 linhas) | Todos os metodos delegam para o mesmo `repo` | Coeso: 1 struct, 1 responsabilidade |
| `app.go` (~50 linhas) | Todos os metodos delegam para o mesmo `service` | Coeso: binding layer puro |
| `observable.js` (~25 linhas) | Classe unica com 3 metodos | Trivial, nao precisa analisar |
| `app-model.js` (~25 linhas) | Extends Observable com estado inicial | Trivial, nao precisa analisar |
| `base-view.js` (~25 linhas) | Classe base com lifecycle helpers | Trivial, nao precisa analisar |
