# Plano de Melhorias - Horário Escolar

## Passos a implementar

1. **Correção de Bug Estrutural (HTML)**
   - [ ] Fechar a tag `<div class="legend">` corretamente antes do `.toolbar`.

2. **Compatibilidade CSS**
   - [ ] Remover aninhamento `&` do CSS (CSS Nesting) para compatibilidade com navegadores antigos.
   - [ ] Remover duplicatas (`.day-divider` declarado duas vezes).
   - [ ] Reduzir uso excessivo de `!important` onde não for necessário.

3. **Sanitização e Validação de Dados (JS)**
   - [ ] Interceptar evento `paste` para colar apenas texto puro (`text/plain`).
   - [ ] Adicionar `SCHEMA_VERSION` ao localStorage para futuras migrações.

4. **Desempenho (JS)**
   - [ ] Cachear referências de tabelas/linhas no escopo do módulo.
   - [ ] Evitar reprocessar toda a tabela quando apenas uma célula muda.

5. **Undo / Redo (JS)**
   - [ ] Implementar pilha de comandos personalizada para `Ctrl+Z` / `Ctrl+Y`.

6. **Acessibilidade (HTML/JS/CSS)**
   - [ ] Adicionar `aria-live="polite"` na barra de status.
   - [ ] Implementar focus trap no modal de professores.
   - [ ] Melhorar contraste de cores de fundos pasteis.

7. **Cópia entre Células (JS)**
   - [ ] Permitir `Ctrl+C` / `Ctrl+V` entre células editáveis como texto puro.

8. **Qualidade de Código (JS)**
   - [ ] Centralizar configurações (senha, chaves de storage, layouts) em objeto `CONFIG`.
   - [ ] Documentar funções complexas com JSDoc.

## Próximos passos
- [ ] Testar impressão (`Ctrl+P`) após alterações no CSS.
- [ ] Validar funcionamento no mobile.
- [ ] Verificar filtro de dias e zoom.

