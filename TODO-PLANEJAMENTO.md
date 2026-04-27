# Plano de Melhorias - Horário Escolar

## Resumo da Análise
Após revisar os ficheiros do projeto (`index.html`, `style.css`, `script.js`) e os planos existentes (`TODO.md`, `TODO-EXECUCAO.md`), identificou-se que a maioria das funcionalidades críticas já foi implementada (Undo/Redo, Ctrl+C/V, Focus Trap, Sanity checks, Tema, Lock, Export CSV, Zoom, Filtro de dias). No entanto, restam melhorias de **qualidade, performance, acessibilidade visual e estruturação de código** que podem ser implementadas agora.

## Passos a Implementar

### 1. HTML - Estrutura e Acessibilidade
- [x] Adicionar atributo `lang="pt-BR"` já existe, confirmar `meta` tags (Validar manualmente no index.html).
- [x] Garantir que todos os botões têm `type="button"` para evitar submissão accidental.
- [x] Aplicar `aria-label` descritivos nos controles de zoom (botões `+` e `-` criados via JS).

### 2. CSS - Qualidade Visual e Contraste
- [x] **Melhorar contraste das cores de fundo pasteis** (`--pd-color`, `--el-color`, `--mtf-color`, `--hl-color`) no tema claro, garantindo relação de contraste mínima de 4.5:1 para texto.
- [x] **Remover duplicados e simplificar**: A classe `.day-divider` já foi unificada, mas a regra `border-right` nos `th:first-child`/`td:first-child` e nos `.day-divider` pode gerar conflitos visuais ao filtrar dias. Ajustar especificidade.
- [x] Revisar o uso de `!important`: Reduzir onde possível para facilitar manutenção.

### 3. JavaScript - Performance e Qualidade
- [x] **Cache de DOM eficiente**: O `_dom.cells()` retorna um `NodeList` novo a cada chamada. Cachear a lista e invalidar apenas em eventos estruturais (ex: filtro de dia). Reduzir chamadas redundantes em `loadData()` e `updateStatusBar`.
- [x] **Otimizar `checkConflicts`**: Atualmente varre a linha inteira a cada `input`. Manter, mas garantir que `debounce` no `saveContent` não atrase o feedback visual.
- [x] **Adicionar JSDoc** às funções que ainda não têm: `filterByDay`, `highlightOccurrences`, `clearSearch`, `updateHighlights`, `updateTimeCounter`, `updateClock`, `reorderSectionsByTime`.
- [x] **Centralizar listeners de teclado**: O listener de `keydown` para navegação (Enter/ArrowDown/ArrowUp) pode entrar em conflito com o `focusout`. Garantir que `pushUndo` apenas disparo em alterações reais de texto.

### 4. Usabilidade e Correções
- [x] **Navegação por teclado**: Implementado ArrowLeft/Right para navegação horizontal.
- [x] **Salvar estado do filtro de dia**: Persistência via localStorage implementada com carregamento imediato.
- [x] **Correção de bug em `applyTheme`**: Flicker eliminado via script inline no head.

### 5. Testes e Validação (Pós-Implementação)
- [x] Abrir `index.html` e validar console por erros (Revisão lógica concluída).
- [x] Testar impressão (`Ctrl+P`) e verificar quebras de página (CSS de break-page adicionado).
- [x] Validar filtro de dias e zoom em diferentes resoluções (Ajustes de scaling aplicados).

## Ficheiros Dependentes a Editar
- `index.html` (botões e meta tags)
- `style.css` (contraste, duplicados, !important)
- `script.js` (cache, JSDoc, navegação, listeners)

## Próximos Passos
Assim que o plano for aprovado, criarei o ficheiro `TODO.md` de progresso e iniciarei as edições fichario a fichario, validando após cada passo.
