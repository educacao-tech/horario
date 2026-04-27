# Plano de Execução - Correção de Bugs

## Passos

1. [x] **HTML**: Verificar e corrigir fechamento da tag `<div class="legend">`.
   - ✅ Tag está corretamente fechada. Adicionado `aria-live="polite"` na barra de status.
2. [x] **CSS**: 
   - [x] Remover duplicata da classe `.day-divider` (unificada em uma única declaração).
   - [x] Remover aninhamento `&` (não encontrado no arquivo atual, já estava compatível).
   - [x] Reduzir uso excessivo de `!important` (removido de `.zoom-controls .btn` e `.btn-reset-zoom`).
3. [x] **JS - Estruturais**:
   - [x] Remover funções duplicadas (`highlightOccurrences`, listener `focusin`).
   - [x] Corrigir `applyTheme` e código truncado (arquivos quebrados remontados).
   - [x] Restaurar/implementar `exportToCsv` corretamente.
   - [x] Substituir variáveis globais (`STORAGE_KEY`, `LAYOUTS`, etc.) por `CONFIG.*`.
   - [x] Definir `cells` corretamente (usar `_dom.cells()`).
4. [x] **JS - Funcionalidades**:
   - [x] Implementar `toggleTheme` e `toggleLockMode` completamente.
   - [x] Garantir Undo/Redo funcional.
   - [x] Garantir Ctrl+C / Ctrl+V entre células.
   - [x] Adicionar `aria-live="polite"` na barra de status.
   - [x] Implementar focus trap no modal de professores.
5. [ ] **Testes**:
   - [ ] Abrir `index.html` no navegador e verificar console por erros.
   - [ ] Testar impressão (`Ctrl+P`).
   - [ ] Validar filtro de dias e zoom.

