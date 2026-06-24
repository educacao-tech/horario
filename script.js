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
  HISTORY_KEY: 'school_history_v2',
  COLORS_KEY: 'school_custom_colors_v1',
  LOCK_PASSWORD: 'qwe123', // Senha padrão para desbloquear o modo de edição
  LAST_UPDATE_DATE: '2024-04-29', // Data da última atualização do código
  GITHUB_REPO: 'seu-usuario-real/seu-repositorio-horario', 
  LAYOUTS: {
    morning: [6, 5, 4, 4, 5],
    afternoon: [5, 4, 4, 5, 4]
  },
  SPECIALIST_SIGLAS: ['A(S)', 'A(M)', 'EF(M)', 'EF(P)', 'CT(D)', 'EDM(L)', 'EDM', 'EL', 'MTF', 'PI', 'PII'],
  DATA_CATEGORIES: ['HL', 'HTPC', 'PD', 'EL', 'MTF'],
  SPECIALIST_SET: new Set(['A(S)', 'A(M)', 'EF(M)', 'EF(P)', 'CT(D)', 'EDM(L)', 'EDM', 'EL', 'MTF', 'PI', 'PII'])
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
/**
 * Gerenciador de elementos do DOM com sistema de cache.
 */
class DOMManager {
  constructor() {
    this._cache = {};
    this._cellsCache = null;
  }

  /**
   * Recupera um elemento pelo ID e armazena no cache.
   * @param {string} id - ID do elemento.
   * @returns {HTMLElement|null}
   */
  _get(id) {
    return this._cache[id] || (this._cache[id] = document.getElementById(id));
  }

  /**
   * Retorna a lista de todas as células editáveis (cacheada).
   */
  cells() {
    if (!this._cellsCache) {
      this._cellsCache = document.querySelectorAll('[contenteditable="true"]');
    }
    return this._cellsCache;
  }

  /**
   * Invalida o cache das células para forçar uma nova busca no DOM.
   */
  invalidateCache() {
    this._cellsCache = null;
  }

  // Getters para elementos estruturais
  tables() { return document.querySelectorAll('table'); }
  statusBar() { return this._get('statusBar'); }
  saveIndicator() { return this._get('save-indicator'); }
  timeCounter() { return this._get('time-counter'); }
  progressBar() { return this._get('main-progress-bar'); }
  clock() { return this._get('current-date-time'); }
  themeBtn() { return this._get('theme-toggle'); }
  lockBtn() { return this._get('lock-btn'); }
  searchInput() { return this._get('search-input'); }
  dayFilter() { return this._get('day-filter-select'); }
  searchSuggestions() { return this._get('search-suggestions'); }
  mainMenu() { return this._get('main-menu-dropdown'); }
}

// Instância global para manter compatibilidade com o código existente
const _dom = new DOMManager();

/**
 * Gerenciador de persistência de dados.
 */
class StorageManager {
  /**
   * Salva um item no localStorage com tratamento de erro.
   */
  save(key, data) {
    try {
      if (data === undefined) return false;
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error(`Erro ao salvar ${key}:`, e);
      showToast("Espaço de armazenamento cheio ou indisponível.", "error");
      return false;
    }
  }

  /**
   * Recupera um item do localStorage.
   */
  load(key, defaultValue = null) {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
      console.error(`Erro ao carregar ${key}:`, e);
      return defaultValue;
    }
  }

  /**
   * Remove um item.
   */
  remove(key) {
    localStorage.removeItem(key);
  }
}

const _storage = new StorageManager();

/**
 * Carrega o mapa de professores do localStorage ou retorna o padrão.
 * @returns {Object} Mapa de siglas para nomes de professores.
 */
function getInitialTeacherMap() {
  return _storage.load(CONFIG.TEACHER_REGISTRY_KEY, DEFAULT_TEACHER_MAP);
}

/**
 * Exibe uma notificação temporária na tela.
 * @param {string} message - Mensagem a ser exibida.
 * @param {string} type - Tipo da notificação: 'success', 'error', 'info'.
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-in 0.3s ease-in reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

let _teacherMapCache = getInitialTeacherMap(); // Inicializa o cache de professores
let _clipboardText = null;
let _gitHubInfoCache = null; // Cache para persistir os dados do GitHub
let _activeSuggestionIndex = -1; // Rastreia o item focado via teclado no autocomplete
let _saveIndicatorTimeout = null; // Controla o tempo de exibição do feedback de salvamento
let _isSelecting = false;
let _selectionStartCell = null;
let _selectedCells = new Set();

// --- SCHEMA MIGRATION ---
function runMigrations() {
  const storageKeyVersion = 'school_schema_version';
  const currentVersion = parseInt(_storage.load(storageKeyVersion, '0'));
  
  if (currentVersion < CONFIG.SCHEMA_VERSION) {
    console.info(`Migrando schema de v${currentVersion} para v${CONFIG.SCHEMA_VERSION}...`);
    
    // Migração da v1 para v2 (Mudança de chave de storage)
    const oldData = _storage.load('school_schedule_v1');
    if (oldData) {
      if (_storage.save(CONFIG.STORAGE_KEY, oldData)) {
        _storage.remove('school_schedule_v1');
      }
    }
    _storage.save(storageKeyVersion, CONFIG.SCHEMA_VERSION.toString());
  }
}

/**
 * Normaliza uma string para comparação: remove acentos e converte para maiúsculas.
 * @param {string} str - String original.
 * @returns {string} String normalizada.
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Inicializa o processo de migração de dados se necessário.
 */
function initializeData() {
  runMigrations();
}

// --- CORE FUNCTIONS ---

/**
 * Retorna o mapa de professores cacheado.
 * @returns {Object} Mapa de siglas para nomes de professores.
 */
function getTeacherMap() {
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
  const row = cell.parentElement;
  
  // Fallback de segurança caso a célula esteja fora de uma estrutura de tabela válida
  if (!table || !row || typeof row.rowIndex === 'undefined') {
    return `cell_fallback_${Math.random().toString(36).substr(2, 9)}`;
  }

  const section = cell.closest('section, div[id^="section-"]');
  const sectionId = section ? section.id : 'unknown';
  const time = table.rows[row.rowIndex]?.cells[0]?.innerText.trim() || 'time_unknown';
  const specialist = table.rows[1]?.cells[cell.cellIndex - 1]?.innerText.trim() || `col_${cell.cellIndex}`;
  return `sched_${sectionId}_${time}_${specialist}`.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Salva o conteúdo de uma célula no localStorage com debounce.
 * @param {string} key - Chave identificadora da célula.
 * @param {string} text - Texto a ser salvo.
 */
const saveContent = debounce((key, text) => {
  const data = _storage.load(CONFIG.STORAGE_KEY, {});
  data[key] = text;
  _storage.save(CONFIG.STORAGE_KEY, data);
  
  const indicator = _dom.saveIndicator();
  if (indicator) {
    clearTimeout(_saveIndicatorTimeout);
    indicator.style.opacity = '1';
    _saveIndicatorTimeout = setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
  }
}, 500);

/**
 * Aplica estilos dinâmicos à célula com base em seu conteúdo.
 * @param {HTMLElement} cell - Célula a ser estilizada.
 */
function applyDynamicStyles(cell) {
  const text = cell.textContent.trim().toUpperCase();
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

  // Auxílio visual para células com asterisco via CSS
  if (text === '*') {
    cell.setAttribute('data-text', '*');
  } else {
    cell.removeAttribute('data-text');
  }
}

/**
 * Verifica conflitos de horário em uma linha (turma/professor em múltiplas salas).
 * Agora com debounce para evitar processamento excessivo durante a digitação.
 * @param {HTMLElement} cell - Célula que foi modificada.
 */
const checkConflicts = debounce((cell) => {
  const row = cell.parentElement;
  if (!row) return;

  const rowData = getRowConflictData(row);
  
  // Aplicar resultados ao DOM de forma eficiente
  rowData.cells.forEach(({ element, key, text, teacher }) => {
    const hasConflict = rowData.frequencies[key] > 1;
    
    if (hasConflict) {
      const errorMsg = teacher
        ? `Conflito: Professor ${teacher} em múltiplas salas.`
        : `Conflito: Turma ${text} em múltiplas salas.`;
      
      element.classList.add('conflict-error');
      element.setAttribute('title', errorMsg);
    } else {
      element.classList.remove('conflict-error');
      element.removeAttribute('title');
    }
  });

  updateGlobalConflictCount();
}, 300);

/**
 * Analisa logicamente os conflitos de uma linha.
 * @param {HTMLTableRowElement} row 
 */
function getRowConflictData(row) {
  const teacherMap = getTeacherMap();
  const frequencies = {};
  const cells = [];

  Array.from(row.cells).forEach(c => {
    if (c.getAttribute('contenteditable') !== 'true') return;

    const txt = c.textContent.trim().toUpperCase();
    if (!txt || txt === '*' || CONFIG.SPECIALIST_SET.has(txt)) {
      // Limpeza imediata para células que não entram na conta de conflitos
      c.classList.remove('conflict-error');
      c.removeAttribute('title');
      return;
    }

    const base = txt.split('(')[0].trim();
    const teacher = teacherMap[txt] || (txt !== base ? teacherMap[base] : null);
    const key = teacher || txt;

    frequencies[key] = (frequencies[key] || 0) + 1;
    cells.push({ element: c, key, teacher, text: txt });
  });

  return { frequencies, cells };
}

/**
 * Atualiza o contador global de conflitos na interface.
 */
function updateGlobalConflictCount() {
  const conflicts = document.getElementsByClassName('conflict-error');
  const total = conflicts.length;
  const container = document.getElementById('global-conflict-container');
  if (!container) return;

  if (total === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div id="global-conflict-badge" class="conflict-badge" title="Clique para ver detalhes">
      ⚠️ ${total} Erro${total > 1 ? 's' : ''}
      <button type="button" onclick="showConflictInspector()" style="background:none; border:none; color:white; cursor:pointer; padding:0 4px; font-weight:bold;">⋮</button>
    </div>
  `;
}

/**
 * Abre um inspetor detalhado de todos os conflitos atuais.
 */
function showConflictInspector() {
  const conflicts = Array.from(document.getElementsByClassName('conflict-error'));
  if (conflicts.length === 0) {
    return showToast("Nenhum conflito detectado!", "success");
  }

  const overlay = Object.assign(document.createElement('div'), { className: 'modal-overlay' });
  overlay.style.display = 'flex';

  const modal = Object.assign(document.createElement('div'), { className: 'modal' });
  modal.innerHTML = `
    <h2>🔍 Inspetor de Conflitos</h2>
    <p>Foram encontrados <strong>${conflicts.length}</strong> problemas de agendamento:</p>
    <div class="teacher-list-container">
      ${conflicts.map((c, idx) => {
        const time = c.closest('tr').cells[0].innerText;
        const period = c.closest('section').id === 'section-morning' ? 'Manhã' : 'Tarde';
        return `
          <div class="backup-item" style="cursor:pointer" onclick="document.querySelectorAll('.modal-overlay').forEach(m=>m.remove()); document.getElementsByClassName('conflict-error')[${idx}].scrollIntoView({behavior:'smooth', block:'center'}); document.getElementsByClassName('conflict-error')[${idx}].focus();">
            <div>
              <strong>${c.innerText}</strong> às ${time} (${period})
              <div style="font-size:0.8rem; color:var(--text-muted)">${c.title}</div>
            </div>
            <span style="font-size:1.2rem">📍</span>
          </div>
        `;
      }).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setupFocusTrap(overlay);
}

/**
 * Carrega dados salvos do localStorage e aplica às células.
 */
function loadData() {
  const data = _storage.load(CONFIG.STORAGE_KEY, {});
  const processedRows = new Set();
  
  _dom.invalidateCache();
  _dom.cells().forEach(cell => {
    const key = getCellKey(cell);
    if (data[key] !== undefined) {
      cell.innerText = data[key];
      applyDynamicStyles(cell);
      processedRows.add(cell.parentElement);
    }
  });

  // Valida cada linha afetada apenas uma vez
  processedRows.forEach(row => {
    const firstEditable = row.querySelector('[contenteditable="true"]');
    if (firstEditable) checkConflicts(firstEditable);
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
  updateGlobalConflictCount();
}

/**
 * Varre todas as células editáveis para validar conflitos globais.
 */
function validateAllConflicts() {
  const rows = new Set();
  _dom.cells().forEach(c => rows.add(c.parentElement));
  rows.forEach(row => {
    const firstEditable = row.querySelector('[contenteditable="true"]');
    if (firstEditable) checkConflicts(firstEditable);
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
  const currentText = action.cell.innerText; // Mantido para referência mas não usado
  action.cell.innerText = action.oldText;
  _undoStack.push({ cell: action.cell, oldText: currentText }); // Permite desfazer o refazer
  applyDynamicStyles(action.cell);
  checkConflicts(action.cell);
  saveContent(getCellKey(action.cell), action.cell.innerText);
  updateStatusBar(action.cell);
}

function sanitizeCell(cell) {
  const original = cell.innerText;
  cell.innerText = original.replace(/\s+/g, ' ').trim().toUpperCase();
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
    updateGlobalConflictCount();
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
      sanitizeCell(e.target);
      pushUndo(e.target, e.target._oldValue);
      createSnapshot(); // Salva um ponto de restauração apenas quando a edição é concluída
    }
    delete e.target._oldValue;
  }
});

document.addEventListener('keydown', (e) => {
  const cell = e.target;
  // Verifica se o alvo é um elemento válido
  if (!cell || typeof cell.getAttribute !== 'function') return;

  const isEditable = cell.getAttribute('contenteditable') === 'true';
  if (!isEditable) return;

  // Atalho para focar busca (/)
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && !isEditable) {
    e.preventDefault();
    _dom.searchInput()?.focus();
  }

  // Atalho para limpar seleção (Esc)
  if (e.key === 'Escape') {
    clearMultiSelection();
    return;
  }

  const row = cell.parentElement;
  const table = cell.closest('table');
  const colIndex = cell.cellIndex; // Movido para cima para evitar ReferenceError
  if (!row || !table) return;

  // Apagar seleção múltipla com Delete ou Backspace
  if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedCells.size > 1) {
    e.preventDefault();
    _selectedCells.forEach(c => {
      if (c.innerText.trim() !== '') {
        pushUndo(c, c.innerText);
        c.innerText = '';
        saveContent(getCellKey(c), '');
        applyDynamicStyles(c);
        checkConflicts(c);
      }
    });
    showToast(`${_selectedCells.size} células limpas`, "info");
    return;
  }

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

    // Fill Down (Ctrl+D)
    if (e.key === 'd' && isEditable) {
      e.preventDefault();
      
      const cellsToFill = _selectedCells.size > 0 ? Array.from(_selectedCells) : [cell];
      let affectedCount = 0;

      cellsToFill.forEach(c => {
        const cRow = c.parentElement;
        const cTable = c.closest('table');
        if (!cRow || !cTable) return;

        const prevRow = cTable.rows[cRow.rowIndex - 1];
        const cellAbove = prevRow ? prevRow.cells[c.cellIndex] : null;

        if (cellAbove && cellAbove.getAttribute('contenteditable') === 'true') {
          if (c.innerText !== cellAbove.innerText) {
            pushUndo(c, c.innerText);
            c.innerText = cellAbove.innerText;
            applyDynamicStyles(c);
            checkConflicts(c);
            saveContent(getCellKey(c), c.innerText);
            affectedCount++;
          }
        }
      });

      if (affectedCount > 0) {
        showToast(`Preenchido ${affectedCount} célula(s)`, "success");
        createSnapshot();
      }
      return;
    }
  }

  let nextCell = null;

  if (e.key === 'Enter' || e.key === 'ArrowDown') {
    e.preventDefault();
    for (let i = row.rowIndex + 1; i < table.rows.length; i++) {
      const target = table.rows[i].cells[colIndex];
      if (target && target.getAttribute('contenteditable') === 'true') { nextCell = target; break; }
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    for (let i = row.rowIndex - 1; i >= 2; i--) {
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
  const match = str.match(/(\d+)[hH](\d+)?/);
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
  const specialist = table.rows[1].cells[colIndex - 1]?.textContent || '';
  return { dayIdx, specialist, table };
}

// --- FILTRO DE DIA ---

/**
 * Filtra a visualização para mostrar apenas um dia específico.
 * Esconde colunas de outros dias e ajusta o layout da tabela.
 * @param {number|string} selectedDayIndex - 0 para todos, 1-5 para dias.
 */
function filterByDay(selectedDayIndex) {
  _storage.save(CONFIG.FILTER_DAY_KEY, selectedDayIndex);
  const selectedDay = parseInt(selectedDayIndex);
  const dayNames = ['', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

  _dom.tables().forEach(table => {
    // Reinicia a animação de fade-in para suavizar a transição de colunas
    table.classList.remove('table-fade-in');
    void table.offsetWidth; // Força reflow para reiniciar a animação
    table.classList.add('table-fade-in');

    const container = table.closest('.table-container');
    if (container) {
      let label = container.querySelector('.filter-day-label');
      if (!label) {
        label = document.createElement('div');
        container.prepend(label);
      }
      label.className = `filter-day-label day-color-${selectedDay}`;
      label.textContent = dayNames[selectedDay] || '';

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
  if (searchInput) { 
    searchInput.value = ''; 
    highlightOccurrences(''); 
    _dom.searchSuggestions().classList.remove('active');
  }
}

/**
 * Versão debounced da função de destaque para melhorar performance na busca.
 */
const debouncedSearch = debounce((text) => {
  highlightOccurrences(text);
  updateSearchSuggestions(text);
}, 300);

/**
 * Gera e exibe sugestões de busca baseadas no mapa de professores.
 */
function updateSearchSuggestions(text) {
  const container = _dom.searchSuggestions();
  if (!container) return;

  const normalizedSearch = normalizeString(text);
  if (normalizedSearch.length < 1) {
    container.classList.remove('active');
    _activeSuggestionIndex = -1;
    return;
  }

  const teacherMap = getTeacherMap();
  const suggestions = Object.entries(teacherMap)
    .filter(([sigla, nome]) => normalizeString(sigla).includes(normalizedSearch) || normalizeString(nome).includes(normalizedSearch))
    .slice(0, 8); // Limita a 8 sugestões para não poluir a tela

  if (suggestions.length === 0) {
    container.classList.remove('active');
    _activeSuggestionIndex = -1;
    return;
  }

  _activeSuggestionIndex = -1; // Reseta o índice ao gerar nova lista
  container.innerHTML = suggestions.map(([sigla, nome]) => `
    <div class="suggestion-item" onclick="selectSuggestion('${sigla}')">
      <span>${nome}</span>
      <span class="sigla-tag">${sigla}</span>
    </div>
  `).join('');
  container.classList.add('active');
}

/**
 * Alterna a exibição do menu principal de ações.
 */
function toggleMainMenu(event) {
  if (event) event.stopPropagation();
  const menu = _dom.mainMenu();
  const btn = document.getElementById('main-menu-btn');
  if (menu && btn) {
    const isExpanded = menu.classList.toggle('active');
    btn.setAttribute('aria-expanded', isExpanded);
  }
}

// Fecha o menu ao clicar fora dele
document.addEventListener('click', (e) => {
  const menu = _dom.mainMenu();
  if (menu && menu.classList.contains('active') && !e.target.closest('.menu-dropdown-wrapper')) {
    menu.classList.remove('active');
    document.getElementById('main-menu-btn')?.setAttribute('aria-expanded', 'false');
  }
});

window.selectSuggestion = function(sigla) {
  const input = _dom.searchInput();
  if (input) {
    input.value = sigla;
    highlightOccurrences(sigla);
    _dom.searchSuggestions().classList.remove('active');
  }
};

/**
 * Move o destaque visual entre as sugestões de busca usando as setas do teclado.
 * @param {string} direction - 'up' ou 'down'.
 */
function moveSuggestionFocus(direction) {
  const container = _dom.searchSuggestions();
  if (!container || !container.classList.contains('active')) return;

  const items = container.querySelectorAll('.suggestion-item');
  if (items.length === 0) return;

  // Remove o destaque do item anterior
  if (_activeSuggestionIndex >= 0 && _activeSuggestionIndex < items.length) {
    items[_activeSuggestionIndex].classList.remove('keyboard-active');
  }

  if (direction === 'down') {
    _activeSuggestionIndex = (_activeSuggestionIndex + 1) % items.length;
  } else if (direction === 'up') {
    _activeSuggestionIndex = (_activeSuggestionIndex - 1 + items.length) % items.length;
  }

  // Aplica o novo destaque e garante visibilidade (scroll)
  const activeItem = items[_activeSuggestionIndex];
  activeItem.classList.add('keyboard-active');
  activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * Destaca células que contêm o texto pesquisado ou cuja sigla do professor
 * regente corresponde ao termo.
 * @param {string} text - Termo de busca.
 */
function highlightOccurrences(text) {
  const normalizedSearch = normalizeString(text);
  const teacherMap = getTeacherMap();
  const cells = _dom.cells();
  const isSearchEmpty = !normalizedSearch || ['*', ''].includes(normalizedSearch);

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const cellText = c.textContent.trim();
    
    if (isSearchEmpty) {
      c.classList.remove('match-highlight');
      continue;
    }

    const cellBaseCode = cellText.split('(')[0].trim();
    const teacherName = teacherMap[cellText] || teacherMap[cellBaseCode] || "";

    const isMatch = normalizeString(cellText).includes(normalizedSearch) || 
                    (teacherName && normalizeString(teacherName).includes(normalizedSearch));

    if (isMatch) c.classList.add('match-highlight');
    else c.classList.remove('match-highlight');
  }
}

/**
 * Inicia o processo de seleção múltipla.
 */
function handleMouseDown(e) {
  if (e.target.getAttribute('contenteditable') !== 'true' || document.body.classList.contains('readonly')) return;
  
  _isSelecting = true;
  _selectionStartCell = e.target;
  
  // Se não estiver segurando Ctrl, limpa seleção anterior
  if (!e.ctrlKey) {
    clearMultiSelection();
  }
  updateSelection(e.target);
}

/**
 * Atualiza a área de seleção enquanto o mouse se move.
 */
function handleMouseEnter(e) {
  if (!_isSelecting || !_selectionStartCell) return;
  updateSelection(e.target);
}

/**
 * Calcula e destaca o retângulo de seleção entre a célula inicial e a atual.
 */
function updateSelection(currentCell) {
  if (currentCell.getAttribute('contenteditable') !== 'true') return;
  
  const table = _selectionStartCell.closest('table');
  if (currentCell.closest('table') !== table) return;

  const r1 = _selectionStartCell.parentElement.rowIndex;
  const c1 = _selectionStartCell.cellIndex;
  const r2 = currentCell.parentElement.rowIndex;
  const c2 = currentCell.cellIndex;

  const startRow = Math.min(r1, r2);
  const endRow = Math.max(r1, r2);
  const startCol = Math.min(c1, c2);
  const endCol = Math.max(c1, c2);

  document.querySelectorAll('.cell-selected').forEach(c => c.classList.remove('cell-selected'));
  _selectedCells.clear();

  for (let r = startRow; r <= endRow; r++) {
    const row = table.rows[r];
    if (!row || row.classList.contains('recreio')) continue;
    for (let c = startCol; c <= endCol; c++) {
      const cell = row.cells[c];
      if (cell && cell.getAttribute('contenteditable') === 'true') {
        cell.classList.add('cell-selected');
        _selectedCells.add(cell);
      }
    }
  }
}

function clearMultiSelection() {
  document.querySelectorAll('.cell-selected').forEach(c => c.classList.remove('cell-selected'));
  _selectedCells.clear();
}

/**
 * Inicializa listeners de Drag and Drop global para importação de arquivos.
 */
function initDragAndDrop() {
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('drag-over');
  });

  window.addEventListener('dragleave', () => document.body.classList.remove('drag-over'));

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('drag-over');
    processBackupFile(e.dataTransfer.files[0]);
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
function updateStatusBar(cell = null) {
  const data = getCellStatusData(cell);
  renderStatusBar(data);
}

/**
 * Extrai os dados lógicos da célula para o status bar.
 */
function getCellStatusData(cell) {
  if (!cell || !cell.closest || !cell.parentElement) return null;

  const text = cell.textContent.trim().toUpperCase();
  const baseCode = text.split('(')[0].trim();
  const teacherMap = getTeacherMap();
  const teacherName = teacherMap[text] || teacherMap[baseCode];
  const colIndex = cell.cellIndex;
  const table = cell.closest('table');
  const row = cell.parentElement;

  let specialistName = "Desconhecido";
  let regenteHTML = "";

  if (table && row && table.rows[1] && colIndex > 0) {
    const professorHeader = table.rows[1].cells[colIndex - 1];
    const sigla = professorHeader ? professorHeader.textContent.trim().toUpperCase() : '';
    specialistName = teacherMap[sigla] || `Especialista: ${sigla}`;
    
    if (teacherName && !CONFIG.SPECIALIST_SET.has(text) && !CONFIG.SPECIALIST_SET.has(baseCode)) {
      regenteHTML = ` | <b>Regente:</b> ${escapeHTML(teacherName)}`;
    }
  }

  const weeklyCount = Array.from(_dom.cells()).filter(c => c.textContent.trim().toUpperCase() === text).length;

  return {
    specialist: specialistName,
    room: cell.innerText || '(vazia)',
    regente: regenteHTML,
    count: text && text !== '*' ? weeklyCount : null,
    row: row
  };
}

/**
 * Renderiza o conteúdo HTML na barra de status.
 */
function renderStatusBar(data) {
  const sb = _dom.statusBar();
  if (!sb) return;

  let statusContent = '';
  let professorHeader = null;

  // Limpa destaques de linha e cabeçalho, se houver uma célula válida
  document.querySelectorAll('tr').forEach(r => r.classList.remove('row-highlight'));
  document.querySelectorAll('th').forEach(th => th.classList.remove('header-highlight'));

  if (data) {
    statusContent += `<div class="status-item"><b>Especialista:</b> ${escapeHTML(data.specialist)}</div>`;
    statusContent += `<div class="status-item"><b>Sala/Turma:</b> ${escapeHTML(data.room)}${data.regente}</div>`;
    if (data.count !== null) {
      statusContent += `<div class="status-item"><b>Aulas na Semana:</b> ${data.count}</div>`;
    }
    data.row.classList.add('row-highlight');
  } else {
    statusContent = '<div class="status-item">Aguardando seleção de aula...</div>';
  }

  // Usa o cache do GitHub se disponível, caso contrário mostra o estado inicial
  // Se o repositório for o placeholder, mostra a data local imediatamente
  const gitInfoText = _gitHubInfoCache || 
    (CONFIG.GITHUB_REPO.includes('seu-usuario-real') 
      ? `v${CONFIG.SCHEMA_VERSION} | Atualizado em: ${CONFIG.LAST_UPDATE_DATE}` 
      : `v${CONFIG.SCHEMA_VERSION} | Sincronizando com GitHub...`);

  // Adiciona o contêiner para informações de versão/atualização à direita
  statusContent += `
    <div class="status-info-right" id="github-update-info">${gitInfoText}</div>
  `;

  sb.innerHTML = statusContent; // Atribui o conteúdo completo de uma vez
}

/**
 * Escapa caracteres HTML para evitar XSS.
 */
function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

/**
 * Busca informações da última atualização diretamente da API do GitHub.
 * Atualiza a data e o hash do commit na barra de status.
 */
async function fetchGitHubUpdateInfo() {
  if (_gitHubInfoCache) return;
  
  // Função auxiliar para atualizar o cache e o elemento na tela
  const setInfo = (text) => {
    _gitHubInfoCache = text;
    const infoRight = document.getElementById('github-update-info');
    if (infoRight) infoRight.innerHTML = text;
  };

  if (!CONFIG.GITHUB_REPO || CONFIG.GITHUB_REPO.includes('seu-usuario-real')) {
    setInfo(`v${CONFIG.SCHEMA_VERSION} | Atualizado em: ${CONFIG.LAST_UPDATE_DATE}`);
    return;
  }

  try {
    // Tenta buscar na branch 'main' (padrão atual do GitHub)
    let response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}/commits/main`);
    
    // Caso não encontre (404), tenta na branch 'master' (repositórios antigos)
    if (response.status === 404) {
      response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}/commits/master`);
    }

    if (response && response.ok) {
      const data = await response.json();
      const date = new Date(data.commit.committer.date).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const sha = data.sha.substring(0, 7);
      const message = data.commit.message.split('\n')[0].substring(0, 30);
      setInfo(`v${CONFIG.SCHEMA_VERSION} (${sha}) | Sincronizado: "${message}..." em ${date}`);
    } else {
      throw new Error(`Resposta HTTP: ${response.status}`);
    }
  } catch (err) {
    console.warn("fetchGitHubUpdateInfo: Falha ao obter dados do GitHub. Usando data local.", err);
    // Fallback: se o GitHub falhar, usa a data estática do CONFIG
    setInfo(`v${CONFIG.SCHEMA_VERSION} | Atualizado em: ${CONFIG.LAST_UPDATE_DATE}`);
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
      showToast('Senha incorreta!', 'error');
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
      specialists.push(rows[1].cells[i].textContent.trim());
    }

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (row.classList.contains('recreio')) continue;
      const time = row.cells[0].textContent.trim();
      let colOffset = 0;
      layout.forEach((colsInDay, dayIdx) => {
        const dayName = days[dayIdx + 1];
        for (let c = 0; c < colsInDay; c++) {
          const cell = row.cells[colOffset + c + 1];
          if (cell) {
            const specialist = specialists[colOffset + c] || '';
            const value = cell.textContent.trim().replace(/"/g, '""');
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

/**
 * Exporta todos os dados do sistema (Horários, Professores e Cores) em um único arquivo JSON.
 */
 function exportBackupJSON() {
  const backup = {
    version: CONFIG.SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    schedule: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '{}'),
    teachers: JSON.parse(localStorage.getItem(CONFIG.TEACHER_REGISTRY_KEY) || 'null'),
    colors: JSON.parse(localStorage.getItem(CONFIG.COLORS_KEY) || 'null')
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `backup_horario_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
}

/**
 * Importa um arquivo de backup completo e atualiza o sistema.
 */
/**
 * Processa um arquivo de backup JSON para importação.
 * @param {File} file - Arquivo JSON vindo de input ou drag-drop.
 */
function processBackupFile(file) {
  if (!file || file.type !== "application/json" && !file.name.endsWith('.json')) {
    return showToast("Por favor, selecione um arquivo .json válido.", "error");
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup.schedule) throw new Error("Estrutura de backup não reconhecida.");

      if (confirm("Deseja restaurar este backup total? Isso sobrescreverá horários, professores e cores.")) {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(backup.schedule));
        if (backup.teachers) localStorage.setItem(CONFIG.TEACHER_REGISTRY_KEY, JSON.stringify(backup.teachers));
        if (backup.colors) localStorage.setItem(CONFIG.COLORS_KEY, JSON.stringify(backup.colors));
        showToast("Backup restaurado com sucesso!", "success");
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err) {
      showToast(`Erro ao ler backup: ${err.message}`, "error");
    }
  };
  reader.readAsText(file);
}

function importBackupJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => processBackupFile(e.target.files[0]);
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

  _dom.tables().forEach(table => table.querySelectorAll('.current-active').forEach(el => el.classList.remove('current-active')));

  if (day < 1 || day > 5) return;

  _dom.tables().forEach((table) => {
    const currentLayout = table.closest('#section-morning') ? CONFIG.LAYOUTS.morning : CONFIG.LAYOUTS.afternoon;

    // Remove destaques de dias anteriores e aplica o atual na tabela
    table.classList.remove('current-day-1', 'current-day-2', 'current-day-3', 'current-day-4', 'current-day-5');
    table.classList.add(`current-day-${day}`);

    if (table.rows[0].cells[day]) table.rows[0].cells[day].classList.add('current-active');

    for (let i = 2; i < table.rows.length; i++) {
      const row = table.rows[i];
      const timeText = row.cells[0].textContent;
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
        // Só destaca se não for recreio para manter o colspan íntegro
        if (timeCell && !row.classList.contains('recreio')) timeCell.classList.add('current-active');

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
                      th.textContent.trim().toUpperCase() === category.toUpperCase();

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
      const txt = cell.textContent.trim().toUpperCase();
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
      const timeText = row.cells[0].textContent;
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
  const toolbar = document.querySelector('.toolbar');
  if (toolbar) toolbar.appendChild(zoomWrapper);
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

/**
 * Inicializa o botão de atalho para rolar até a aula atual.
 */
function initScrollToNow() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.style.backgroundColor = 'var(--accent)';
  btn.style.color = 'white';
  btn.innerHTML = '📍 Agora';
  btn.title = 'Rolar até a aula atual';

  btn.onclick = () => {
    const current = document.querySelector('tr.current-active');
    if (current) {
      current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      showToast("Não há aula ocorrendo no momento", "info");
    }
  };

  // Insere antes do zoom para manter a organização
  const zoom = toolbar.querySelector('.zoom-controls');
  if (zoom) toolbar.insertBefore(btn, zoom);
  else toolbar.appendChild(btn);
}

/**
 * Inicializa o menu hambúrguer para dispositivos móveis.
 */
function initMobileMenu() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'btn mobile-menu-btn';
  menuBtn.innerHTML = '☰';
  menuBtn.title = 'Menu de opções';
  
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    toolbar.classList.toggle('menu-open');
  };

  toolbar.appendChild(menuBtn);

  // Fecha o menu ao clicar fora
  document.addEventListener('click', (e) => {
    if (!toolbar.contains(e.target) && toolbar.classList.contains('menu-open')) {
      toolbar.classList.remove('menu-open');
    }
  });
}

/**
 * Alterna entre o modo de visualização normal e compacto.
 */
function toggleCompactMode() {
  const isCompact = document.body.classList.toggle('compact-mode');
  localStorage.setItem('school_compact_mode', isCompact);
  showToast(isCompact ? "Modo compacto ativado" : "Modo normal ativado", "info");
}

/**
 * Inicializa o efeito de encolhimento do cabeçalho ao rolar a página.
 */
function initScrollEffect() {
  const wrapper = document.querySelector('.top-area-sticky-wrapper');
  if (!wrapper) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      wrapper.classList.add('scrolled');
    } else {
      wrapper.classList.remove('scrolled');
    }
  }, { passive: true });
}

// Inicialização e intervalos
document.addEventListener('DOMContentLoaded', () => {
  window.scrollTo(0, 0); // Garante que a página inicie no topo ao carregar/recarregar
  initializeData();
  loadCustomColors();
  loadData(); 
  applyTheme(); 
  reorderSectionsByTime(); 
  updateHighlights(); 
  updateTimeCounter(); 
  updateClock(); 
  initZoom(); 
  initScrollToNow();
  initScrollEffect();
  initDragAndDrop();
  updateAriaStatus(); 
  updateStatusBar(); // Chama sem célula para exibir apenas a versão/data inicialmente
  fetchGitHubUpdateInfo(); // Busca dados reais do GitHub

  // Atualiza a data no cabeçalho de impressão
  window.addEventListener('beforeprint', () => {
    const dateEl = document.getElementById('print-date');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleString('pt-BR');
    }

    // Preenche a legenda de professores para a impressão
    const legendEl = document.getElementById('print-footer-legend');
    if (legendEl) {
      const map = getTeacherMap();
      const items = Object.entries(map)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([sigla, nome]) => `
          <div class="print-legend-item">
            <span class="print-legend-sigla">${sigla}:</span>
            <span class="print-legend-nome">${nome}</span>
          </div>
        `).join('');
      
      legendEl.innerHTML = `
        <h3>Legenda de Professores e Turmas</h3>
        <div class="print-legend-grid">${items}</div>
      `;
    }
  });

  if (localStorage.getItem('school_compact_mode') === 'true') {
    document.body.classList.add('compact-mode');
  }

  // Listener para busca com debounce
  const searchInput = _dom.searchInput();
  if (searchInput) {
    searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));

    // Atalho: Enter seleciona a primeira sugestão se o menu estiver aberto
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const suggestions = _dom.searchSuggestions();
        if (suggestions && suggestions.classList.contains('active')) {
          const firstItem = suggestions.querySelector('.suggestion-item');
          if (firstItem) {
            e.preventDefault(); // Evita outros comportamentos do Enter
            firstItem.click();  // Aciona a função selectSuggestion vinculada ao item
          }
        }
      }
    });

    // Fecha sugestões ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) 
        _dom.searchSuggestions().classList.remove('active');
    });
  }

  // Listeners para Seleção Múltipla
  const wrapper = document.getElementById('schedule-wrapper');
  if (wrapper) {
    wrapper.addEventListener('mousedown', handleMouseDown);
    wrapper.addEventListener('mouseover', handleMouseEnter);
    document.addEventListener('mouseup', () => {
      _isSelecting = false;
    });
  }
});

// Error boundary global
window.addEventListener('error', (e) => {
  showToast('Erro na página: ' + e.message, 'error');
  console.error(e);
});

setInterval(updateHighlights, 10000); // Atualiza a cada 10 segundos para maior precisão
setInterval(() => {
  updateTimeCounter();
  updateClock();
}, 1000); // Atualiza o contador de tempo e o relógio a cada 1 segundo

window.addEventListener('load', () => {
  const dayFilterSelect = _dom.dayFilter();

  // Obtém o dia da semana atual (1 para Segunda, 5 para Sexta). 0 e 6 são Domingo/Sábado.
  const today = new Date().getDay();
  
  // Define o dia inicial: Se for dia de semana (1-5), seleciona hoje. 
  // Caso contrário (fim de semana), usa o filtro salvo anteriormente ou "0" (Todos).
  const initialDay = (today >= 1 && today <= 5) 
    ? today.toString() 
    : (localStorage.getItem(CONFIG.FILTER_DAY_KEY) || "0");

  if (dayFilterSelect) {
    dayFilterSelect.value = initialDay;
    dayFilterSelect.addEventListener('change', (e) => {
      filterByDay(parseInt(e.target.value));
    });
  }

  filterByDay(parseInt(initialDay));
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
  if (!sigla || !nome) return showToast("Preencha sigla e nome.", "error");

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

/**
 * Abre o modal de atalhos de teclado.
 */
function openShortcutsModal() {
  const shortcuts = [
    { key: 'Enter / ↓', desc: 'Ir para a aula de baixo' },
    { key: '↑', desc: 'Ir para a aula de cima' },
    { key: '← / →', desc: 'Navegação horizontal' },
    { key: 'Ctrl + D', desc: 'Copiar aula de cima (Fill Down)' },
    { key: 'Ctrl + C / V', desc: 'Copiar e colar conteúdo' },
    { key: 'Ctrl + Z / Y', desc: 'Desfazer e Refazer' }
  ];

  const overlay = Object.assign(document.createElement('div'), { className: 'modal-overlay' });
  overlay.style.display = 'flex';

  const modal = Object.assign(document.createElement('div'), { className: 'modal' });
  const title = Object.assign(document.createElement('h2'), { textContent: '⌨️ Atalhos de Teclado' });
  
  const list = Object.assign(document.createElement('div'), { className: 'shortcut-list' });
  
  shortcuts.forEach(s => {
    const item = Object.assign(document.createElement('div'), { className: 'shortcut-item' });
    item.innerHTML = `<span class="shortcut-desc">${s.desc}</span><span class="shortcut-key">${s.key}</span>`;
    list.appendChild(item);
  });

  const footer = Object.assign(document.createElement('div'), { className: 'modal-footer' });
  const closeBtn = Object.assign(document.createElement('button'), { 
    className: 'btn btn-primary', 
    textContent: 'Entendido',
    onclick: () => overlay.remove() 
  });

  footer.appendChild(closeBtn);
  modal.append(title, list, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setupFocusTrap(overlay);
}

/**
 * Carrega e aplica as cores personalizadas do localStorage.
 */
function loadCustomColors() {
  const savedColors = JSON.parse(localStorage.getItem(CONFIG.COLORS_KEY) || '{}');
  Object.entries(savedColors).forEach(([category, color]) => {
    document.documentElement.style.setProperty(`--${category}-color`, color);
  });
}

/**
 * Abre o modal para personalização de cores das categorias.
 */
function openSettingsModal() {
  const categories = [
    { id: 'hl', label: 'HL (Livre/HTPC)', default: '#f1f5f9' },
    { id: 'pd', label: 'PD (Plantão)', default: '#bae6fd' },
    { id: 'el', label: 'EL (Elefante)', default: '#d1fae5' },
    { id: 'mtf', label: 'MTF (Matific)', default: '#ffedd5' }
  ];

  const savedColors = JSON.parse(localStorage.getItem(CONFIG.COLORS_KEY) || '{}');
  const overlay = Object.assign(document.createElement('div'), { className: 'modal-overlay' });
  overlay.style.display = 'flex';

  const modal = Object.assign(document.createElement('div'), { className: 'modal' });
  const title = Object.assign(document.createElement('h2'), { textContent: '🎨 Personalizar Cores' });
  const container = Object.assign(document.createElement('div'), { className: 'teacher-list-container' });

  categories.forEach(cat => {
    const currentVal = savedColors[cat.id] || getComputedStyle(document.documentElement).getPropertyValue(`--${cat.id}-color`).trim() || cat.default;
    
    const item = Object.assign(document.createElement('div'), { className: 'color-setting-item' });
    item.innerHTML = `
      <span>${cat.label}</span>
      <div class="color-input-wrapper">
        <input type="color" id="color-${cat.id}" value="${currentVal.length === 4 ? expandHex(currentVal) : currentVal}">
      </div>
    `;
    container.appendChild(item);
  });

  const footer = Object.assign(document.createElement('div'), { className: 'modal-footer' });
  
  const btnReset = Object.assign(document.createElement('button'), { 
    className: 'btn', textContent: 'Restaurar Padrões', 
    onclick: () => {
      if(confirm("Deseja voltar para as cores originais?")) {
        localStorage.removeItem(CONFIG.COLORS_KEY);
        window.location.reload();
      }
    }
  });

  const btnSave = Object.assign(document.createElement('button'), { 
    className: 'btn btn-success', textContent: 'Salvar Cores',
    onclick: () => {
      const newColors = {};
      categories.forEach(cat => {
        const val = document.getElementById(`color-${cat.id}`).value;
        newColors[cat.id] = val;
        document.documentElement.style.setProperty(`--${cat.id}-color`, val);
      });
      localStorage.setItem(CONFIG.COLORS_KEY, JSON.stringify(newColors));
      showToast("Cores atualizadas!", "success");
      overlay.remove();
    }
  });

  footer.append(btnReset, btnSave);
  modal.append(title, container, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setupFocusTrap(overlay);
}

/**
 * Expande hexadecimais curtos (#ABC para #AABBCC) para compatibilidade com input color.
 */
function expandHex(hex) {
  if (hex.length !== 4) return hex;
  return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
}

/**
 * Cria um snapshot (ponto de restauração) do estado atual dos horários.
 * Mantém apenas os últimos 5 backups no localStorage.
 */
function createSnapshot() {
  const currentData = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (!currentData) return;

  let history = JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]');
  
  // Evita criar snapshots idênticos seguidos
  if (history.length > 0 && history[0].data === currentData) return;

  const newSnapshot = {
    id: Date.now(),
    timestamp: new Date().toLocaleString('pt-BR'),
    data: currentData
  };

  history.unshift(newSnapshot);
  if (history.length > 5) history.pop(); // Limita a 5 itens

  localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(history));
}

/**
 * Restaura o sistema para um ponto de backup específico.
 * @param {number} snapshotId - ID (timestamp) do backup.
 */
function restoreSnapshot(snapshotId) {
  const history = JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]');
  const snapshot = history.find(s => s.id === snapshotId);

  if (snapshot && confirm(`Deseja restaurar o backup de ${snapshot.timestamp}? Isso substituirá o horário atual.`)) {
    localStorage.setItem(CONFIG.STORAGE_KEY, snapshot.data);
    showToast("Backup restaurado com sucesso!", "success");
    setTimeout(() => window.location.reload(), 1000);
  }
}

/**
 * Abre o modal para visualização e restauração de backups automáticos.
 */
function showBackupHistoryModal() {
  const history = JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]');
  
  const overlay = Object.assign(document.createElement('div'), { className: 'modal-overlay' });
  overlay.style.display = 'flex';

  const modal = Object.assign(document.createElement('div'), { className: 'modal' });
  const title = Object.assign(document.createElement('h2'), { textContent: '📦 Histórico de Backups Automáticos' });
  
  const container = Object.assign(document.createElement('div'), { className: 'teacher-list-container' });

  if (history.length === 0) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhum backup encontrado ainda.</p>';
  } else {
    container.innerHTML = history.map(s => `
      <div class="backup-item">
        <div>
          <div class="backup-date">${s.timestamp}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Backup automático do sistema</div>
        </div>
        <button class="btn btn-primary" style="padding: 4px 10px;" onclick="restoreSnapshot(${s.id})">Restaurar</button>
      </div>
    `).join('');
  }

  const footer = Object.assign(document.createElement('div'), { className: 'modal-footer' });
  footer.append(Object.assign(document.createElement('button'), { 
    className: 'btn', textContent: 'Fechar', onclick: () => overlay.remove() 
  }));

  modal.append(title, container, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setupFocusTrap(overlay);
}

/**
 * Calcula a carga horária total de cada professor/turma.
 * @returns {Object} Objeto com contagem de aulas.
 */
function calculateWorkload() {
  const counts = {};
  _dom.cells().forEach(cell => {
    const text = cell.textContent.trim().toUpperCase();
    if (text && text !== '*') {
      counts[text] = (counts[text] || 0) + 1;
    }
  });
  return counts;
}

/**
 * Abre um modal exibindo a carga horária resumida de todos os professores/turmas.
 */
function showWorkloadModal() {
  const workload = calculateWorkload();
  const teacherMap = getTeacherMap();

  // Define um teto para a barra de progresso (ex: 25 aulas na semana é 100%)
  const maxBaseline = Math.max(...Object.values(workload), 25);

  const overlay = Object.assign(document.createElement('div'), { className: 'modal-overlay' });
  overlay.style.display = 'flex';

  const modal = Object.assign(document.createElement('div'), { className: 'modal' });
  const title = Object.assign(document.createElement('h2'), { textContent: '📊 Resumo de Carga Horária' });
  
  const container = Object.assign(document.createElement('div'), { className: 'teacher-list-container' });
  
  const table = document.createElement('table');
  table.className = 'workload-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Identificação</th>
        <th>Nome/Descrição</th>
        <th>Total Aulas</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(workload)
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => {
          const percent = Math.min((count / maxBaseline) * 100, 100);
          // Define a cor da barra: vermelho se > 25 aulas, caso contrário usa a cor primária
          const barColor = count > 25 ? '#ef4444' : 'var(--primary)';
          const warningClass = count > 25 ? 'workload-warning' : '';
          return `
          <tr>
            <td><strong>${key}</strong></td>
            <td>
              <div class="${warningClass}">${teacherMap[key] || '---'}</div>
              <div class="workload-progress-bg"><div class="workload-progress-fill" style="width: ${percent}%; background-color: ${barColor}"></div></div>
            </td>
            <td><strong>${count}</strong> <small>aulas</small></td>
          </tr>
        `}).join('')}
    </tbody>
  `;

  const footer = Object.assign(document.createElement('div'), { className: 'modal-footer' });
  footer.append(Object.assign(document.createElement('button'), { 
    className: 'btn btn-primary', textContent: 'Fechar', onclick: () => overlay.remove() 
  }));

  container.appendChild(table);
  modal.append(title, container, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setupFocusTrap(overlay);
}
