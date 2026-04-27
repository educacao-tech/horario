# Sugestões de Melhorias - Horário Escolar

> Documento de sugestões para evolução do projeto, organizado por impacto e complexidade de implementação.

---

## 🚀 Alta Prioridade (Alto Impacto / Baixa Complexidade)

### 1. Preenchimento Inteligente (Fill Down)
- **Descrição**: Permitir `Ctrl+D` para copiar o conteúdo da célula atual para a célula abaixo (similar ao Excel/Google Sheets).
- **Valor**: Agiliza massivamente o preenchimento de horários repetidos.
- **Implementação**: Adicionar listener de `keydown` para `Ctrl+D`.

### 2. Modal de Atalhos de Teclado
- **Descrição**: Botão "⌨️ Atalhos" na toolbar que abre um modal listando todos os atalhos disponíveis (Ctrl+Z, Ctrl+Y, Ctrl+C/V, Arrow keys, etc).
- **Valor**: Melhora a descoberta de funcionalidades e a experiência do usuário.
- **Implementação**: Criar função `showShortcutsModal()` similar ao `openTeacherManager()`.

### 3. Indicador Global de Conflitos
- **Descrição**: Badge vermelho na toolbar mostrando o número total de conflitos de horário ativos na página. Clicar leva para o primeiro conflito.
- **Valor**: Visibilidade imediata de problemas sem precisar varrer a tabela manualmente.
- **Implementação**: Contador em `validateAllConflicts()` + elemento na UI.

### 4. Toast/Notificações (em vez de Alerts)
- **Descrição**: Substituir todos os `alert()` e `confirm()` por notificações toast elegantes que aparecem no canto superior direito e somem automaticamente.
- **Valor**: Alerts bloqueiam a interface. Toasts são não-intrusivos.
- **Implementação**: Criar função `showToast(message, type)` com CSS de animação slide-in.

### 5. Duplicar Horário de um Dia
- **Descrição**: No cabeçalho de cada dia (Segunda, Terça...), adicionar um botão "📋 Copiar" que copia todos os horários desse dia para a área de transferência, e um botão "📥 Colar" em outro dia.
- **Valor**: Útil quando dois dias têm horários similares. Evita preenchimento manual repetitivo.
- **Implementação**: Serializar/colunar dados de um dia específico usando o layout do CONFIG.

---

## ⚡ Média Prioridade (Alto Impacto / Média Complexidade)

### 6. Células com Autocompletar (Dropdown)
- **Descrição**: Ao digitar em uma célula, mostrar um dropdown com sugestões baseadas nos valores já existentes na tabela (turmas, siglas, etc).
- **Valor**: Reduz erros de digitação e acelera o preenchimento.
- **Implementação**: Criar elemento `<datalist>` ou div flutuante de sugestões posicionada absolutamente.

### 7. Mapa de Calor dos Professores
- **Descrição**: Nova aba/modal "Estatísticas" que mostra um grid visual com a carga horária de cada professor/turma por dia.
- **Valor**: Identificar sobrecarga de professores ou turmas com poucas aulas visualmente.
- **Implementação**: Varre todas as células, conta ocorrências por professor e gera uma tabela resumo.

### 8. Backup Automático com Histórico
- **Descrição**: Além do `localStorage` principal, manter as últimas 5 versões do estado (snapshots) com timestamp. Permitir restaurar versão anterior.
- **Valor**: Segurança contra alterações acidentais ou erros de importação.
- **Implementação**: Array de snapshots no localStorage com limite de 5 entradas.

### 9. Modo Compacto / Expandido
- **Descrição**: Toggle na toolbar que reduz o padding das células (`padding: 6px 4px`), diminui fonte e remove sombras para maximizar a quantidade de conteúdo visível.
- **Valor**: Essencial para telas menores ou quando se quer ver a semana inteira sem scroll.
- **Implementação**: Classe CSS `.compact-mode` que sobrescreve padding, font-size e shadows.

### 10. Exportar para PDF Nativo
- **Descrição**: Botão "📄 Exportar PDF" que usa `window.print()` com estilos otimizados OU integração com biblioteca como `html2canvas` + `jsPDF`.
- **Valor**: PDF é formato padrão para compartilhamento de horários. Melhor que CSV para visualização.
- **Implementação**: Opção A: melhorar ainda mais o `@media print`. Opção B: adicionar biblioteca.

---

## 🔮 Baixa Prioridade / Recursos Avançados (Alto Impacto / Alta Complexidade)

### 11. Seleção Múltipla de Células
- **Descrição**: Permitir selecionar várias células com `Shift+Click` ou `Ctrl+Click` e aplicar operações em massa (preencher, limpar, copiar).
- **Valor**: Edição em massa, similar a planilhas.
- **Implementação**: Rastrear estado de seleção, highlight visual, aplicar listeners diferenciados.

### 12. Sincronização na Nuvem (Simulada)
- **Descrição**: Exportar o estado completo como um arquivo `.json` de backup com um clique, e importar arrastando o arquivo para a página (drag & drop).
- **Valor**: Backup portátil entre dispositivos.
- **Implementação**: `dragover`/`drop` listeners no document + `FileReader`.

### 13. Cores Personalizáveis por Categoria
- **Descrição**: No modal de configurações, permitir o usuário escolher as cores para HL, PD, EL, MTF, etc.
- **Valor**: Acessibilidade (daltonismo) e preferência pessoal.
- **Implementação**: Input type="color" no modal + variáveis CSS dinâmicas via `document.documentElement.style.setProperty()`.

### 14. Integração com Calendário (ICS)
- **Descrição**: Exportar aulas individuais para arquivo `.ics` (formato iCalendar) que pode ser importado no Google Calendar/Outlook.
- **Valor**: Professores podem adicionar suas aulas ao calendário pessoal.
- **Implementação**: Gerar string no formato ICS com datas recorrentes.

### 15. Responsividade Avançada (Mobile First)
- **Descrição**: Em telas pequenas (< 768px), transformar a tabela em cards verticais por dia ou usar scroll horizontal otimizado com indicadores de posição.
- **Valor**: Uso em tablets e celulares durante reuniões.
- **Implementação**: Media queries específicas + possível reestruturação do DOM via JS para mobile.

---

## 📋 Resumo de Categorias

| Categoria | Contagem | Exemplos |
|-----------|----------|----------|
| Usabilidade | 6 | Fill Down, Autocomplete, Toasts, Atalhos, Modo Compacto, Duplicar Dia |
| Visualização | 3 | Mapa de Calor, PDF, Responsividade |
| Segurança/Dados | 3 | Backup Auto, Sincronização, Histórico |
| Integração | 2 | ICS, Exportar/Importar |
| Personalização | 1 | Cores Personalizáveis |

---

## 🎯 Recomendação de Ordem de Implementação

Se quiser continuar evoluindo o projeto, sugiro esta ordem:

1. **Toast/Notificações** (base para todas as outras melhorias)
2. **Fill Down (Ctrl+D)** (impacto imediato no dia-a-dia)
3. **Indicador de Conflitos** (qualidade e prevenção de erros)
4. **Modal de Atalhos** (descoberta de funcionalidades)
5. **Autocompletar nas Células** (velocidade de preenchimento)
6. **Mapa de Calor / Estatísticas** (valor analítico)
7. **Backup Automático** (segurança dos dados)
8. **PDF Nativo / ICS** (compartilhamento profissional)

---

*Documento criado para referência futura. Marcar itens conforme implementação.*

