const STORAGE_KEY = 'school_schedule_v1';
const THEME_KEY = 'school_schedule_theme';
const TEACHER_REGISTRY_KEY = 'school_teachers_v1';
const FILTER_DAY_KEY = 'school_filter_day_v1';
const cells = document.querySelectorAll('[contenteditable="true"]');

const LAYOUTS = {
  morning: [6, 5, 4, 4, 5],
  afternoon: [5, 4, 4, 5, 4]
};

// Mapeamento de Professores (Edite aqui para vincular nomes)
const SPECIALIST_SIGLAS = ['A(S)', 'A(M)', 'EF(M)', 'EF(P)', 'CT(D)', 'EDM(L)', 'EDM', 'EL', 'MTF', 'PI', 'PII'];
const DATA_CATEGORIES = ['HL', 'HTPC', 'PD', 'EL', 'MTF'];

// Mapa padrão (Fallback caso o storage esteja vazio)
const DEFAULT_TEACHER_MAP = {
  'A(S)': 'Artes - Silvia',
  'A(M)': 'Artes - Michelle',
  'EF(M)': 'Ed. Física - Marcela',
  'EF(P)': 'Ed. Física - Paulo',
  'CT(D)': 'Composta - Danilo',
  'EDM(L)': 'EDM - Letícia',
  'EDM': 'EDM - Titulares',
  'EL': 'Elefante Letrado',
  'MTF': 'Matific',
  'PI': 'Projeto I', // Manter se ainda for relevante
  'PII': 'Projeto II', // Manter se ainda for relevante
  '1A': 'Mônica (1ºA)',
  '1B': 'Angélica (1ºB)',
  '1C': 'Suellen (1ºC)',
  '1D': 'Leila (1ºD)',
  '2A': 'Luci (2ºA)',
  '2B': 'Renata (2ºB)',
  '2C': 'Jesilda (2ºC)',
  '3A': 'Adriana (3ºA)',
  '3B': 'Nayra (3ºB)',
  '3C': 'Lúcia (3ºC)',
  '3D': 'Bruna (3ºD)',
  '4A': 'Jozeli (4ºA)',
  '4B': 'Áurea (4ºB)',
  '5A': 'Luciana (5ºA)',
  '5B': 'Solange (5ºB)',
  '5C': 'Camila (5ºC)'
};

// Getter centralizado para o Mapa de Professores para garantir dados sempre frescos
function getTeacherMap() {
  try {
    const stored = localStorage.getItem(TEACHER_REGISTRY_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_TEACHER_MAP;
  } catch (e) {
    return DEFAULT_TEACHER_MAP;
  }
}

// Função para atrasar o salvamento (Debounce)
function debounce(func, timeout = 500) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

// Gera uma chave única para a célula baseada no contexto (Período + Horário + Especialista)
function getCellKey(cell) {
  const table = cell.closest('table');
  const section = cell.closest('section, div[id^="section-"]');
  const sectionId = section ? section.id : 'unknown';
  const rowIndex = cell.parentElement.rowIndex;
  const colIndex = cell.cellIndex;
  const time = table.rows[rowIndex].cells[0].innerText.trim();
  const specialist = table.rows[1].cells[colIndex - 1]?.innerText.trim() || `col_${colIndex}`;
  return `sched_${sectionId}_${time}_${specialist}`.replace(/[^a-zA-Z0-9]/g, '_');
}

const saveContent = debounce((key, text) => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data[key] = text;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    const indicator = document.getElementById('save-indicator');
    if (indicator) {
      indicator.style.opacity = '1';
      setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
    }
  } catch (e) {
    console.error("Erro ao salvar no localStorage. O limite pode ter sido excedido.", e);
    alert("Erro crítico: Não foi possível salvar as alterações. Verifique o espaço do navegador.");
  }
});

// Detecta se a mesma turma está em duas salas no mesmo horário
function checkConflicts(cell) {
  const rawText = cell.innerText.trim().toUpperCase();
  if (!rawText || rawText === '*' || SPECIALIST_SIGLAS.includes(rawText)) {
    cell.classList.remove('conflict-error');
    cell.removeAttribute('title');
    return;
  }

  const currentBaseCode = rawText.split('(')[0].trim();
  const row = cell.parentElement;
  const editableInRow = Array.from(row.querySelectorAll('[contenteditable="true"]'));
  if (editableInRow.length === 0) return;
  
  const teacherMap = getTeacherMap();
  const frequencyMap = new Map();

  // Passo 1: Limpar estados e mapear dados em O(n)
  const rowData = editableInRow.map(c => {
    c.classList.remove('conflict-error');
    c.removeAttribute('title');
    const txt = c.innerText.trim().toUpperCase();
    const base = txt.split('(')[0].trim();
    const teacher = teacherMap[txt] || teacherMap[base] || null;
    const isSpecialist = SPECIALIST_SIGLAS.includes(txt) || txt === '*' || !txt;

    if (!isSpecialist) {
      const key = teacher || txt;
      frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
    }

    return {
      element: c,
      text: txt,
      teacher,
      isSpecialist
    };
  });

  // Passo 2: Marcar conflitos em O(n)
  rowData.forEach(item => {
    if (item.isSpecialist) return;
    const key = item.teacher || item.text;
    if (frequencyMap.get(key) > 1) {
      item.element.classList.add('conflict-error');
      item.element.title = item.teacher 
        ? `Conflito: Professor ${item.teacher} em múltiplas salas.` 
        : `Conflito: Turma ${item.text} em múltiplas salas.`;
    }
  });
}

// Aplica cores baseadas no texto (HL, PD, etc)
function applyDynamicStyles(cell) {
  const text = cell.innerText.trim().toUpperCase();
  const baseCode = text.split('(')[0].trim(); // Extrai "3B" de "3B(N)"
  const teacherMap = getTeacherMap();
  const teacherName = teacherMap[text] || teacherMap[baseCode];

  // Remove classes de legenda antigas
  cell.classList.remove('hl', 'pd', 'el', 'mtf');
  cell.removeAttribute('data-teacher'); // Limpa o nome do professor exibido dentro da célula
  cell.removeAttribute('title'); // Limpa o tooltip anterior
  
  if (text === 'HL' || text === 'HTPC') cell.classList.add('hl');
  else if (text === 'PD') cell.classList.add('pd');
  else if (text === 'EL') cell.classList.add('el');
  else if (text === 'MTF') cell.classList.add('mtf');

  // Define o atributo 'title' para mostrar o nome completo do professor no hover
  if (teacherName) {
    cell.title = teacherName;
  }

  // Se o texto estiver no mapa de professores, exibe o nome abaixo do código
  if (teacherName && text !== '*' && text !== '') {
    // Extrai apenas o primeiro nome para não ocupar muito espaço na célula
    const fullName = teacherName.split(' (')[0];
    cell.setAttribute('data-teacher', fullName);
  }
}

// Carregar dados (Estado Centralizado)
function loadData() {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  cells.forEach((cell) => {
    const key = getCellKey(cell);
    if (data[key] !== undefined) {
      cell.innerText = data[key];
      applyDynamicStyles(cell);
      checkConflicts(cell); // Valida conflitos já no carregamento
    }
  });

  // Aplica as divisórias de dia iniciais
  applyStaticDayDividers();

  // Adiciona atributos de acessibilidade e labels
  cells.forEach(cell => {
    cell.setAttribute('role', 'textbox');
    cell.tabIndex = 0; // Permite que a célula receba foco mesmo se não for editável
    cell.setAttribute('aria-multiline', 'false');
    const timeHeader = cell.closest('tr').querySelector('td:first-child')?.innerText || 'Horário desconhecido';
    const colInfo = getDayAndColIndices(cell);
    cell.setAttribute('aria-label', `Aula de ${colInfo.specialist} às ${timeHeader}`);
  });
  
  updateAriaStatus();
}

// Função para forçar a revalidação de todos os conflitos (útil após carga de dados)
function validateAllConflicts() {
    cells.forEach(cell => {
        if (cell.innerText.trim()) checkConflicts(cell);
    });
}

const updateAriaStatus = () => {
  const isReadonly = document.body.classList.contains('readonly');
  cells.forEach(c => c.setAttribute('aria-readonly', isReadonly));
};

// Gerenciamento Centralizado de Eventos (Event Delegation)
document.addEventListener('input', (e) => {
  if (e.target.getAttribute('contenteditable') === 'true') {
    const key = getCellKey(e.target);
    applyDynamicStyles(e.target);
    checkConflicts(e.target);
    saveContent(key, e.target.innerText);
    
    // Atualiza a barra de status em tempo real enquanto digita
    updateStatusBar(e.target);
  }
});

// Helper function for time conversion - Centralizada no topo
const timeToMinutes = (str) => {
  const match = str.toLowerCase().match(/(\d+)h(\d+)?/);
  return match ? parseInt(match[1]) * 60 + parseInt(match[2] || 0) : null;
};

// Helper para identificar Dia e Especialista de forma centralizada
function getDayAndColIndices(cell) {
  const table = cell.closest('table');
  const colIndex = cell.cellIndex;
  const layout = table.closest('#section-morning') ? LAYOUTS.morning : LAYOUTS.afternoon;
  
  let dayIdx = 0;
  let colSum = 0;
  for(let i = 0; i < layout.length; i++) {
    colSum += layout[i];
    if (colIndex <= colSum) {
      dayIdx = i + 1;
      break;
    }
  }
  const specialist = table.rows[1].cells[colIndex - 1]?.innerText || '';
  return { dayIdx, specialist, table };
}

// Helper to get day index for a given column index (1-based for specialist columns)
function getDayIndexForColumn(colIndex, layout) {
  let currentSpecialistColCount = 0;
  for (let i = 0; i < layout.length; i++) {
    currentSpecialistColCount += layout[i];
    if (colIndex <= currentSpecialistColCount) {
      return i + 1; // 1 for Monday, 2 for Tuesday, etc.
    }
  }
  return 0; // Should not happen for specialist columns
}

// Função para filtrar as colunas por dia da semana
function filterByDay(selectedDayIndex) {
  // Salva a preferência do usuário para persistência
  localStorage.setItem(FILTER_DAY_KEY, selectedDayIndex);
  const selectedDay = parseInt(selectedDayIndex);

  document.querySelectorAll('table').forEach(table => {
    const layout = table.closest('#section-morning') ? LAYOUTS.morning : LAYOUTS.afternoon;
    const rows = table.rows;

    // 1. Ocultar/Mostrar os cabeçalhos dos dias (Linha 0)
    // cells[0] é "Horário", cells[1..5] são os dias
    for (let i = 1; i <= 5; i++) {
      const headerCell = rows[0].cells[i];
      if (headerCell) {
        const shouldHide = (selectedDay !== 0 && selectedDay !== i);
        headerCell.classList.toggle('hidden-col', shouldHide);
      }
    }

    // 2. Ocultar/Mostrar colunas de especialistas (Linha 1) e dados (Linhas 2+)
    let colOffset = 0;
    layout.forEach((colsInDay, dayIdx) => {
      const currentDayNum = dayIdx + 1;
      const shouldHide = (selectedDay !== 0 && selectedDay !== currentDayNum);

      // Especialistas (Linha 1) - Não tem coluna de horário nesta linha devido ao rowspan
      for (let c = 0; c < colsInDay; c++) {
        const cell = rows[1].cells[colOffset + c];
        if (cell) cell.classList.toggle('hidden-col', shouldHide);
      }

      // Dados (Linhas 2+) - cells[0] é o Horário, então os dados começam em index 1
      for (let r = 2; r < rows.length; r++) {
        if (rows[r].classList.contains('recreio')) continue;
        for (let c = 0; c < colsInDay; c++) {
          const cell = rows[r].cells[colOffset + c + 1];
          if (cell) cell.classList.toggle('hidden-col', shouldHide);
        }
      }
      colOffset += colsInDay;
    });
  });
  // Re-apply highlights after filtering
  updateHighlights();
}

function clearSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput.value = '';
  highlightOccurrences(''); // Limpa todos os destaques
}

function highlightOccurrences(text) {
  // Se o texto for uma sigla de professor mapeada, também destaca
  const cleanText = text.trim().toUpperCase();
  
  cells.forEach(c => {
    const cellText = c.innerText.trim().toUpperCase();
    const cellBaseCode = cellText.split('(')[0].trim();
    
    if (cleanText && (cellText.includes(cleanText) || cellBaseCode === cleanText) && !['*', ''].includes(cleanText)) {
      c.classList.add('match-highlight');
    } else {
      c.classList.remove('match-highlight');
    }
  });
}

// Consolidação dos ouvintes de Focus (Barra de Status + Destaque de Coluna)
document.addEventListener('focusin', (e) => {
  const cell = e.target;
  const isEditable = cell.getAttribute('contenteditable') === 'true';
  const isReadonlyMode = document.body.classList.contains('readonly');

  if (isEditable || isReadonlyMode) {
    updateStatusBar(cell);
    highlightOccurrences(cell.innerText);

    const colIndex = cell.cellIndex;
    const table = cell.closest('table');
    
    // Limpa destaques de coluna anteriores
    document.querySelectorAll('.col-highlight').forEach(el => el.classList.remove('col-highlight'));
    
    // Destaca a coluna inteira (Crosshair effect)
    if (colIndex > 0 && table) {
      const { dayIdx } = getDayAndColIndices(cell);

      // Destaca o Dia (Linha 0)
      if (table.rows[0].cells[dayIdx]) table.rows[0].cells[dayIdx].classList.add('col-highlight');
      
      // Destaca o Especialista (Linha 1)
      if (table.rows[1].cells[colIndex - 1]) table.rows[1].cells[colIndex - 1].classList.add('col-highlight');

      // Destaca as células de dados (Linhas 2+)
      for (let i = 2; i < table.rows.length; i++) {
        const r = table.rows[i];
        if (r.cells[colIndex]) r.cells[colIndex].classList.add('col-highlight');
      }
    }
  }
});

// Navegação por teclado (Setas e Enter para a linha de baixo/cima)
document.addEventListener('keydown', (e) => {
  const cell = e.target;
  if (cell.getAttribute('contenteditable') !== 'true') return;

  const row = cell.parentElement;
  const table = cell.closest('table');
  const colIndex = cell.cellIndex;
  const rowIndex = row.rowIndex;
  let nextCell;

  if (e.key === 'Enter' || e.key === 'ArrowDown') {
    e.preventDefault();
    for (let i = rowIndex + 1; i < table.rows.length; i++) {
      const target = table.rows[i].cells[colIndex];
      if (target && target.getAttribute('contenteditable') === 'true') {
        nextCell = target;
        break;
      }
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    for (let i = rowIndex - 1; i >= 2; i--) {
      const target = table.rows[i].cells[colIndex];
      if (target && target.getAttribute('contenteditable') === 'true') {
        nextCell = target;
        break;
      }
    }
  }

  if (nextCell) {
    nextCell.focus();
    // Move o cursor para o final do texto na nova célula
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(nextCell);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
});

// Função isolada para atualizar a barra de status
function updateStatusBar(cell) {
    const text = cell.innerText.trim().toUpperCase();
    const baseCode = text.split('(')[0].trim();
    const teacherMap = getTeacherMap();
    const teacherName = teacherMap[text] || teacherMap[baseCode];

    const colIndex = cell.cellIndex;
    const table = cell.closest('table');
    const row = cell.parentElement;

    // Destaca a linha
    document.querySelectorAll('tr').forEach(r => r.classList.remove('row-highlight'));
    row.classList.add('row-highlight');

    // Limpa destaques de cabeçalho anteriores
    document.querySelectorAll('th').forEach(th => th.classList.remove('header-highlight'));

    // Encontra o cabeçalho correto
    // Usa o índice da célula para encontrar o especialista correspondente na linha 1
    const professorHeader = table.rows[1].cells[colIndex - 1];
    if (professorHeader) {
      const sigla = professorHeader.innerText.trim().toUpperCase();
      const nomeProf = teacherMap[sigla] || `Especialista: ${sigla}`;
      
      // Tenta encontrar o nome da regente pelo conteúdo da célula
      const nomeRegente = teacherName && !SPECIALIST_SIGLAS.includes(text) && !SPECIALIST_SIGLAS.includes(baseCode) 
        ? ` | <b>Regente:</b> ${teacherName}` 
        : '';
      
      document.getElementById('statusBar').innerHTML = `
        <div class="status-item"><b>Especialista:</b> ${nomeProf}</div>
        <div class="status-item"><b>Sala/Turma:</b> ${cell.innerText || '(vazia)'}${nomeRegente}</div>
      `;

      professorHeader.classList.add('header-highlight');
    }
    
    // Sugestão de UX: Mostrar carga horária da turma selecionada
    const count = Array.from(cells).filter(c => c.innerText.trim().toUpperCase() === text).length;
    if (text && text !== '*') {
        document.getElementById('statusBar').innerHTML += `<div class="status-item"><b>Aulas na Semana:</b> ${count}</div>`;
    }
}

function applyTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const btn = document.getElementById('theme-toggle');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    if (btn) btn.innerHTML = '☀️ Tema Claro';
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  const btn = document.getElementById('theme-toggle');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  if (btn) btn.innerHTML = isDark ? '☀️ Tema Claro' : '🌙 Tema Escuro';
}

// Alterna entre modo de edição e modo de leitura
function toggleLockMode() {
  const body = document.body;
  const isReadonlyCurrently = body.classList.contains('readonly');
  const btn = document.getElementById('lock-btn');

  // Se está bloqueado e quer entrar no modo de edição, pede a senha
  // NOTA: Isso é apenas um controle de interface, não segurança real.
  if (isReadonlyCurrently) {
    const senha = prompt("Digite a senha para entrar no modo de edição:");
    if (senha !== 'qwe123') { // TODO: Mover validação para backend se necessário
      alert("Senha incorreta!");
      return;
    }
  }
  
  const isReadonly = body.classList.toggle('readonly');
  cells.forEach(cell => {
    cell.contentEditable = !isReadonly;
  });
  
  updateAriaStatus();

  if (isReadonly) {
    btn.innerHTML = '🔒 Modo Leitura';
    btn.style.background = '#64748b';
    // Limpa destaques ao travar
    document.querySelectorAll('.row-highlight, .col-highlight, .header-highlight').forEach(el => {
      el.classList.remove('row-highlight', 'col-highlight', 'header-highlight');
    });
    const searchInput = document.getElementById('search-input');
    searchInput.value = ''; // Limpa o campo de busca
    highlightOccurrences(''); // Remove destaques da busca
  } else {
    btn.innerHTML = '🔓 Modo Edição';
    btn.style.background = 'var(--primary)';
  }
}

function exportToCsv() {
  let csv = "Periodo;Horario;Especialista;Turma;Professor Regente\n";
  cells.forEach(cell => {
    const table = cell.closest('table');
    const sectionEl = cell.closest('[id^="section-"]');
    const section = sectionEl ? (sectionEl.querySelector('h2')?.innerText || "Geral") : "Geral";
    const time = table.rows[cell.parentElement.rowIndex].cells[0].innerText;
    const specialist = table.rows[1].cells[cell.cellIndex - 1]?.innerText || "";
    const value = cell.innerText.trim();
    const teacher = cell.getAttribute('data-teacher') || "";
    
    if (value && value !== '*') {
      csv += `${section};${time};${specialist};${value};${teacher}\n`;
    }
  });

  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `horario_escolar_${new Date().toLocaleDateString()}.csv`);
  link.click();
}

// Exporta todo o banco de dados (localStorage) para um arquivo JSON
function exportBackupJSON() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return alert("Não há dados para exportar.");
  
  const blob = new Blob([data], { type: 'application/json' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `backup_horario_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
}

// Importa dados de um arquivo JSON para o localStorage
function importBackupJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = readerEvent => {
      try {
        const content = readerEvent.target.result;
        // Validação básica de estrutura JSON
        JSON.parse(content); 
        
        if (confirm("Isso irá sobrescrever todos os dados atuais. Deseja continuar?")) {
          localStorage.setItem(STORAGE_KEY, content);
          window.location.reload(); // Recarrega para aplicar os novos dados
        }
      } catch (err) {
        alert("Erro: Arquivo JSON inválido.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Função para destacar dia e horário atual
function updateHighlights() {
  const now = new Date();
  const day = now.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab

  // Remove destaques antigos
  document.querySelectorAll('.current-active').forEach(el => el.classList.remove('current-active'));

  if (day < 1 || day > 5) return; // Não destaca nada nos fins de semana

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  document.querySelectorAll('table').forEach((table) => {
    const currentLayout = table.closest('#section-morning') ? LAYOUTS.morning : LAYOUTS.afternoon;

    // Destaca o cabeçalho do dia atual (Segunda é índice 1)
    if (table.rows[0].cells[day]) table.rows[0].cells[day].classList.add('current-active');

    for (let i = 2; i < table.rows.length; i++) {
      const row = table.rows[i];
      const timeText = row.cells[0].innerText;
      const parts = timeText.split(' - ');
      let start = null,
        end = null;

      if (row.classList.contains('recreio') && parts.length >= 3) {
        start = timeToMinutes(parts[1]);
        end = timeToMinutes(parts[2]);
      } else if (parts.length === 2) {
        start = timeToMinutes(parts[0]);
        end = timeToMinutes(parts[1]);
      }

      if (start !== null && currentMinutes >= start && currentMinutes < end) {
        row.cells[0].classList.add('current-active'); // Destaca a célula do horário

        // Calcula o índice de início da célula baseado no layout variável
        let cellStart = 1;
        for (let d = 0; d < day - 1; d++) {
          cellStart += currentLayout[d];
        }

        const colsPerDay = currentLayout[day - 1];
        for (let j = 0; j < colsPerDay; j++) {
          if (row.cells[cellStart + j]) row.cells[cellStart + j].classList.add('current-active');
        }
      }
    }
  });
}

// Aplica as divisórias visuais (linhas duplas) entre os dias da semana
function applyStaticDayDividers() {
  document.querySelectorAll('table').forEach(table => {
    const specialistRow = table.rows[1];
    if (!specialistRow) return;

    const layout = table.closest('#section-morning') ? LAYOUTS.morning : LAYOUTS.afternoon;
    let colOffset = 0;

    layout.forEach((colsInDay, dayIdx) => {
      const dayNum = dayIdx + 1;
      
      // Aplica no cabeçalho do dia (Linha 0)
      const headerCell = table.rows[0].cells[dayNum];
      if (headerCell) {
        headerCell.classList.add(`day-header-${dayNum}`);
        if (dayIdx < layout.length - 1) headerCell.classList.add('day-divider');
      }

      // Aplica as classes de fundo e divisórias nas colunas deste dia
      for (let r = 1; r < table.rows.length; r++) {
        for (let c = 0; c < colsInDay; c++) {
          const targetCol = colOffset + c + 1; // +1 pela coluna de horário
          const cell = table.rows[r].cells[targetCol];
          if (cell) {
            cell.classList.add(`day-cell-${dayNum}`);
            
            // Se for a última coluna do dia, adiciona a divisória (exceto na última coluna da tabela)
            if (c === colsInDay - 1 && dayIdx < layout.length - 1) {
              cell.classList.add('day-divider');
            }
          }
        }
      }
      colOffset += colsInDay;
    });
  });
}

// Função para selecionar colunas/células através da legenda
function toggleCategory(category) {
  const clickedBox = document.querySelector(`.legend-item .box.${category}`);
  if (!clickedBox) return;
  const isActive = clickedBox.parentElement.classList.toggle('active');

  document.querySelectorAll('table').forEach(table => {
    const specialistRow = table.rows[1];
    if (!specialistRow) return;

    for (let i = 0; i < specialistRow.cells.length; i++) {
      const th = specialistRow.cells[i];
      // Verifica se o cabeçalho ou a célula de legenda tem a classe correspondente
      const isMatch = th.classList.contains(category) || 
                      th.innerText.trim().toUpperCase() === category.toUpperCase();

      if (isMatch) {
        th.classList.toggle('category-select', isActive);
        for (let r = 2; r < table.rows.length; r++) {
          const cell = table.rows[r].cells[i + 1]; // +1 devido à coluna Horário
          if (cell) cell.classList.toggle('category-select', isActive);
        }
      }
    }
  });

  // Caso especial HL: destaca células que contenham o texto HL/HTPC
  if (category === 'hl') {
    cells.forEach(cell => {
      const txt = cell.innerText.trim().toUpperCase();
      if (txt === 'HL' || txt === 'HTPC') {
        cell.classList.toggle('category-select', isActive);
      }
    });
  }
}

// Função para formatar a diferença de tempo em MMm SSs
function formatTimeDifference(totalSeconds) {
  if (totalSeconds < 0) return "00m 00s";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
}

// Função para atualizar o contador de tempo (início/término de aula)
function updateTimeCounter() {
  const now = new Date();
  const day = now.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  const currentTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const timeCounterElement = document.getElementById('time-counter');
  const progressBar = document.getElementById('main-progress-bar');

  if (day < 1 || day > 5) { // Fim de semana
    timeCounterElement.innerText = "Fim de semana";
    return;
  }

  let activePeriod = null;
  let nextPeriod = null;
  let minSecondsToNext = Infinity;

  document.querySelectorAll('table').forEach((table) => {
    const currentLayout = table.closest('#section-morning') ? LAYOUTS.morning : LAYOUTS.afternoon;

    for (let i = 2; i < table.rows.length; i++) {
      const row = table.rows[i];
      const timeText = row.cells[0].innerText;
      const parts = timeText.split(' - ');
      let startMinutes = null, endMinutes = null;

      if (row.classList.contains('recreio') && parts.length >= 3) {
        startMinutes = timeToMinutes(parts[1]);
        endMinutes = timeToMinutes(parts[2]);
      } else if (parts.length === 2) {
        startMinutes = timeToMinutes(parts[0]);
        endMinutes = timeToMinutes(parts[1]);
      }

      if (startMinutes !== null && endMinutes !== null) {
        const startTotalSeconds = startMinutes * 60;
        const endTotalSeconds = endMinutes * 60;

        if (currentTotalSeconds >= startTotalSeconds && currentTotalSeconds < endTotalSeconds) {
          activePeriod = { start: startTotalSeconds, end: endTotalSeconds, type: row.classList.contains('recreio') ? 'recreio' : 'aula' };
        } else if (startTotalSeconds > currentTotalSeconds && (startTotalSeconds - currentTotalSeconds) < minSecondsToNext) {
          minSecondsToNext = startTotalSeconds - currentTotalSeconds;
          nextPeriod = { start: startTotalSeconds, end: endTotalSeconds, type: row.classList.contains('recreio') ? 'recreio' : 'aula' };
        }
      }
    }
  });

  let message = "";
  if (activePeriod) {
    const remainingSeconds = activePeriod.end - currentTotalSeconds;
    const elapsed = currentTotalSeconds - activePeriod.start;
    const duration = activePeriod.end - activePeriod.start;
    const percentage = (elapsed / duration) * 100;
    
    if (progressBar) progressBar.style.width = `${percentage}%`;

    message = `Termina em ${formatTimeDifference(remainingSeconds)}`;
    if (activePeriod.type === 'recreio') { message = `Recreio termina em ${formatTimeDifference(remainingSeconds)}`; }
  } else if (nextPeriod) {
    if (progressBar) progressBar.style.width = '0%';
    const timeUntilNext = nextPeriod.start - currentTotalSeconds;
    message = `Próxima aula em ${formatTimeDifference(timeUntilNext)}`;
    if (nextPeriod.type === 'recreio') { message = `Próximo recreio em ${formatTimeDifference(timeUntilNext)}`; }
  } else {
    message = "Fora do horário de aula";
  }

  timeCounterElement.innerText = message;
}

function updateClock() {
  const clockElement = document.getElementById('current-date-time');
  if (!clockElement) return;
  const now = new Date();
  clockElement.textContent = now.toLocaleString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replace(/^\w/, (c) => c.toUpperCase());
}

// Função para reordenar as seções baseado no horário (Manhã vs Tarde)
function reorderSectionsByTime() {
  const now = new Date();
  const hour = now.getHours();
  const wrapper = document.getElementById('schedule-wrapper');
  const morning = document.getElementById('section-morning');
  const afternoon = document.getElementById('section-afternoon');

  if (hour >= 12) {
    // Após meio-dia, mostra a tarde primeiro
    wrapper.insertBefore(afternoon, morning);
  }
}

// Inicializa e define intervalo de atualização
loadData(); // Carrega os dados salvos
applyTheme(); // Aplica o tema salvo
reorderSectionsByTime(); // Organiza a ordem das tabelas por relevância
updateHighlights(); // Destaca o horário atual
updateTimeCounter(); // Inicia o contador de tempo
updateClock(); // Inicia o relógio
cells.forEach(cell => cell.contentEditable = false); // Garante estado inicial bloqueado

setInterval(updateHighlights, 10000); // Atualiza a cada 10 segundos para maior precisão

// Event listener para o select de filtro de dia
document.addEventListener('DOMContentLoaded', () => {
  const dayFilterSelect = document.getElementById('day-filter-select');
  
  // Recupera o filtro salvo ou padrão (0 - Todos)
  const savedDay = localStorage.getItem(FILTER_DAY_KEY) || "0";
  
  if (dayFilterSelect) {
    dayFilterSelect.value = savedDay;
    dayFilterSelect.addEventListener('change', (e) => {
      filterByDay(parseInt(e.target.value));
    });
  }

  // Aplica o filtro inicial após um pequeno delay para garantir que o DOM e os layouts estejam prontos
  setTimeout(() => filterByDay(parseInt(savedDay)), 50);
});

// --- SISTEMA DE GERENCIAMENTO DE PROFESSORES ---

function openTeacherManager() {
  const map = getTeacherMap();
  
  // Criação de elementos de forma segura (Prevenção de XSS)
  const overlay = Object.assign(document.createElement('div'), {
    className: 'modal-overlay',
    id: 'teacher-modal'
  });
  overlay.style.display = 'flex';

  const modal = document.createElement('div');
  modal.className = 'modal';
  
  const title = document.createElement('h2');
  title.textContent = 'Gerenciar Professores';
  
  const listContainer = Object.assign(document.createElement('div'), {
    className: 'teacher-list-container',
    id: 'modal-teacher-list'
  });

  // Helper para criar botões rapidamente
  const createBtn = (text, cls, fn) => {
    const btn = Object.assign(document.createElement('button'), {
      className: `btn ${cls}`,
      textContent: text
    });
    btn.onclick = fn;
    return btn;
  };

  // Estrutura do formulário
  const form = document.createElement('div');
  form.className = 'modal-form';
  const inputSigla = Object.assign(document.createElement('input'), { id: 'new-sigla', placeholder: 'Sigla', className: 'search-field' });
  const inputNome = Object.assign(document.createElement('input'), { id: 'new-nome', placeholder: 'Nome Completo', className: 'search-field' });
  form.append(inputSigla, inputNome, createBtn('Add', 'btn-primary', addTeacherToRegistry));

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.append(
    createBtn('Fechar', '', () => overlay.remove()),
    createBtn('Salvar e Reiniciar', 'btn-success', saveTeacherRegistryAndReload)
  );

  modal.append(title, listContainer, form, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  renderTeacherList(map);
}

function renderTeacherList(map) {
  const container = document.getElementById('modal-teacher-list');
  container.innerHTML = '';
  Object.keys(map).sort().forEach(sigla => {
    const item = document.createElement('div');
    item.className = 'teacher-item';
    
    const info = document.createElement('div');
    info.className = 'teacher-info';
    
    const sSpan = document.createElement('span');
    sSpan.className = 'teacher-sigla';
    sSpan.textContent = sigla;
    
    const nSpan = document.createElement('span');
    nSpan.className = 'teacher-nome';
    nSpan.textContent = map[sigla];
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn';
    delBtn.style.cssText = 'color: #ef4444; padding: 4px 8px;';
    delBtn.textContent = '🗑️';
    delBtn.onclick = () => removeTeacherFromRegistry(sigla);

    info.append(sSpan, nSpan);
    item.append(info, delBtn);
    container.appendChild(item);
  });
}

function addTeacherToRegistry() {
  const sigla = document.getElementById('new-sigla').value.trim().toUpperCase();
  const nome = document.getElementById('new-nome').value.trim();
  if (!sigla || !nome) return alert("Preencha sigla e nome.");
  
  const map = getTeacherMap();
  map[sigla] = nome;
  localStorage.setItem(TEACHER_REGISTRY_KEY, JSON.stringify(map));
  renderTeacherList(map);
  document.getElementById('new-sigla').value = '';
  document.getElementById('new-nome').value = '';
}

function removeTeacherFromRegistry(sigla) {
  const map = getTeacherMap();
  delete map[sigla];
  localStorage.setItem(TEACHER_REGISTRY_KEY, JSON.stringify(map));
  renderTeacherList(map);
}

function saveTeacherRegistryAndReload() {
  if (confirm("O sistema será reiniciado para aplicar as mudanças nos nomes dos professores. Continuar?")) {
    window.location.reload();
  }
}

setInterval(() => {
  updateTimeCounter();
  updateClock();
}, 1000); // Atualiza o contador de tempo e o relógio a cada 1 segundo