/**
 * Horário Escolar Editável
 * Melhorias: Config centralizado, schema migration, sanitização de paste,
 * undo/redo, focus trap em modais, cache de DOM, acessibilidade.
 */

const CONFIG = {
  SCHEMA_VERSION: 2,
  STORAGE_KEY: 'school_schedule_v2',
  THEME_KEY: 'school_schedule_theme',
  TEACHER_REGISTRY_KEY: 'school_teachers_v1',
  FILTER_DAY_KEY: 'school_filter_day_v1',
  ZOOM_LEVEL_KEY: 'school_zoom_level_v1',
  LOCK_PASSWORD: 'qwe123',
  LAYOUTS: {
    morning: [6, 5, 4, 4, 5],
    afternoon: [5, 4, 4, 5, 4]
  },
  SPECIALIST_SIGLAS: ['A(S)', 'A(M)', 'EF(M)', 'EF(P)', 'CT(D)', 'EDM(L)', 'EDM', 'EL', 'MTF', 'PI', 'PII'],
  DATA_CATEGORIES: ['HL', 'HTPC', 'PD', 'EL', 'MTF']
};

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
  'PI': 'Projeto I',
  'PII': 'Projeto II',
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

// --- DOM Cache & Management ---
const _dom = (() => {
  const cache = {};
  let _cells = null;
  const get = (id) => cache[id] || (cache[id] = document.getElementById(id));
  
  return {
    /**
     * Retorna um NodeList cacheado das células editáveis.
     * @returns {NodeList}
     */
    cells: () => {
      if (!_cells) _cells = document.querySelectorAll('[contenteditable="true"]');
      return _cells;
    },
    invalidateCache: () => { _cells = null; },
    tables: () => document.querySelectorAll('table'),
    
    // Elementos estáticos cacheados por ID
    statusBar: () => get('statusBar'),
    saveIndicator: () => get('save-indicator'),
    timeCounter: () => get('time-counter'),
    progressBar: () => get('main-progress-bar'),
    clock: () => get('current-date-time'),
    themeBtn: () => get('theme-toggle'),
    lockBtn: () => get('lock-btn'),
    searchInput: () => get('search-input'),
    dayFilter: () => get('day-filter-select')
  };
})();

let _teacherMapCache = null;
let _clipboardText = null;

// --- SCHEMA MIGRATION ---
function runMigrations() {
  const storageKeyVersion = 'school_schema_version';
  const currentVersion = parseInt(localStorage.getItem(storageKeyVersion) || '0');
  
  if (currentVersion < CONFIG.SCHEMA_VERSION) {
    console.info(`Migrando schema de v${currentVersion} para v${CONFIG.SCHEMA_VERSION}...`);
    
    // Migração da v1 para v2 (Mudança de chave de storage)
    const oldData = localStorage.getItem('school_schedule_v1');
    if (oldData) {
      const data = JSON.parse(oldData);
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
      localStorage.removeItem('school_schedule_v1');
    }
    localStorage.setItem(storageKeyVersion, CONFIG.SCHEMA_VERSION.toString());
  }
}

/**
 * Inicializa o processo de migração de dados se necessário.
 */
function initializeData() {
  runMigrations();
}
initializeData();

// --- CORE FUNCTIONS ---

/**
 * Retorna o mapa de professores do localStorage ou o padrão.
 * @returns {Object} Mapa de siglas para nomes de professores.
 */
function getTeacherMap() {
  if (_teacherMapCache) return _teacherMapCache;
  try {
    const stored = localStorage.getItem(CONFIG.TEACHER_REGISTRY_KEY);
    _teacherMapCache = stored ? JSON.parse(stored) : DEFAULT_TEACHER_MAP;
  } catch (e) {
    _teacherMapCache = DEFAULT_TEACHER_MAP;
  }
  return _teacherMapCache;
}

/**
 * Cria uma versão debounced de uma função.
 * @param {Function} func - Função a ser debounced.
 * @param {number} timeout - Tempo em ms.
 * @returns {Function}
 */
function debounce(func, timeout = 500) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

/**
 * Gera uma chave única para uma célula baseada em sua posição.
 * @param {HTMLElement} cell - Célula da tabela.
 * @returns {string} Chave formatada.
 */
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

/**
 * Salva o conteúdo de uma célula no localStorage com debounce.
 * @param {string} key - Chave identificadora da célula.
 * @param {string} text - Texto a ser salvo.
 */
const saveContent = debounce((key, text) => {
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '{}');
    data[key] = text;
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    const indicator = _dom.saveIndicator();
    if (indicator) {
      indicator.style.opacity = '1';
      setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
    }
  } catch (e) {
    console.error("Erro ao salvar no localStorage:", e);
    alert("Erro crítico: Não foi possível salvar as alterações.");
  }
});

/**
 * Aplica estilos dinâmicos à célula com base em seu conteúdo.
 * @param {HTMLElement} cell - Célula a ser estilizada.
 */
function applyDynamicStyles(cell) {
  const text = cell.innerText.trim().toUpperCase();
  const baseCode = text.split('(')[0].trim();
  const teacherMap = getTeacherMap();
  const teacherName = teacherMap[text] || teacherMap[baseCode];

  cell.classList.remove('hl', 'pd', 'el', 'mtf');
  cell.removeAttribute('data-teacher');
  cell.removeAttribute('title');

  if (text === 'HL' || text === 'HTPC') cell.classList.add('hl');
  else if (text === 'PD') cell.classList.add('pd');
  else if (text === 'EL') cell.classList.add('el');
  else if (text === 'MTF') cell.classList.add('mtf');

  if (teacherName) cell.title = teacherName;
  if (teacherName && text !== '*' && text !== '') {
    cell.setAttribute('data-teacher', teacherName.split(' (')[0]);
  }
}

/**
 * Verifica conflitos de horário em uma linha (turma/professor em múltiplas salas).
 * @param {HTMLElement} cell - Célula que foi modificada.
 */
function checkConflicts(cell) {
  const rawText = cell.innerText.trim().toUpperCase();
  if (!rawText || rawText === '*' || CONFIG.SPECIALIST_SIGLAS.includes(rawText)) {
    cell.classList.remove('conflict-error');
    cell.removeAttribute('title');
    return;
  }

  const row = cell.parentElement;
  const editableInRow = Array.from(row.querySelectorAll('[contenteditable="true"]'));
  if (editableInRow.length === 0) return;

  const teacherMap = getTeacherMap();
  const frequencyMap = new Map();

  const rowData = editableInRow.map(c => {
    c.classList.remove('conflict-error');
    c.removeAttribute('title');
    const txt = c.innerText.trim().toUpperCase();
    const base = txt.split('(')[0].trim();
    const teacher = teacherMap[txt] || teacherMap[base] || null;
    const isSpecialist = CONFIG.SPECIALIST_SIGLAS.includes(txt) || txt === '*' || !txt;
    if (!isSpecialist) {
      const key = teacher || txt;
      frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
    }
    return { element: c, text: txt, teacher, isSpecialist };
  });

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

/**
 * Carrega dados salvos do localStorage e aplica às células.
 */
function loadData() {
  const data = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '{}');
  _dom.invalidateCache();
  _dom.cells().forEach(cell => {
    const key = getCellKey(cell);
    if (data[key] !== undefined) {
      cell.innerText = data[key];
      applyDynamicStyles(cell);
      checkConflicts(cell);
    }
  });
  applyStaticDayDividers();
  _dom.cells().forEach(cell => {
    cell.setAttribute('role', 'textbox');
    cell.tabIndex = 0;
    cell.setAttribute('aria-multiline', 'false');
    const timeHeader = cell.closest('tr').querySelector('td:first-child')?.innerText || 'Horário desconhecido';
    const colInfo = getDayAndColIndices(cell);
    cell.setAttribute('aria-label', `Aula de ${colInfo.specialist} às ${timeHeader}`);
  });
  updateAriaStatus();
}

/**
 * Varre todas as células editáveis para validar conflitos globais.
 */
function validateAllConflicts() {
  _dom.cells().forEach(cell => {
    if (cell.innerText.trim()) checkConflicts(cell);
  });
}

/**
 * Atualiza os atributos de acessibilidade e o estado de edição das células
 * baseado no modo (Leitura/Edição) atual.
 */
function updateAriaStatus() {
  const isReadonly = document.body.classList.contains('readonly');
  _dom.cells().forEach(c => {
    c.setAttribute('aria-readonly', isReadonly);
    c.contentEditable = !isReadonly;
  });
}

// --- UNDO / REDO ---
const _undoStack = [];
const _redoStack = [];
const MAX_HISTORY = 50;

/**
 * Adiciona um estado à pilha de Desfazer.
 * @param {HTMLElement} cell - Célula alterada.
 * @param {string} oldText - Texto anterior à alteração.
 */
function pushUndo(cell, oldText) {
  _undoStack.push({ cell, oldText });
  if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
  _redoStack.length = 0;
}

/**
 * Reverte a última ação do usuário.
 */
function undo() {
  if (_undoStack.length === 0) return;
  const action = _undoStack.pop();
  const currentText = action.cell.innerText;
  action.cell.innerText = action.oldText;
  _redoStack.push({ cell: action.cell, oldText: currentText });
  applyDynamicStyles(action.cell);
  checkConflicts(action.cell);
  saveContent(getCellKey(action.cell), action.oldText);
  updateStatusBar(action.cell);
}

/**
 * Refaz a última ação revertida.
 */
function redo() {
  if (_redoStack.length === 0) return;
  const action = _redoStack.pop();
  const currentText = action.cell.innerText;
  action.cell.innerText = action.oldText;
  _undoStack.push({ cell: action.cell, oldText: currentText });
  applyDynamicStyles(action.cell);
  checkConflicts(action.cell);
  saveContent(getCellKey(action.cell), action.oldText);
  updateStatusBar(action.cell);
}

// --- EVENT LISTENERS ---
document.addEventListener('paste', (e) => {
  if (e.target.getAttribute('contenteditable') === 'true') {
    e.preventDefault();
    // Sanitiza: remove HTML, remove quebras de linha e espaços extras
    const text = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/[\r\n\t]+/g, ' ').trim();
    document.execCommand('insertText', false, text);
  }
});

document.addEventListener('input', (e) => {
  if (e.target.getAttribute('contenteditable') === 'true') {
    const key = getCellKey(e.target);
    applyDynamicStyles(e.target);
    checkConflicts(e.target);
    saveContent(key, e.target.innerText);
    updateStatusBar(e.target);
  }
});

document.addEventListener('focusin', (e) => {
  if (e.target.getAttribute('contenteditable') === 'true') {
    e.target._oldValue = e.target.innerText;
  }
});

document.addEventListener('focusout', (e) => {
  if (e.target.getAttribute('contenteditable') === 'true' && e.target._oldValue !== undefined) {
    if (e.target._oldValue !== e.target.innerText) {
      pushUndo(e.target, e.target._oldValue);
    }
    delete e.target._oldValue;
  }
});

document.addEventListener('keydown', (e) => {
  const cell = e.target;
  const isEditable = cell.getAttribute('contenteditable') === 'true';

  if ((e.ctrlKey || e.metaKey)) {
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); return; }
    if (e.key === 'c' && isEditable) { _clipboardText = cell.innerText.trim(); return; }
    if (e.key === 'v' && isEditable && _clipboardText !== null) {
      e.preventDefault();
      pushUndo(cell, cell.innerText);
      cell.innerText = _clipboardText;
      applyDynamicStyles(cell);
      checkConflicts(cell);
      saveContent(getCellKey(cell), _clipboardText);
      updateStatusBar(cell);
      return;
    }
  }

  if (!isEditable) return;

  const row = cell.parentElement;
  const table = cell.closest('table');
  const colIndex = cell.cellIndex;
  const rowIndex = row.rowIndex;
  let nextCell = null;

  // Navegação Vertical
  if (e.key === 'Enter' || e.key === 'ArrowDown') {
    e.preventDefault();
    for (let i = rowIndex + 1; i < table.rows.length; i++) {
      const target = table.rows[i].cells[colIndex];
      if (target && target.getAttribute('contenteditable') === 'true') { nextCell = target; break; }
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    for (let i = rowIndex - 1; i >= 2; i--) {
      const target = table.rows[i].cells[colIndex];
      if (target && target.getAttribute('contenteditable') === 'true') { nextCell = target; break; }
    }
  } 
  // Navegação Horizontal (Nova funcionalidade)
  else if (e.key === 'ArrowRight') {
    let target = cell.nextElementSibling;
    while (target && target.getAttribute('contenteditable') !== 'true') {
      target = target.nextElementSibling;
    }
    if (target) { e.preventDefault(); nextCell = target; }
  } else if (e.key === 'ArrowLeft') {
    let target = cell.previousElementSibling;
    while (target && target.getAttribute('contenteditable') !== 'true') {
      target = target.previousElementSibling;
    }
    if (target) { e.preventDefault(); nextCell = target; }
  }

  if (nextCell) {
    nextCell.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(nextCell);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
});

// --- HELPERS ---

/**
 * Converte string de horário (ex: "7h05") para minutos.
 * @param {string} str - Texto do horário.
 * @returns {number|null} Minutos desde a meia-noite.
 */
const timeToMinutes = (str) => {
  const match = str.toLowerCase().match(/(\d+)h(\d+)?/);
  return match ? parseInt(match[1]) * 60 + parseInt(match[2] || 0) : null;
};

/**
 * Determina o índice do dia e o especialista de uma célula.
 * @param {HTMLElement} cell - Célula da tabela.
 * @returns {Object} { dayIdx, specialist, table }
 */
function getDayAndColIndices(cell) {
  const table = cell.closest('table');
  const colIndex = cell.cellIndex;
  const layout = table.closest('#section-morning') ? CONFIG.LAYOUTS.morning : CONFIG.LAYOUTS.afternoon;
  let dayIdx = 0;
  let colSum = 0;
  for (let i = 0; i < layout.length; i++) {
    colSum += layout[i];
    if (colIndex <= colSum) { dayIdx = i + 1; break; }
  }
  const specialist = table.rows[1].cells[colIndex - 1]?.innerText || '';
  return { dayIdx, specialist, table };
}

// --- FILTRO DE DIA ---

/**
 * Filtra a visualização para mostrar apenas um dia específico.
 * Esconde colunas de outros dias e ajusta o layout da tabela.
 * @param {number|string} selectedDayIndex - 0 para todos, 1-5 para dias.
 */
function filterByDay(selectedDayIndex) {
  localStorage.setItem(CONFIG.FILTER_DAY_KEY, selectedDayIndex);
  const selectedDay = parseInt(selectedDayIndex);

  _dom.tables().forEach(table => {
    const container = table.closest('.table-container');
    if (container) {
      container.classList.toggle('single-day-active', selectedDay !== 0);
      container.scrollTo({ left: 0, behavior: 'smooth' });
    }

    const layout = table.closest('#section-morning') ? CONFIG.LAYOUTS.morning : CONFIG.LAYOUTS.afternoon;
    const rows = table.rows;

    for (let i = 1; i <= 5; i++) {
      const headerCell = rows[0].cells[i];
      if (headerCell) headerCell.classList.toggle('hidden-col', selectedDay !== 0 && selectedDay !== i);
    }

    let colOffset = 0;
    layout.forEach((colsInDay, dayIdx) => {
      const currentDayNum = dayIdx + 1;
      const shouldHide = (selectedDay !== 0 && selectedDay !== currentDayNum);

      for (let c = 0; c < colsInDay; c++) {
        const cell = rows[1].cells[colOffset + c];
        if (cell) cell.classList.toggle('hidden-col', shouldHide);
      }
      for (let r = 2; r < rows.length; r++) {
        if (rows[r].classList.contains('recreio')) continue;
        for (let c = 0; c < colsInDay; c++) {
          const cell = rows[r].cells[colOffset + c + 1];
          if (cell) cell.classList.toggle('hidden-col', shouldHide);
        }
      }
      colOffset += colsInDay;
    });

    // Atualiza o colspan das linhas de recreio para o número de colunas visíveis
    const visibleColCount = selectedDay === 0 
      ? 1 + layout.reduce((acc, val) => acc + val, 0) 
      : 1 + layout[selectedDay - 1];

    table.querySelectorAll('tr.recreio td').forEach(td => {
      td.colSpan = visibleColCount;
    });
  });
  updateHighlights();
}

/**
 * Limpa o campo de busca e remove todos os destaques de correspondência.
 */
function clearSearch() {
  const searchInput = _dom.searchInput();
  if (searchInput) { searchInput.value = ''; highlightOccurrences(''); }
}

/**
 * Destaca células que contêm o texto pesquisado ou cuja sigla do professor
 * regente corresponde ao termo.
 * @param {string} text - Termo de busca.
 */
function highlightOccurrences(text) {
  const cleanText = text.trim().toUpperCase();
  _dom.cells().forEach(c => {
    const cellText = c.innerText.trim().toUpperCase();
    const cellBaseCode = cellText.split('(')[0].trim();
    if (cleanText && (cellText.includes(cleanText) || cellBaseCode === cleanText) && !['*', ''].includes(cleanText)) {
      c.classList.add('match-highlight');
    } else {
      c.classList.remove('match-highlight');
    }
  });
}

// --- FOCUS E STATUS BAR ---
document.addEventListener('focusin', (e) => {
  const cell = e.target;
  const isEditable = cell.getAttribute('contenteditable') === 'true';
  const isReadonlyMode = document.body.classList.contains('readonly');

  if (isEditable || isReadonlyMode) {
    updateStatusBar(cell);
    highlightOccurrences(cell.innerText);

    const colIndex = cell.cellIndex;
    const table = cell.closest('table');

    document.querySelectorAll('.col-highlight').forEach(el => el.classList.remove('col-highlight'));

    if (colIndex > 0 && table) {
      const { dayIdx } = getDayAndColIndices(cell);
      if (table.rows[0].cells[dayIdx]) table.rows[0].cells[dayIdx].classList.add('col-highlight');
      if (table.rows[1].cells[colIndex - 1]) table.rows[1].cells[colIndex - 1].classList.add('col-highlight');
      for (let i = 2; i < table.rows.length; i++) {
        const r = table.rows[i];
        if (r.cells[colIndex]) r.cells[colIndex].classList.add('col-highlight');
      }
    }
  }
});

/**
 * Atualiza a barra de status com informações da célula selecionada.
 * @param {HTMLElement} cell - Célula focada.
 */
function updateStatusBar(cell) {
  const text = cell.innerText.trim().toUpperCase();
  const baseCode = text.split('(')[0].trim();
  const teacherMap = getTeacherMap();
  const teacherName = teacherMap[text] || teacherMap[baseCode];

  const colIndex = cell.cellIndex;
  const table = cell.closest('table');
  const row = cell.parentElement;

  document.querySelectorAll('tr').forEach(r => r.classList.remove('row-highlight'));
  row.classList.add('row-highlight');
  document.querySelectorAll('th').forEach(th => th.classList.remove('header-highlight'));

  const professorHeader = table.rows[1].cells[colIndex - 1];
  const sb = _dom.statusBar();
  if (!sb) return;

  if (professorHeader) {
    const sigla = professorHeader.innerText.trim().toUpperCase();
    const nomeProf = teacherMap[sigla] || `Especialista: ${sigla}`;
    const nomeRegente = teacherName && !CONFIG.SPECIALIST_SIGLAS.includes(text) && !CONFIG.SPECIALIST_SIGLAS.includes(baseCode)
      ? ` | <b>Regente:</b> ${teacherName}`
      : '';

    sb.innerHTML = `
      <div class="status-item"><b>Especialista:</b> ${nomeProf}</div>
      <div class="status-item"><b>Sala/Turma:</b> ${cell.innerText || '(vazia)'}${nomeRegente}</div>
    `;
    professorHeader.classList.add('header-highlight');
  }

  const count = Array.from(_dom.cells()).filter(c => c.innerText.trim().toUpperCase() === text).length;
  if (text && text !== '*') {
    sb.innerHTML += `<div class="status-item"><b>Aulas na Semana:</b> ${count}</div>`;
  }
}

// --- TEMA ---
function applyTheme() {
  const btn = _dom.themeBtn();
  // A classe .dark-theme já é aplicada no <head> do HTML.
  // Aqui apenas sincronizamos o texto do botão.
  const isDark = document.documentElement.classList.contains('dark-theme');
  if (btn) btn.innerHTML = isDark ? '☀️ Tema Claro' : '🌙 Tema Escuro';
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark-theme');
  const btn = _dom.themeBtn();
  if (isDark) {
    localStorage.setItem(CONFIG.THEME_KEY, 'dark');
    if (btn) btn.innerHTML = '☀️ Tema Claro';
  } else {
    localStorage.setItem(CONFIG.THEME_KEY, 'light');
    if (btn) btn.innerHTML = '🌙 Tema Escuro';
  }
}

// --- MODO LEITURA / EDIÇÃO ---
function toggleLockMode() {
  const isReadonly = document.body.classList.toggle('readonly');
  const btn = _dom.lockBtn();
  if (isReadonly) {
    if (btn) {
      btn.innerHTML = '🔒 Modo Leitura';
      btn.style.background = '#64748b';
    }
  } else {
    const password = prompt('Digite a senha para desbloquear:');
    if (password === CONFIG.LOCK_PASSWORD) {
      if (btn) {
        btn.innerHTML = '🔓 Modo Edição';
        btn.style.background = '#ef4444';
      }
    } else {
      document.body.classList.add('readonly');
      alert('Senha incorreta!');
    }
  }
  updateAriaStatus();
}

// --- EXPORTAÇÃO ---
function exportToCsv() {
  let csv = 'Período,Dia,Horário,Especialista,Turma\n';
  const days = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

  _dom.tables().forEach(table => {
    const period = table.closest('#section-morning') ? 'Manhã' : 'Tarde';
    const layout = table.closest('#section-morning') ? CONFIG.LAYOUTS.morning : CONFIG.LAYOUTS.afternoon;
    const rows = table.rows;
    const specialists = [];

    for (let i = 0; i < rows[1].cells.length; i++) {
      specialists.push(rows[1].cells[i].innerText.trim());
    }

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (row.classList.contains('recreio')) continue;
      const time = row.cells[0].innerText.trim();
      let colOffset = 0;
      layout.forEach((colsInDay, dayIdx) => {
        const dayName = days[dayIdx + 1];
        for (let c = 0; c < colsInDay; c++) {
          const cell = row.cells[colOffset + c + 1];
          if (cell) {
            const specialist = specialists[colOffset + c] || '';
            const value = cell.innerText.trim().replace(/"/g, '""');
            csv += `"${period}","${dayName}","${time}","${specialist}","${value}"\n`;
          }
        }
        colOffset += colsInDay;
      });
    }
  });

  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `horario_escolar_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
  link.click();
}

function exportBackupJSON() {
  const data = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (!data) return alert("Não há dados para exportar.");

  const blob = new Blob([data], { type: 'application/json' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `backup_horario_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
}

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
        const parsed = JSON.parse(content);

        const hasScheduleData = Object.keys(parsed).some(key => key.startsWith('sched_'));
        if (!hasScheduleData) {
          throw new Error("Arquivo não contém dados de horário válidos.");
        }

        if (confirm("Isso irá sobrescrever todos os dados atuais. Deseja continuar?")) {
          localStorage.setItem(CONFIG.STORAGE_KEY, content);
          window.location.reload();
        }
      } catch (err) {
        alert(`Erro na importação: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// --- DESTAQUE DO HORÁRIO ATUAL ---
let _lastMinuteProcessed = -1;

/**
 * Atualiza os destaques visuais (linha, coluna e célula) baseados no horário
 * e dia da semana atuais do sistema.
 */
function updateHighlights() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (currentMinutes === _lastMinuteProcessed) return;
  _lastMinuteProcessed = currentMinutes;

  const day = now.getDay();

  document.querySelectorAll('.current-active').forEach(el => el.classList.remove('current-active'));

  if (day < 1 || day > 5) return;

  document.querySelectorAll('table').forEach((table) => {
    const currentLayout = table.closest('#section-morning') ? CONFIG.LAYOUTS.morning : CONFIG.LAYOUTS.afternoon;

    // Remove destaques de dias anteriores e aplica o atual na tabela
    table.classList.remove('current-day-1', 'current-day-2', 'current-day-3', 'current-day-4', 'current-day-5');
    table.classList.add(`current-day-${day}`);

    if (table.rows[0].cells[day]) table.rows[0].cells[day].classList.add('current-active');

    for (let i = 2; i < table.rows.length; i++) {
      const row = table.rows[i];
      const timeText = row.cells[0].innerText;
      const parts = timeText.split(' - ');
      let start = null, end = null;

      if (row.classList.contains('recreio') && parts.length >= 3) {
        start = timeToMinutes(parts[1]);
        end = timeToMinutes(parts[2]);
      } else if (parts.length === 2) {
        start = timeToMinutes(parts[0]);
        end = timeToMinutes(parts[1]);
      }

      if (start !== null && currentMinutes >= start && currentMinutes < end) {
        row.classList.add('current-active'); 
        const timeCell = row.cells[0];
        // Só adiciona destaque de célula se não for recreio, 
        // para evitar que o CSS de flexbox quebre o colspan
        if (timeCell && !row.classList.contains('recreio')) timeCell.classList.add('current-active');

        // Só faz scroll se o usuário não estiver editando algo no momento
        if ((!window._lastActiveRow || window._lastActiveRow !== row) && !document.activeElement.isContentEditable) {
          window._lastActiveRow = row;
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

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

/**
 * Aplica divisórias visuais entre os dias da semana nas tabelas.
 */
function applyStaticDayDividers() {
  document.querySelectorAll('table').forEach(table => {
    const specialistRow = table.rows[1];
    if (!specialistRow) return;

    const layout = table.closest('#section-morning') ? CONFIG.LAYOUTS.morning : CONFIG.LAYOUTS.afternoon;
    let colOffset = 0;

    layout.forEach((colsInDay, dayIdx) => {
      const dayNum = dayIdx + 1;

      const headerCell = table.rows[0].cells[dayNum];
      if (headerCell) {
        headerCell.classList.add(`day-header-${dayNum}`);
        if (dayIdx < layout.length - 1) headerCell.classList.add('day-divider');
      }

      for (let r = 1; r < table.rows.length; r++) {
        for (let c = 0; c < colsInDay; c++) {
          const targetCol = colOffset + c + 1;
          const cell = table.rows[r].cells[targetCol];
          if (cell) {
            cell.classList.add(`day-cell-${dayNum}`);
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

/**
 * Destaca/Remove destaque de colunas baseado na categoria clicada na legenda.
 * @param {string} category - Categoria (hl, pd, el, mtf).
 */
function toggleCategory(category) {
  const clickedBox = document.querySelector(`.legend-item .box.${category}`);
  if (!clickedBox) return;
  const isActive = clickedBox.parentElement.classList.toggle('active');

  document.querySelectorAll('table').forEach(table => {
    const specialistRow = table.rows[1];
    if (!specialistRow) return;

    for (let i = 0; i < specialistRow.cells.length; i++) {
      const th = specialistRow.cells[i];
      const isMatch = th.classList.contains(category) ||
                      th.innerText.trim().toUpperCase() === category.toUpperCase();

      if (isMatch) {
        th.classList.toggle('category-select', isActive);
        for (let r = 2; r < table.rows.length; r++) {
          const cell = table.rows[r].cells[i + 1];
          if (cell) cell.classList.toggle('category-select', isActive);
        }
      }
    }
  });

  if (category === 'hl') {
    _dom.cells().forEach(cell => {
      const txt = cell.innerText.trim().toUpperCase();
      if (txt === 'HL' || txt === 'HTPC') {
        cell.classList.toggle('category-select', isActive);
      }
    });
  }
}

/**
 * Limpa todos os dados de horários do sistema após confirmação dupla.
 */
function clearAllScheduleData() {
  const confirm1 = confirm("Tem certeza que deseja apagar TODOS os horários salvos?");
  if (confirm1) {
    const confirm2 = confirm("ESTA AÇÃO NÃO PODE SER DESFEITA. Confirmar exclusão total?");
    if (confirm2) {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      window.location.reload();
    }
  }
}

/**
 * Calcula a diferença de tempo e formata para exibição mm:ss.
 * @param {number} totalSeconds - Total de segundos.
 * @returns {string} String formatada.
 */
function formatTimeDifference(totalSeconds) {
  if (totalSeconds < 0) return "00m 00s";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
}

/**
 * Gerencia o cronômetro da barra de ferramentas, identificando se o usuário está
 * em aula, no recreio ou fora do período letivo.
 */
function updateTimeCounter() {
  const now = new Date();
  const day = now.getDay();
  const currentTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const timeCounterElement = document.getElementById('time-counter');
  const progressBar = document.getElementById('main-progress-bar');

  if (day < 1 || day > 5) {
    if (timeCounterElement) timeCounterElement.innerText = "Fim de semana";
    return;
  }

  let activePeriod = null;
  let nextPeriod = null;
  let minSecondsToNext = Infinity;

  document.querySelectorAll('table').forEach((table) => {
    const currentLayout = table.closest('#section-morning') ? CONFIG.LAYOUTS.morning : CONFIG.LAYOUTS.afternoon;

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

  if (timeCounterElement) timeCounterElement.innerText = message;
}

/**
 * Atualiza o relógio digital na interface com segundos e data.
 */
function updateClock() {
  const clockElement = document.getElementById('current-date-time');
  if (!clockElement) return;
  const now = new Date();
  clockElement.textContent = now.toLocaleString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Reorganiza as seções da página colocando o horário da tarde primeiro se já
 * passar do meio-dia, otimizando o scroll para o usuário.
 */
function reorderSectionsByTime() {
  const now = new Date();
  const hour = now.getHours();
  const wrapper = document.getElementById('schedule-wrapper');
  const morning = document.getElementById('section-morning');
  const afternoon = document.getElementById('section-afternoon');

  if (hour >= 12 && wrapper && morning && afternoon) {
    wrapper.insertBefore(afternoon, morning);
  }
}

// --- SISTEMA DE ZOOM ---
function initZoom() {
  const savedZoom = localStorage.getItem(CONFIG.ZOOM_LEVEL_KEY) || "1";
  applyZoom(parseFloat(savedZoom));

  const zoomWrapper = document.createElement('div');
  zoomWrapper.className = 'zoom-controls';
  zoomWrapper.innerHTML = `
    <span class="legend-title" style="font-size: 0.7rem; font-weight: 800; margin: 0">ZOOM</span>
    <div style="display: flex; gap: 4px; align-items: center;">
      <button class="btn" type="button" onclick="adjustZoom(-0.1)" title="Diminuir" aria-label="Diminuir nível de zoom">-</button>
      <span id="zoom-display" style="min-width: 45px; text-align: center; font-weight: bold; font-size: 0.85rem">${Math.round(parseFloat(savedZoom) * 100)}%</span>
      <button class="btn" type="button" onclick="adjustZoom(0.1)" title="Aumentar" aria-label="Aumentar nível de zoom">+</button>
    </div>
  `;
  document.body.appendChild(zoomWrapper);
}

function adjustZoom(delta) {
  const currentZoom = parseFloat(localStorage.getItem(CONFIG.ZOOM_LEVEL_KEY) || "1");
  let newZoom = Math.min(Math.max(currentZoom + delta, 0.5), 2.0); // Limites: 50% a 200%
  newZoom = Math.round(newZoom * 10) / 10; // Arredonda para 1 casa decimal
  applyZoom(newZoom);
}

function applyZoom(level) {
  document.documentElement.style.setProperty('--table-zoom', level);
  localStorage.setItem(CONFIG.ZOOM_LEVEL_KEY, level);
  const display = document.getElementById('zoom-display');
  if (display) display.innerText = `${Math.round(level * 100)}%`;
}

// Inicialização e intervalos
loadData(); // Carrega os dados salvos
applyTheme(); // Aplica o tema salvo
reorderSectionsByTime(); // Organiza a ordem das tabelas por relevância
updateHighlights(); // Destaca o horário atual
updateTimeCounter(); // Inicia o contador de tempo
updateClock(); // Inicia o relógio
initZoom(); // Inicia o controle de zoom
updateAriaStatus(); // Sincroniza estado de edição inicial

setInterval(updateHighlights, 10000); // Atualiza a cada 10 segundos para maior precisão

// Event listener para o select de filtro de dia
document.addEventListener('DOMContentLoaded', () => {
  const dayFilterSelect = _dom.dayFilter();

  // Recupera o filtro salvo ou padrão (0 - Todos)
  const savedDay = localStorage.getItem(CONFIG.FILTER_DAY_KEY) || "0";

  if (dayFilterSelect) {
    dayFilterSelect.value = savedDay;
    dayFilterSelect.addEventListener('change', (e) => {
      filterByDay(parseInt(e.target.value));
    });
  }

  // Aplica o filtro inicial imediatamente para evitar "flash" de colunas
  filterByDay(parseInt(savedDay));
});

// --- SISTEMA DE GERENCIAMENTO DE PROFESSORES ---

/**
 * Abre o modal de gerenciamento de professores.
 */
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
      type: 'button',
      className: `btn ${cls}`,
      textContent: text
    });
    btn.onclick = fn;
    return btn;
  };

  // Estrutura do formulário
  const form = document.createElement('div');
  form.className = 'modal-form';
  const inputSigla = Object.assign(document.createElement('input'), { id: 'new-sigla', placeholder: 'Sigla (ex: 1A)', className: 'search-field' });
  const inputNome = Object.assign(document.createElement('input'), { id: 'new-nome', placeholder: 'Nome do Professor', className: 'search-field' });
  form.append(inputSigla, inputNome, createBtn('➕ Adicionar', 'btn-primary', addTeacherToRegistry));

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.append(
    createBtn('Fechar', '', () => closeModal(overlay)),
    createBtn('Salvar e Reiniciar', 'btn-success', saveTeacherRegistryAndReload)
  );

  modal.append(title, listContainer, form, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus Trap
  setupFocusTrap(overlay);
  renderTeacherList(map);
  setTimeout(() => inputSigla.focus(), 100);
}

function closeModal(overlay) {
  overlay.remove();
}

/**
 * Configura focus trap para um modal.
 * @param {HTMLElement} overlay - Elemento overlay do modal.
 */
function setupFocusTrap(overlay) {
  const focusableElements = overlay.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });
}

function renderTeacherList(map) {
  const container = document.getElementById('modal-teacher-list');
  if (!container) return;
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

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-edit';
    editBtn.style.padding = '4px 8px';
    editBtn.textContent = '✏️';
    editBtn.onclick = () => prepareEditTeacher(sigla, map[sigla]);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-delete';
    delBtn.style.padding = '4px 8px';
    delBtn.textContent = '🗑️';
    delBtn.onclick = () => removeTeacherFromRegistry(sigla);

    info.append(sSpan, nSpan);
    actions.append(editBtn, delBtn);
    item.append(info, actions);
    container.appendChild(item);
  });
}

function prepareEditTeacher(sigla, nome) {
  const siglaInput = document.getElementById('new-sigla');
  const nomeInput = document.getElementById('new-nome');
  if (siglaInput) siglaInput.value = sigla;
  if (nomeInput) {
    nomeInput.value = nome;
    nomeInput.focus();
  }
  const addBtn = document.querySelector('.modal-form .btn-primary');
  if (addBtn) addBtn.textContent = '💾 Atualizar';
}

function addTeacherToRegistry() {
  const sigla = document.getElementById('new-sigla').value.trim().toUpperCase();
  const nome = document.getElementById('new-nome').value.trim();
  if (!sigla || !nome) return alert("Preencha sigla e nome.");

  const map = getTeacherMap();
  map[sigla] = nome;
  _teacherMapCache = map; // Atualiza o cache
  localStorage.setItem(CONFIG.TEACHER_REGISTRY_KEY, JSON.stringify(map));
  renderTeacherList(map);
  refreshTableUI(); // Atualiza a tabela imediatamente

  // Limpa campos e reseta botão
  const siglaInput = document.getElementById('new-sigla');
  const nomeInput = document.getElementById('new-nome');
  if (siglaInput) siglaInput.value = '';
  if (nomeInput) nomeInput.value = '';
  const addBtn = document.querySelector('.modal-form .btn-primary');
  if (addBtn) addBtn.textContent = '➕ Adicionar';
}

function removeTeacherFromRegistry(sigla) {
  const map = getTeacherMap();
  delete map[sigla];
  _teacherMapCache = map; // Atualiza o cache
  localStorage.setItem(CONFIG.TEACHER_REGISTRY_KEY, JSON.stringify(map));
  renderTeacherList(map);
  refreshTableUI(); // Atualiza a tabela imediatamente
}

function saveTeacherRegistryAndReload() {
  if (confirm("O sistema será reiniciado para aplicar as mudanças nos nomes dos professores. Continuar?")) {
    window.location.reload();
  }
}

/**
 * Atualiza a interface da tabela após alterações no registro de professores.
 */
function refreshTableUI() {
  _dom.cells().forEach(cell => {
    applyDynamicStyles(cell);
    checkConflicts(cell);
  });
}

setInterval(() => {
  updateTimeCounter();
  updateClock();
}, 1000); // Atualiza o contador de tempo e o relógio a cada 1 segundo
