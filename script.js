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
  SOUND_ALERTS_KEY: 'school_sound_alerts_v1',
  DESKTOP_NOTIFY_KEY: 'school_desktop_notify_v1',
  LOCK_PASSWORD: 'qwe123', // Senha padrão para desbloquear o modo de edição
  LAST_UPDATE_DATE: '03/08/2026', // Data da última atualização do código
  LAST_UPDATE_TIME: '11:33', // Hora da última atualização do código
  GITHUB_REPO: 'educacao-tech/horario', 
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
   * Invalida o cache das células e dos períodos para forçar uma nova busca no DOM.
   */
  invalidateCache() {
    this._cellsCache = null;
    _cachedSchedulePeriods = null;
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
 * Exibe uma notificação toast moderna e elegante na tela.
 * @param {string} message - Mensagem a ser exibida.
 * @param {'success'|'error'|'warning'|'info'} type - Tipo da notificação.
 * @param {number} duration - Duração em milissegundos.
 */
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const content = document.createElement('div');
  content.className = 'toast-content';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.textContent = icons[type] || 'ℹ️';

  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-message';
  msgSpan.textContent = message;

  content.append(iconSpan, msgSpan);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close-btn';
  closeBtn.setAttribute('aria-label', 'Fechar notificação');
  closeBtn.textContent = '✖';

  const progressBar = document.createElement('div');
  progressBar.className = 'toast-progress';
  progressBar.style.animationDuration = `${duration}ms`;

  toast.append(content, closeBtn, progressBar);
  container.appendChild(toast);

  let isRemoved = false;
  const removeToast = () => {
    if (isRemoved) return;
    isRemoved = true;
    toast.style.animation = 'toast-out 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => toast.remove(), 250);
  };

  closeBtn.onclick = removeToast;
  const timeoutId = setTimeout(removeToast, duration);

  toast.addEventListener('mouseenter', () => {
    progressBar.style.animationPlayState = 'paused';
    clearTimeout(timeoutId);
  });
  toast.addEventListener('mouseleave', () => {
    progressBar.style.animationPlayState = 'running';
    setTimeout(removeToast, 1200);
  });
}

/**
 * Exibe um diálogo modal de confirmação moderno no lugar do confirm() nativo.
 * @param {Object} options
 * @param {string} options.title - Título do modal.
 * @param {string} options.message - Mensagem explicativa.
 * @param {string} [options.icon] - Ícone temático.
 * @param {string} [options.confirmText] - Texto do botão de confirmação.
 * @param {string} [options.cancelText] - Texto do botão de cancelamento.
 * @param {'primary'|'danger'|'success'} [options.confirmType] - Estilo do botão.
 * @param {Function} options.onConfirm - Callback executado ao confirmar.
 * @param {Function} [options.onCancel] - Callback executado ao cancelar.
 */
function showConfirmDialog({
  title = 'Confirmação',
  message = 'Deseja continuar com esta ação?',
  icon = '❓',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmType = 'primary',
  onConfirm = () => {},
  onCancel = () => {}
}) {
  const overlay = Object.assign(document.createElement('div'), { className: 'dialog-overlay' });
  
  const card = Object.assign(document.createElement('div'), { className: 'dialog-card', role: 'dialog' });
  card.setAttribute('aria-modal', 'true');

  const header = Object.assign(document.createElement('div'), { className: 'dialog-header' });
  const iconEl = Object.assign(document.createElement('span'), { className: 'dialog-icon', textContent: icon });
  const titleEl = Object.assign(document.createElement('h3'), { className: 'dialog-title', textContent: title });
  header.append(iconEl, titleEl);

  const bodyEl = Object.assign(document.createElement('div'), { className: 'dialog-body', textContent: message });

  const actions = Object.assign(document.createElement('div'), { className: 'dialog-actions' });
  
  const btnCancel = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'btn',
    textContent: cancelText,
    onclick: () => {
      overlay.remove();
      if (typeof onCancel === 'function') onCancel();
    }
  });

  const btnClass = confirmType === 'danger' ? 'btn-danger' : (confirmType === 'success' ? 'btn-success' : 'btn-primary');
  const btnConfirm = Object.assign(document.createElement('button'), {
    type: 'button',
    className: `btn ${btnClass}`,
    textContent: confirmText,
    onclick: () => {
      overlay.remove();
      if (typeof onConfirm === 'function') onConfirm();
    }
  });

  actions.append(btnCancel, btnConfirm);
  card.append(header, bodyEl, actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  setupFocusTrap(overlay);
  setTimeout(() => btnConfirm.focus(), 50);
}

/**
 * Exibe um diálogo modal de prompt moderno no lugar do prompt() nativo.
 * @param {Object} options
 * @param {string} options.title - Título do prompt.
 * @param {string} options.message - Descrição ou instrução.
 * @param {string} [options.icon] - Ícone temático.
 * @param {string} [options.placeholder] - Placeholder do input.
 * @param {string} [options.defaultValue] - Valor inicial.
 * @param {'text'|'password'} [options.inputType] - Tipo de campo.
 * @param {string} [options.confirmText] - Texto do botão de confirmar.
 * @param {string} [options.cancelText] - Texto do botão de cancelar.
 * @param {Function} options.onConfirm - Callback recebendo o valor digitado.
 * @param {Function} [options.onCancel] - Callback executado ao cancelar.
 */
function showPromptDialog({
  title = 'Entrada de Dados',
  message = 'Digite a informação solicitada:',
  icon = '🔒',
  placeholder = '',
  defaultValue = '',
  inputType = 'text',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm = () => {},
  onCancel = () => {}
}) {
  const overlay = Object.assign(document.createElement('div'), { className: 'dialog-overlay' });
  
  const card = Object.assign(document.createElement('div'), { className: 'dialog-card', role: 'dialog' });
  card.setAttribute('aria-modal', 'true');

  const header = Object.assign(document.createElement('div'), { className: 'dialog-header' });
  const iconEl = Object.assign(document.createElement('span'), { className: 'dialog-icon', textContent: icon });
  const titleEl = Object.assign(document.createElement('h3'), { className: 'dialog-title', textContent: title });
  header.append(iconEl, titleEl);

  const bodyEl = Object.assign(document.createElement('div'), { className: 'dialog-body', textContent: message });

  const inputEl = Object.assign(document.createElement('input'), {
    type: inputType,
    className: 'dialog-input',
    placeholder: placeholder,
    value: defaultValue
  });

  const actions = Object.assign(document.createElement('div'), { className: 'dialog-actions' });
  
  const btnCancel = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'btn',
    textContent: cancelText,
    onclick: () => {
      overlay.remove();
      if (typeof onCancel === 'function') onCancel();
    }
  });

  const btnConfirm = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'btn btn-primary',
    textContent: confirmText,
    onclick: () => {
      const val = inputEl.value;
      overlay.remove();
      if (typeof onConfirm === 'function') onConfirm(val);
    }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnConfirm.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      btnCancel.click();
    }
  });

  actions.append(btnCancel, btnConfirm);
  card.append(header, bodyEl, inputEl, actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  setupFocusTrap(overlay);
  setTimeout(() => inputEl.focus(), 50);
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

let _currentConflictIndex = -1;

/**
 * Navega para o próximo conflito na tabela, centralizando na tela e aplicando destaque pulsante.
 */
function navigateToNextConflict() {
  const conflicts = Array.from(document.getElementsByClassName('conflict-error'));
  if (conflicts.length === 0) {
    return showToast("Nenhum conflito de horário ativo!", "success");
  }

  _currentConflictIndex = (_currentConflictIndex + 1) % conflicts.length;
  const targetCell = conflicts[_currentConflictIndex];

  targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
  targetCell.focus();

  // Aplica o efeito pulsante
  targetCell.classList.add('conflict-highlight-pulse');
  setTimeout(() => {
    targetCell.classList.remove('conflict-highlight-pulse');
  }, 3500);

  const errorMsg = targetCell.getAttribute('title') || 'Choque de horário';
  const rowTime = targetCell.closest('tr')?.cells[0]?.innerText || '';
  showToast(`[${_currentConflictIndex + 1}/${conflicts.length}] ${rowTime}: ${errorMsg}`, "warning", 3000);
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
    _currentConflictIndex = -1;
    container.innerHTML = `
      <div id="global-conflict-badge" class="conflict-badge clean" title="Nenhum choque de horário detectado">
        ✅ Sem Conflitos
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="conflict-badge-wrapper">
      <button type="button" id="global-conflict-badge" class="conflict-badge" onclick="navigateToNextConflict()" title="Clique para navegar até o próximo conflito">
        ⚠️ ${total} Conflito${total > 1 ? 's' : ''} ➔
      </button>
      <button type="button" class="btn" style="padding: 4px 8px; height: 32px; background: var(--bg-card); font-size: 0.8rem;" onclick="showConflictInspector()" title="Abrir lista de todos os conflitos">
        🔍 Lista
      </button>
    </div>
  `;
}

/**
 * Abre um inspetor detalhado de todos os conflitos atuais.
 */
function showConflictInspector() {
  const conflicts = Array.from(document.getElementsByClassName('conflict-error'));
  if (conflicts.length === 0) {
    return showToast("Nenhum conflito detectado no momento!", "success");
  }

  const overlay = Object.assign(document.createElement('div'), { className: 'modal-overlay' });
  overlay.style.display = 'flex';

  const modal = Object.assign(document.createElement('div'), { className: 'modal' });
  modal.innerHTML = `
    <h2>🔍 Inspetor de Conflitos</h2>
    <p>Foram detectados <strong>${conflicts.length}</strong> choques de horário na grade:</p>
    <div class="teacher-list-container">
      ${conflicts.map((c, idx) => {
        const time = c.closest('tr')?.cells[0]?.innerText || 'Horário';
        const period = c.closest('div[id^="section-"]')?.id === 'section-morning' ? 'Manhã' : 'Tarde';
        return `
          <div class="backup-item" style="cursor:pointer" onclick="document.querySelectorAll('.modal-overlay').forEach(m=>m.remove()); const el = document.getElementsByClassName('conflict-error')[${idx}]; if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('conflict-highlight-pulse'); setTimeout(()=>el.classList.remove('conflict-highlight-pulse'), 3500); el.focus(); }">
            <div>
              <strong>${c.innerText.trim() || 'Célula'}</strong> às ${time} (${period})
              <div style="font-size:0.8rem; color:var(--text-muted)">${c.title || 'Conflito de agendamento'}</div>
            </div>
            <span style="font-size:1.2rem">📍 Ir</span>
          </div>
        `;
      }).join('')}
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
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
    showCellAutocomplete(e.target);
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
    setTimeout(() => hideCellAutocomplete(), 200);
  }
});

document.addEventListener('keydown', (e) => {
  const cell = e.target;
  // Verifica se o alvo é um elemento válido
  if (!cell || typeof cell.getAttribute !== 'function') return;

  const isEditable = cell.getAttribute('contenteditable') === 'true';
  if (!isEditable) return;

  // Interceptar teclas se o popup de autocompletar estiver visível
  if (_cellAutocompleteEl && _cellAutocompleteEl.style.display !== 'none' && _activeAutocompleteCell === cell) {
    const items = _cellAutocompleteEl.querySelectorAll('.cell-autocomplete-item');
    if (e.key === 'ArrowDown' && items.length > 0) {
      e.preventDefault();
      _selectedAutocompleteIdx = (_selectedAutocompleteIdx + 1) % items.length;
      items.forEach((it, i) => it.classList.toggle('active', i === _selectedAutocompleteIdx));
      items[_selectedAutocompleteIdx]?.scrollIntoView({ block: 'nearest' });
      return;
    } else if (e.key === 'ArrowUp' && items.length > 0) {
      e.preventDefault();
      _selectedAutocompleteIdx = (_selectedAutocompleteIdx - 1 + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('active', i === _selectedAutocompleteIdx));
      items[_selectedAutocompleteIdx]?.scrollIntoView({ block: 'nearest' });
      return;
    } else if ((e.key === 'Enter' || e.key === 'Tab') && _selectedAutocompleteIdx >= 0 && items[_selectedAutocompleteIdx]) {
      e.preventDefault();
      const code = items[_selectedAutocompleteIdx].getAttribute('data-code');
      applyAutocompleteOption(code);
      return;
    } else if (e.key === 'Escape') {
      hideCellAutocomplete();
      return;
    }
  }

  // Atalho para focar busca (/)
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && !isEditable) {
    e.preventDefault();
    _dom.searchInput()?.focus();
  }

  // Atalho para limpar seleção (Esc)
  if (e.key === 'Escape') {
    clearMultiSelection();
    hideCellAutocomplete();
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

  const daySelect = _dom.dayFilter();
  if (daySelect && daySelect.value !== selectedDay.toString()) {
    daySelect.value = selectedDay.toString();
  }

  if (document.body.classList.contains('view-cards')) {
    renderCardsView();
  }

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
 * Alterna entre a visualização padrão em Tabela e a visualização em Cards Verticais.
 */
function toggleViewMode() {
  const isCards = document.body.classList.toggle('view-cards');
  localStorage.setItem('school_view_mode', isCards ? 'cards' : 'table');

  const btn = document.getElementById('view-mode-btn');
  if (btn) {
    btn.innerHTML = isCards ? '📊 Modo Tabela' : '📱 Modo Cards (Mobile)';
  }

  if (isCards) {
    renderCardsView();
    showToast("Visualização em Cards ativada!", "info");
  } else {
    showToast("Visualização em Tabela ativada!", "info");
  }
}

/**
 * Aplica estilos dinâmicos de categoria aos editores dos cards.
 */
function applyDynamicStylesToEditor(editor, text) {
  const upper = text.toUpperCase();
  editor.classList.remove('hl', 'pd', 'el', 'mtf');
  if (upper === 'HL' || upper === 'HTPC') editor.classList.add('hl');
  else if (upper === 'PD') editor.classList.add('pd');
  else if (upper === 'EL') editor.classList.add('el');
  else if (upper === 'MTF') editor.classList.add('mtf');
}

/**
 * Renderiza a grade em formato de Cards Verticais para dispositivos móveis.
 */
function renderCardsView() {
  const wrapper = document.getElementById('cards-view-wrapper');
  if (!wrapper) return;

  const currentDay = parseInt(localStorage.getItem(CONFIG.FILTER_DAY_KEY) || '0');
  const dayNames = ['', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

  // Se estiver em "Todos os dias" no modo cards, exibe o dia de hoje ou Segunda por padrão
  const activeDay = (currentDay === 0) 
    ? (new Date().getDay() >= 1 && new Date().getDay() <= 5 ? new Date().getDay() : 1) 
    : currentDay;
  const dayName = dayNames[activeDay] || 'Segunda-feira';

  wrapper.innerHTML = '';

  const sections = [
    { id: 'section-morning', title: '☀️ Horário da Manhã', layout: CONFIG.LAYOUTS.morning },
    { id: 'section-afternoon', title: '🌤️ Horário da Tarde', layout: CONFIG.LAYOUTS.afternoon }
  ];

  sections.forEach(sec => {
    const secEl = document.getElementById(sec.id);
    if (!secEl) return;
    const table = secEl.querySelector('table');
    if (!table) return;

    const group = document.createElement('div');
    group.className = 'card-section-group';

    const header = document.createElement('div');
    header.className = 'card-section-header';
    header.innerHTML = `
      <h2>${sec.title}</h2>
      <span class="card-day-title-badge">${dayName}</span>
    `;
    group.appendChild(header);

    const layout = sec.layout;
    let colStart = 1;
    for (let d = 0; d < activeDay - 1; d++) {
      colStart += layout[d];
    }
    const colsInActiveDay = layout[activeDay - 1];

    for (let r = 2; r < table.rows.length; r++) {
      const row = table.rows[r];
      const isRecreio = row.classList.contains('recreio');
      const isCurrentActive = row.classList.contains('current-active');

      const card = document.createElement('div');
      card.className = `schedule-card ${isRecreio ? 'card-recreio' : ''} ${isCurrentActive ? 'current-active' : ''}`;

      if (isRecreio) {
        card.innerHTML = `
          <div class="card-recreio-text">
            🥪 ${row.textContent.trim()}
          </div>
        `;
      } else {
        const timeText = row.cells[0]?.textContent.trim() || '';
        const timeRow = document.createElement('div');
        timeRow.className = 'card-time-row';
        timeRow.innerHTML = `
          <div class="card-time-badge">⏰ ${timeText}</div>
          ${isCurrentActive ? '<span class="card-status-pill">🟢 Em andamento</span>' : ''}
        `;
        card.appendChild(timeRow);

        const lessonsGrid = document.createElement('div');
        lessonsGrid.className = 'card-lessons-grid';

        for (let c = 0; c < colsInActiveDay; c++) {
          const colIndex = colStart + c;
          const targetCell = row.cells[colIndex];
          if (!targetCell) continue;

          const specialistTh = table.rows[1]?.cells[colIndex - 1];
          const specialistSigla = specialistTh?.textContent.trim() || `Espec. ${c + 1}`;
          const specialistTitle = specialistTh?.getAttribute('title') || specialistSigla;

          const cellValue = targetCell.textContent.trim();
          const chip = document.createElement('div');
          chip.className = 'card-lesson-chip';

          const chipInfo = document.createElement('div');
          chipInfo.className = 'chip-specialist-info';
          chipInfo.innerHTML = `
            <span class="chip-sigla">${specialistSigla}</span>
            <span class="chip-teacher-name" title="${specialistTitle}">${specialistTitle}</span>
          `;

          const editor = document.createElement('div');
          editor.className = 'chip-cell-editor';
          editor.contentEditable = !document.body.classList.contains('readonly');
          editor.textContent = cellValue;
          applyDynamicStylesToEditor(editor, cellValue);

          // Sincronização bidirecional
          editor.addEventListener('input', () => {
            const newVal = editor.textContent.trim().toUpperCase();
            targetCell.textContent = newVal;
            applyDynamicStyles(targetCell);
            applyDynamicStylesToEditor(editor, newVal);
            checkConflicts(targetCell);
            saveContent(getCellKey(targetCell), newVal);
          });

          chip.append(chipInfo, editor);
          lessonsGrid.appendChild(chip);
        }
        card.appendChild(lessonsGrid);
      }
      group.appendChild(card);
    }
    wrapper.appendChild(group);
  });
}

/**
 * Adiciona suporte a gestos de Swipe (arrastar para os lados) em dispositivos móveis.
 */
function initSwipeGestures() {
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Detecta swipe horizontal claro (mínimo 65px de deslocamento e não é scroll vertical)
      if (Math.abs(deltaX) > 65 && Math.abs(deltaY) < 55) {
        const currentDay = parseInt(localStorage.getItem(CONFIG.FILTER_DAY_KEY) || '0');
        if (deltaX < 0) {
          // Swipe para esquerda -> próximo dia
          const nextDay = currentDay === 0 ? 1 : (currentDay < 5 ? currentDay + 1 : 1);
          filterByDay(nextDay);
          showToast(`Avançou para ${['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'][nextDay]}`, "info", 1500);
        } else {
          // Swipe para direita -> dia anterior
          const prevDay = currentDay === 0 ? 5 : (currentDay > 1 ? currentDay - 1 : 5);
          filterByDay(prevDay);
          showToast(`Voltou para ${['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'][prevDay]}`, "info", 1500);
        }
      }
    }
  }, { passive: true });
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

// ==========================================================================
// 🎯 EFEITO DE MIRA / DESTAQUE CRUZADO (CROSSHAIR HIGHLIGHT)
// ==========================================================================

let _currentCrosshairCell = null;

/**
 * Aplica o destaque cruzado na linha e coluna da célula informada.
 * @param {HTMLElement} cell
 */
function applyCrosshairHighlight(cell) {
  if (!cell || _currentCrosshairCell === cell) return;
  _currentCrosshairCell = cell;

  const table = cell.closest('table');
  const row = cell.parentElement;
  const colIndex = cell.cellIndex;

  clearCrosshairHighlight();

  if (!table || !row || colIndex === undefined) return;

  // Destaque da linha inteira
  row.classList.add('crosshair-row');
  if (row.cells[0]) row.cells[0].classList.add('crosshair-time-cell');

  // Destaque da coluna inteira
  if (colIndex > 0) {
    const { dayIdx } = getDayAndColIndices(cell);
    if (table.rows[0] && table.rows[0].cells[dayIdx]) {
      table.rows[0].cells[dayIdx].classList.add('crosshair-day-header');
    }
    if (table.rows[1] && table.rows[1].cells[colIndex - 1]) {
      table.rows[1].cells[colIndex - 1].classList.add('crosshair-col-header');
    }
    for (let r = 2; r < table.rows.length; r++) {
      const rowItem = table.rows[r];
      if (rowItem.classList.contains('recreio')) continue;
      const targetCell = rowItem.cells[colIndex];
      if (targetCell) targetCell.classList.add('crosshair-col');
    }
  }

  cell.classList.add('crosshair-target');
}

/**
 * Remove todos os destaques de mira cruzada.
 */
function clearCrosshairHighlight() {
  document.querySelectorAll('.crosshair-row').forEach(r => r.classList.remove('crosshair-row'));
  document.querySelectorAll('.crosshair-col').forEach(c => c.classList.remove('crosshair-col'));
  document.querySelectorAll('.crosshair-time-cell').forEach(c => c.classList.remove('crosshair-time-cell'));
  document.querySelectorAll('.crosshair-day-header').forEach(h => h.classList.remove('crosshair-day-header'));
  document.querySelectorAll('.crosshair-col-header').forEach(h => h.classList.remove('crosshair-col-header'));
  document.querySelectorAll('.crosshair-target').forEach(c => c.classList.remove('crosshair-target'));
  _currentCrosshairCell = null;
}

// --- FOCUS E STATUS BAR ---
document.addEventListener('focusin', (e) => {
  const cell = e.target;
  const isEditable = cell.getAttribute('contenteditable') === 'true';
  const isReadonlyMode = document.body.classList.contains('readonly');

  if (isEditable || isReadonlyMode) {
    updateStatusBar(cell);
    highlightOccurrences(cell.innerText);
    applyCrosshairHighlight(cell);
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

  // Usa a versão compacta no status bar para nunca estourar a barra flutuante
  const barText = _gitHubShortCache || `v${CONFIG.SCHEMA_VERSION}`;
  const barTitle = _gitHubFullTitle || `Versão v${CONFIG.SCHEMA_VERSION} | Atualizado em: ${CONFIG.LAST_UPDATE_DATE}`;

  statusContent += `
    <div class="status-info-right" id="github-update-info" title="${escapeHTML(barTitle)}">${barText}</div>
  `;

  sb.innerHTML = statusContent;
}

let _gitHubShortCache = null;
let _gitHubFullTitle = null;

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
 * Atualiza a barra de status com badge compacto e o rodapé com pílulas informativas.
 */
async function fetchGitHubUpdateInfo() {
  const updateDOM = (shortText, fullTitle, footerHTML) => {
    _gitHubShortCache = shortText;
    _gitHubFullTitle = fullTitle;

    const infoRight = document.getElementById('github-update-info');
    if (infoRight) {
      infoRight.innerHTML = shortText;
      infoRight.title = fullTitle;
    }

    const footerMeta = document.querySelector('.footer-meta');
    if (footerMeta) {
      footerMeta.innerHTML = footerHTML;
    }
  };

  const defaultDateTime = `${CONFIG.LAST_UPDATE_DATE} às ${CONFIG.LAST_UPDATE_TIME}`;
  const defaultShort = `📅 Git: ${defaultDateTime}`;
  const defaultTitle = `Última atualização do sistema: ${defaultDateTime}`;
  const defaultFooter = `
    <div class="git-meta-container">
      <span class="git-badge-item">📅 ÚLTIMA ATUALIZAÇÃO GIT: <b>${defaultDateTime}</b></span>
      <span class="git-badge-item">📦 Commit: <b>v${CONFIG.SCHEMA_VERSION}</b></span>
    </div>
  `;

  // Renderiza imediatamente as informações do último Git
  updateDOM(defaultShort, defaultTitle, defaultFooter);

  if (!CONFIG.GITHUB_REPO || CONFIG.GITHUB_REPO.includes('seu-usuario-real')) {
    return;
  }

  try {
    let response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}/commits?per_page=1`);
    if (!response.ok) {
      response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}/commits/main`);
    }

    if (response && response.ok) {
      const result = await response.json();
      const commitObj = Array.isArray(result) ? result[0] : result;

      if (commitObj && commitObj.commit) {
        const rawDate = commitObj.commit.committer?.date || commitObj.commit.author?.date;
        const commitDate = rawDate ? new Date(rawDate) : new Date();
        const formattedDate = commitDate.toLocaleDateString('pt-BR');
        const formattedTime = commitDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const fullDateTime = `${formattedDate} às ${formattedTime}`;

        const sha = commitObj.sha ? commitObj.sha.substring(0, 7) : 'head';
        const fullMsg = commitObj.commit.message ? commitObj.commit.message.split('\n')[0] : 'Atualização do repositório';
        const shortMsg = fullMsg.length > 35 ? fullMsg.substring(0, 32) + '...' : fullMsg;

        const shortText = `📅 Git: ${fullDateTime}`;
        const fullTitle = `Commit (${sha}): "${fullMsg}" em ${fullDateTime}`;

        const footerHTML = `
          <div class="git-meta-container">
            <span class="git-badge-item">📅 ÚLTIMA ATUALIZAÇÃO GIT: <b>${fullDateTime}</b></span>
            <span class="git-badge-item">📦 Commit: <b>${sha}</b></span>
            <span class="git-badge-item" title="${escapeHTML(fullMsg)}">💬 <i>"${escapeHTML(shortMsg)}"</i></span>
          </div>
        `;

        updateDOM(shortText, fullTitle, footerHTML);
      }
    }
  } catch (err) {
    console.warn("fetchGitHubUpdateInfo: Mantendo data/hora locais.", err);
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
  const isReadonly = document.body.classList.contains('readonly');
  const btn = _dom.lockBtn();

  if (!isReadonly) {
    // Está editável, vai bloquear para leitura
    document.body.classList.add('readonly');
    if (btn) {
      btn.innerHTML = '🔒 Modo Leitura';
      btn.style.background = '';
    }
    showToast('Modo de leitura ativado. Edição bloqueada.', 'info');
    updateAriaStatus();
  } else {
    // Está bloqueado, pede senha para desbloquear
    showPromptDialog({
      title: 'Desbloquear Edição',
      message: 'Insira a senha de administrador para liberar a edição da grade:',
      icon: '🔐',
      placeholder: 'Digite a senha...',
      inputType: 'password',
      confirmText: 'Desbloquear',
      onConfirm: (password) => {
        if (password === CONFIG.LOCK_PASSWORD) {
          document.body.classList.remove('readonly');
          if (btn) {
            btn.innerHTML = '🔓 Modo Edição';
            btn.style.background = '#ef4444';
          }
          showToast('Modo de edição desbloqueado com sucesso!', 'success');
          updateAriaStatus();
        } else {
          document.body.classList.add('readonly');
          showToast('Senha incorreta! Acesso negado.', 'error');
        }
      }
    });
  }
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
  if (!file || (file.type !== "application/json" && !file.name.endsWith('.json'))) {
    return showToast("Por favor, selecione um arquivo .json válido.", "error");
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const backup = JSON.parse(e.target.result);
      if (!backup.schedule) throw new Error("Estrutura de backup não reconhecida.");

      showConfirmDialog({
        title: 'Restaurar Backup Completo',
        message: 'Deseja restaurar este arquivo de backup? Todos os horários, professores e configurações de cores atuais serão substituídos pelos dados do arquivo.',
        icon: '📦',
        confirmText: 'Restaurar Tudo',
        confirmType: 'danger',
        onConfirm: () => {
          localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(backup.schedule));
          if (backup.teachers) localStorage.setItem(CONFIG.TEACHER_REGISTRY_KEY, JSON.stringify(backup.teachers));
          if (backup.colors) localStorage.setItem(CONFIG.COLORS_KEY, JSON.stringify(backup.colors));
          showToast("Backup restaurado com sucesso! Recarregando...", "success");
          setTimeout(() => window.location.reload(), 1000);
        }
      });
    } catch (err) {
      showToast(`Erro ao processar backup: ${err.message}`, "error");
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
 * Limpa todos os dados de horários do sistema após confirmação dupla segura.
 */
function clearAllScheduleData() {
  showConfirmDialog({
    title: 'Apagar Todos os Horários?',
    message: 'Tem certeza que deseja apagar permanentemente todas as alterações e horários preenchidos na grade? Esta ação não pode ser desfeita.',
    icon: '⚠️',
    confirmText: 'Sim, Apagar Tudo',
    confirmType: 'danger',
    onConfirm: () => {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      showToast("Todos os horários foram redefinidos!", "success");
      setTimeout(() => window.location.reload(), 800);
    }
  });
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

let _cachedSchedulePeriods = null;

/**
 * Retorna os períodos de aula/recreio pré-processados em memória, evitando leituras repetidas do DOM.
 * @returns {Array<{start: number, end: number, type: 'aula'|'recreio'}>}
 */
function getSchedulePeriods() {
  if (_cachedSchedulePeriods) return _cachedSchedulePeriods;

  const periods = [];
  _dom.tables().forEach((table) => {
    for (let i = 2; i < table.rows.length; i++) {
      const row = table.rows[i];
      const timeCell = row.cells[0];
      if (!timeCell) continue;

      const timeText = timeCell.textContent.trim();
      const parts = timeText.split(' - ');
      let startMinutes = null, endMinutes = null;
      const isRecreio = row.classList.contains('recreio');

      if (isRecreio && parts.length >= 3) {
        startMinutes = timeToMinutes(parts[1]);
        endMinutes = timeToMinutes(parts[2]);
      } else if (parts.length === 2) {
        startMinutes = timeToMinutes(parts[0]);
        endMinutes = timeToMinutes(parts[1]);
      }

      if (startMinutes !== null && endMinutes !== null) {
        periods.push({
          start: startMinutes * 60,
          end: endMinutes * 60,
          type: isRecreio ? 'recreio' : 'aula'
        });
      }
    }
  });

  _cachedSchedulePeriods = periods;
  return periods;
}

/**
 * Formata segundos no formato HH:MM para exibição amigável.
 * @param {number} totalSeconds 
 * @returns {string}
 */
function formatSecondsToTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

// --- SISTEMA DE SINAL ESCOLAR & NOTIFICAÇÕES (WEB AUDIO API & NOTIFICATION API) ---

let _audioCtx = null;
let _lastPeriodWarningNotified = null;
let _lastPeriod30sAlert = null;
let _lastPeriodEndAlert = null;

/**
 * Obtém ou inicializa o contexto de áudio Web Audio API de forma segura.
 * @returns {AudioContext|null}
 */
function getAudioContext() {
  if (!_audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      _audioCtx = new AudioContextClass();
    }
  }
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

/**
 * Verifica se os alertas sonoros estão ativos.
 * @returns {boolean}
 */
function isSoundAlertsEnabled() {
  return localStorage.getItem(CONFIG.SOUND_ALERTS_KEY) !== 'false'; // Padrão: ativado
}

/**
 * Alterna a ativação dos alertas sonoros do sinal escolar.
 */
function toggleSoundAlerts() {
  const isEnabled = isSoundAlertsEnabled();
  const newState = !isEnabled;
  localStorage.setItem(CONFIG.SOUND_ALERTS_KEY, newState ? 'true' : 'false');
  updateSoundButtonUI();

  if (newState) {
    playSchoolChime('warning30');
    showToast("🔔 Alertas sonoros (sinal escolar) ativados!", "success");
  } else {
    showToast("🔕 Alertas sonoros desativados.", "info");
  }
}

/**
 * Atualiza o estado visual do botão de áudio na toolbar e no menu.
 */
function updateSoundButtonUI() {
  const isEnabled = isSoundAlertsEnabled();
  const toolbarBtn = document.getElementById('sound-toggle-btn');
  if (toolbarBtn) {
    toolbarBtn.innerHTML = isEnabled ? '🔔' : '🔕';
    toolbarBtn.title = isEnabled ? 'Alertas Sonoros: Ativado (Clique para desativar)' : 'Alertas Sonoros: Desativado (Clique para ativar)';
    toolbarBtn.classList.toggle('muted', !isEnabled);
  }

  const menuBtn = document.getElementById('sound-menu-item');
  if (menuBtn) {
    menuBtn.innerHTML = isEnabled ? '🔔 Alertas Sonoros: Ligado' : '🔕 Alertas Sonoros: Desligado';
  }
}

/**
 * Sintetiza e toca o sinal escolar ou o aviso de 30 segundos usando Web Audio API.
 * @param {'warning30'|'periodEnd'} type - Tipo de sinal a emitir.
 */
function playSchoolChime(type = 'periodEnd') {
  if (!isSoundAlertsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (type === 'warning30') {
    // 2 bips elegantes e suaves (A5 - 880Hz) indicando os últimos 30 segundos
    [0, 0.22].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now + delay);
      
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.12, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.18);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.2);
    });
  } else if (type === 'periodEnd') {
    // Sinal escolar clássico e harmônico de 4 notas (Dó - Mi - Sol - Dó maior: C5, E5, G5, C6)
    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.35 }, // C5
      { freq: 659.25, time: 0.32, dur: 0.35 }, // E5
      { freq: 783.99, time: 0.64, dur: 0.35 }, // G5
      { freq: 1046.50, time: 0.96, dur: 0.75 } // C6
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle'; // Timbre suave de sino/xilofone
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      gain.gain.setValueAtTime(0, now + note.time);
      gain.gain.linearRampToValueAtTime(0.18, now + note.time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.time + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.time);
      osc.stop(now + note.time + note.dur + 0.05);
    });
  }
}

/**
 * Verifica se as notificações na área de trabalho estão ativadas pelo usuário.
 * @returns {boolean}
 */
function isDesktopNotifyEnabled() {
  return localStorage.getItem(CONFIG.DESKTOP_NOTIFY_KEY) === 'true';
}

/**
 * Envia uma notificação do navegador se tiver permissão concedida.
 * @param {string} title 
 * @param {string} body 
 */
function sendDesktopNotification(title, body) {
  if (!isDesktopNotifyEnabled()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  try {
    const notification = new Notification(title, {
      body: body,
      icon: 'eaba.png',
      badge: 'eaba.png'
    });
    // Fecha automaticamente após 7 segundos
    setTimeout(() => notification.close(), 7000);
  } catch (err) {
    console.warn("Falha ao emitir notificação de desktop:", err);
  }
}

/**
 * Alterna a ativação de notificações no desktop e solicita permissão ao navegador se necessário.
 */
function toggleDesktopNotifications() {
  if (!("Notification" in window)) {
    showToast("Seu navegador não suporta notificações de área de trabalho.", "warning");
    return;
  }

  if (Notification.permission === "denied") {
    showToast("As notificações estão bloqueadas nas configurações do seu navegador.", "warning");
    return;
  }

  if (Notification.permission === "granted") {
    const currentState = isDesktopNotifyEnabled();
    const newState = !currentState;
    localStorage.setItem(CONFIG.DESKTOP_NOTIFY_KEY, newState ? 'true' : 'false');
    updateDesktopNotifyButtonUI();
    if (newState) {
      showToast("📢 Notificações na área de trabalho ativadas!", "success");
      sendDesktopNotification("Horário Escolar", "Notificações ativadas! Você receberá avisos 2 minutos antes do fim de cada aula.");
    } else {
      showToast("🔕 Notificações na área de trabalho desativadas.", "info");
    }
    return;
  }

  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      localStorage.setItem(CONFIG.DESKTOP_NOTIFY_KEY, "true");
      updateDesktopNotifyButtonUI();
      showToast("📢 Notificações no desktop ativadas com sucesso!", "success");
      sendDesktopNotification("Horário Escolar", "Notificações ativadas! Você receberá avisos 2 minutos antes do término da aula.");
    } else {
      localStorage.setItem(CONFIG.DESKTOP_NOTIFY_KEY, "false");
      updateDesktopNotifyButtonUI();
      showToast("Permissão de notificações não concedida.", "warning");
    }
  });
}

/**
 * Atualiza o texto do botão de notificações no menu.
 */
function updateDesktopNotifyButtonUI() {
  const btn = document.getElementById('desktop-notify-btn');
  if (!btn) return;
  const isEnabled = isDesktopNotifyEnabled() && ("Notification" in window) && Notification.permission === "granted";
  btn.innerHTML = isEnabled ? '📢 Notificações no Desktop: Ligado' : '🔕 Notificações no Desktop: Desligado';
}

/**
 * Gerencia o cronômetro da barra de ferramentas, identificando se o usuário está
 * em aula, no recreio ou fora do período letivo.
 */
function updateTimeCounter() {
  const now = new Date();
  const day = now.getDay();
  const currentTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const timeCounterElement = _dom.timeCounter();
  const progressBar = _dom.progressBar();

  if (day < 1 || day > 5) {
    if (timeCounterElement) {
      timeCounterElement.innerText = "Fim de semana";
      timeCounterElement.classList.remove('ending-soon', 'ending-critical');
    }
    _lastPeriodWarningNotified = null;
    _lastPeriod30sAlert = null;
    _lastPeriodEndAlert = null;
    return;
  }

  let activePeriod = null;
  let nextPeriod = null;
  let minSecondsToNext = Infinity;

  const periods = getSchedulePeriods();
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    if (currentTotalSeconds >= period.start && currentTotalSeconds < period.end) {
      activePeriod = period;
      break;
    } else if (period.start > currentTotalSeconds && (period.start - currentTotalSeconds) < minSecondsToNext) {
      minSecondsToNext = period.start - currentTotalSeconds;
      nextPeriod = period;
    }
  }

  let message = "";
  let isEndingSoon = false;
  let isEndingCritical = false;

  if (activePeriod) {
    const remainingSeconds = activePeriod.end - currentTotalSeconds;
    const elapsed = currentTotalSeconds - activePeriod.start;
    const duration = activePeriod.end - activePeriod.start;
    const percentage = duration > 0 ? (elapsed / duration) * 100 : 0;

    if (progressBar) progressBar.style.width = `${percentage}%`;

    message = activePeriod.type === 'recreio'
      ? `Recreio termina em ${formatTimeDifference(remainingSeconds)}`
      : `Termina em ${formatTimeDifference(remainingSeconds)}`;

    const periodKey = `${activePeriod.start}-${activePeriod.end}-${day}`;

    // Alerta de 2 minutos (120s): Fundo vermelho e Notificação no Desktop
    if (remainingSeconds <= 120 && remainingSeconds > 0) {
      isEndingSoon = true;
      if (_lastPeriodWarningNotified !== periodKey) {
        _lastPeriodWarningNotified = periodKey;
        const endTimeStr = formatSecondsToTime(activePeriod.end);
        sendDesktopNotification(
          activePeriod.type === 'recreio' ? "⏰ Fim do Recreio em 2 Minutos!" : "⏰ Fim da Aula em 2 Minutos!",
          activePeriod.type === 'recreio'
            ? `O recreio termina às ${endTimeStr}. Prepare-se para o retorno às salas.`
            : `A aula atual está terminando em 2 minutos (término às ${endTimeStr}).`
        );
      }
    }

    // Alerta de 30 segundos: Texto piscando e Bipe de aviso suave
    if (remainingSeconds <= 30 && remainingSeconds > 0) {
      isEndingCritical = true;
      if (_lastPeriod30sAlert !== periodKey) {
        _lastPeriod30sAlert = periodKey;
        playSchoolChime('warning30');
      }
    }

    // Fim da aula / término do período (1 segundo ou 0)
    if (remainingSeconds <= 1 && remainingSeconds >= 0) {
      if (_lastPeriodEndAlert !== periodKey) {
        _lastPeriodEndAlert = periodKey;
        playSchoolChime('periodEnd');
        sendDesktopNotification(
          activePeriod.type === 'recreio' ? "🔔 Recreio Encerrado!" : "🔔 Sinal Escolar - Fim de Aula!",
          activePeriod.type === 'recreio'
            ? "O recreio terminou. Início do próximo horário."
            : "O horário da aula terminou. Mudança de período escolar!"
        );
      }
    }
  } else if (nextPeriod) {
    if (progressBar) progressBar.style.width = '0%';
    const timeUntilNext = nextPeriod.start - currentTotalSeconds;
    message = nextPeriod.type === 'recreio'
      ? `Próximo recreio em ${formatTimeDifference(timeUntilNext)}`
      : `Próxima aula em ${formatTimeDifference(timeUntilNext)}`;
  } else {
    if (progressBar) progressBar.style.width = '0%';
    message = "Fora do horário de aula";
  }

  if (timeCounterElement) {
    if (timeCounterElement.innerText !== message) {
      timeCounterElement.innerText = message;
    }
    timeCounterElement.classList.toggle('ending-soon', isEndingSoon);
    timeCounterElement.classList.toggle('ending-critical', isEndingCritical);
  }
}

/**
 * Atualiza o relógio digital na interface com formato compacto e data no tooltip.
 */
function updateClock() {
  const clockElement = document.getElementById('current-date-time');
  if (!clockElement) return;
  const now = new Date();
  clockElement.textContent = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  clockElement.title = now.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
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
    <div style="display: flex; gap: 2px; align-items: center;">
      <button class="btn" type="button" onclick="adjustZoom(-0.1)" title="Diminuir Zoom" aria-label="Diminuir nível de zoom">-</button>
      <span id="zoom-display" style="min-width: 36px; text-align: center; font-weight: bold; font-size: 0.78rem">${Math.round(parseFloat(savedZoom) * 100)}%</span>
      <button class="btn" type="button" onclick="adjustZoom(0.1)" title="Aumentar Zoom" aria-label="Aumentar nível de zoom">+</button>
    </div>
  `;
  const toolbar = document.querySelector('.toolbar');
  if (toolbar) {
    const menuWrapper = toolbar.querySelector('.menu-dropdown-wrapper');
    if (menuWrapper) toolbar.insertBefore(zoomWrapper, menuWrapper);
    else toolbar.appendChild(zoomWrapper);
  }
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
  btn.className = 'btn btn-icon-toolbar';
  btn.style.backgroundColor = 'var(--accent)';
  btn.style.color = 'white';
  btn.style.fontWeight = '700';
  btn.style.fontSize = '0.78rem';
  btn.style.padding = '4px 8px';
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

  const zoom = toolbar.querySelector('.zoom-controls');
  const menuWrapper = toolbar.querySelector('.menu-dropdown-wrapper');
  if (zoom) toolbar.insertBefore(btn, zoom);
  else if (menuWrapper) toolbar.insertBefore(btn, menuWrapper);
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
  const btn = document.getElementById('compact-toggle-btn');
  if (btn) {
    btn.innerHTML = isCompact ? '↕️ Modo Normal' : '↔️ Modo Compacto';
  }
  showToast(isCompact ? "Modo compacto ativado (grade otimizada)" : "Modo normal ativado", "info");
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
function initApp() {
  window.scrollTo(0, 0);
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
  updateSoundButtonUI();
  updateDesktopNotifyButtonUI();
  updateAriaStatus(); 
  updateStatusBar();
  fetchGitHubUpdateInfo();

  window.addEventListener('beforeprint', () => {
    const dateEl = document.getElementById('print-date');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleString('pt-BR');
    }

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

  initSwipeGestures();

  const isCardsSaved = localStorage.getItem('school_view_mode') === 'cards';
  if (isCardsSaved) {
    document.body.classList.add('view-cards');
    const viewBtn = document.getElementById('view-mode-btn');
    if (viewBtn) viewBtn.innerHTML = '📊 Modo Tabela';
    renderCardsView();
  }

  const isCompactSaved = localStorage.getItem('school_compact_mode') === 'true';
  if (isCompactSaved) {
    document.body.classList.add('compact-mode');
    const compactBtn = document.getElementById('compact-toggle-btn');
    if (compactBtn) compactBtn.innerHTML = '↕️ Modo Normal';
  }

  const searchInput = _dom.searchInput();
  if (searchInput) {
    searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const suggestions = _dom.searchSuggestions();
        if (suggestions && suggestions.classList.contains('active')) {
          const firstItem = suggestions.querySelector('.suggestion-item');
          if (firstItem) {
            e.preventDefault();
            firstItem.click();
          }
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) 
        _dom.searchSuggestions().classList.remove('active');
    });
  }

  const wrapper = document.getElementById('schedule-wrapper');
  if (wrapper) {
    wrapper.addEventListener('mousedown', handleMouseDown);
    wrapper.addEventListener('mouseover', (e) => {
      handleMouseEnter(e);
      const cell = e.target.closest('td');
      if (cell && cell.parentElement && !cell.parentElement.classList.contains('recreio')) {
        applyCrosshairHighlight(cell);
        updateStatusBar(cell);
      }
    });
    wrapper.addEventListener('mouseleave', () => {
      clearCrosshairHighlight();
    });
    document.addEventListener('mouseup', () => {
      _isSelecting = false;
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

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
  const nome = map[sigla] || sigla;
  showConfirmDialog({
    title: 'Remover Professor?',
    message: `Deseja remover "${sigla} - ${nome}" do registro de professores?`,
    icon: '🗑️',
    confirmText: 'Remover',
    confirmType: 'danger',
    onConfirm: () => {
      delete map[sigla];
      _teacherMapCache = map; // Atualiza o cache
      localStorage.setItem(CONFIG.TEACHER_REGISTRY_KEY, JSON.stringify(map));
      renderTeacherList(map);
      refreshTableUI(); // Atualiza a tabela imediatamente
      showToast(`Professor ${sigla} removido do cadastro.`, 'info');
    }
  });
}

function saveTeacherRegistryAndReload() {
  showConfirmDialog({
    title: 'Reiniciar para Aplicar?',
    message: 'O sistema será reiniciado para consolidar as alterações nos nomes dos professores em todas as tabelas.',
    icon: '🔄',
    confirmText: 'Reiniciar Agora',
    confirmType: 'primary',
    onConfirm: () => window.location.reload()
  });
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
    type: 'button',
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

const COLOR_PRESETS = [
  {
    name: 'Padrão Moderno',
    icon: '🎨',
    colors: { hl: '#e2e8f0', pd: '#bae6fd', el: '#a7f3d0', mtf: '#fed7aa' }
  },
  {
    name: 'Alto Contraste',
    icon: '👁️',
    colors: { hl: '#cbd5e1', pd: '#38bdf8', el: '#34d399', mtf: '#fb923c' }
  },
  {
    name: 'Acessível (Daltonismo)',
    icon: '🔵',
    colors: { hl: '#e2e8f0', pd: '#60a5fa', el: '#facc15', mtf: '#c084fc' }
  },
  {
    name: 'Pastel Suave',
    icon: '🌸',
    colors: { hl: '#f1f5f9', pd: '#e0f2fe', el: '#dcfce7', mtf: '#ffedd5' }
  }
];

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
 * Abre o modal para personalização de cores das categorias com presets e live preview.
 */
function openSettingsModal() {
  const categories = [
    { id: 'hl', label: 'HL (Livre/HTPC)', default: '#e2e8f0' },
    { id: 'pd', label: 'PD (Plantão)', default: '#bae6fd' },
    { id: 'el', label: 'EL (Elefante)', default: '#a7f3d0' },
    { id: 'mtf', label: 'MTF (Matific)', default: '#fed7aa' }
  ];

  const savedColors = JSON.parse(localStorage.getItem(CONFIG.COLORS_KEY) || '{}');
  const initialColors = {};
  categories.forEach(cat => {
    initialColors[cat.id] = savedColors[cat.id] || getComputedStyle(document.documentElement).getPropertyValue(`--${cat.id}-color`).trim() || cat.default;
  });

  const overlay = Object.assign(document.createElement('div'), { className: 'modal-overlay' });
  overlay.style.display = 'flex';

  const modal = Object.assign(document.createElement('div'), { className: 'modal' });
  const title = Object.assign(document.createElement('h2'), { textContent: '🎨 Personalizar Cores & Acessibilidade' });

  // Seção de Presets
  const presetsWrapper = Object.assign(document.createElement('div'), { className: 'color-presets-wrapper' });
  const presetsTitle = Object.assign(document.createElement('div'), { className: 'color-presets-title', textContent: '⚡ Presets Rápidos & Acessibilidade' });
  const presetsGrid = Object.assign(document.createElement('div'), { className: 'color-presets-grid' });

  COLOR_PRESETS.forEach(preset => {
    const btn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: 'color-preset-btn'
    });
    btn.innerHTML = `
      <div class="preset-color-dots">
        ${Object.values(preset.colors).map(c => `<span class="preset-dot" style="background:${c}"></span>`).join('')}
      </div>
      <span>${preset.name}</span>
    `;
    btn.onclick = () => {
      Object.entries(preset.colors).forEach(([catId, color]) => {
        const input = document.getElementById(`color-${catId}`);
        if (input) input.value = expandHex(color);
        document.documentElement.style.setProperty(`--${catId}-color`, color);
      });
      showToast(`Preset "${preset.name}" aplicado!`, 'info', 2000);
    };
    presetsGrid.appendChild(btn);
  });
  presetsWrapper.append(presetsTitle, presetsGrid);

  const container = Object.assign(document.createElement('div'), { className: 'teacher-list-container' });

  categories.forEach(cat => {
    const currentVal = initialColors[cat.id];
    const item = Object.assign(document.createElement('div'), { className: 'color-setting-item' });
    item.innerHTML = `
      <span>${cat.label}</span>
      <div class="color-input-wrapper">
        <input type="color" id="color-${cat.id}" value="${currentVal.length === 4 ? expandHex(currentVal) : currentVal}">
      </div>
    `;
    const input = item.querySelector('input');
    input.addEventListener('input', (e) => {
      document.documentElement.style.setProperty(`--${cat.id}-color`, e.target.value);
    });
    container.appendChild(item);
  });

  const footer = Object.assign(document.createElement('div'), { className: 'modal-footer' });
  
  const btnReset = Object.assign(document.createElement('button'), { 
    type: 'button',
    className: 'btn',
    textContent: 'Restaurar Padrões', 
    onclick: () => {
      showConfirmDialog({
        title: 'Restaurar Cores Padrão?',
        message: 'Deseja redefinir todas as cores customizadas para os valores padrão do sistema?',
        icon: '🎨',
        confirmText: 'Restaurar',
        confirmType: 'primary',
        onConfirm: () => {
          localStorage.removeItem(CONFIG.COLORS_KEY);
          categories.forEach(cat => {
            document.documentElement.style.setProperty(`--${cat.id}-color`, cat.default);
            const input = document.getElementById(`color-${cat.id}`);
            if (input) input.value = expandHex(cat.default);
          });
          showToast("Cores restauradas para os padrões originais!", "success");
        }
      });
    }
  });

  const btnCancel = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'btn',
    textContent: 'Cancelar',
    onclick: () => {
      loadCustomColors();
      overlay.remove();
    }
  });

  const btnSave = Object.assign(document.createElement('button'), { 
    type: 'button',
    className: 'btn btn-success',
    textContent: '💾 Salvar Cores',
    onclick: () => {
      const newColors = {};
      categories.forEach(cat => {
        const val = document.getElementById(`color-${cat.id}`).value;
        newColors[cat.id] = val;
        document.documentElement.style.setProperty(`--${cat.id}-color`, val);
      });
      localStorage.setItem(CONFIG.COLORS_KEY, JSON.stringify(newColors));
      showToast("Preferências de cores salvas com sucesso!", "success");
      overlay.remove();
    }
  });

  footer.append(btnReset, btnCancel, btnSave);
  modal.append(title, presetsWrapper, container, footer);
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

  if (snapshot) {
    showConfirmDialog({
      title: 'Restaurar Backup Automático',
      message: `Deseja restaurar o backup de ${snapshot.timestamp}? Isso substituirá todas as células pelo conteúdo desse snapshot.`,
      icon: '📦',
      confirmText: 'Restaurar',
      confirmType: 'danger',
      onConfirm: () => {
        localStorage.setItem(CONFIG.STORAGE_KEY, snapshot.data);
        showToast("Backup restaurado com sucesso!", "success");
        setTimeout(() => window.location.reload(), 800);
      }
    });
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

// ==========================================================================
// ⌨️ MODAL DE ATALHOS DE TECLADO
// ==========================================================================

/**
 * Abre o modal informativo com todos os atalhos de teclado suportados.
 */
function openShortcutsModal() {
  const overlay = Object.assign(document.createElement('div'), {
    className: 'modal-overlay',
    id: 'shortcuts-modal'
  });
  overlay.style.display = 'flex';

  const modal = Object.assign(document.createElement('div'), { className: 'modal' });
  modal.style.maxWidth = '680px';

  const title = Object.assign(document.createElement('h2'), {
    innerHTML: '⌨️ Atalhos de Teclado e Produtividade'
  });

  const content = document.createElement('div');
  content.className = 'shortcuts-grid';

  const categories = [
    {
      title: '⚡ Edição Rápida',
      items: [
        { label: 'Desfazer alteração', keys: ['Ctrl', 'Z'] },
        { label: 'Refazer alteração', keys: ['Ctrl', 'Y'] },
        { label: 'Preencher para baixo (Fill Down)', keys: ['Ctrl', 'D'] },
        { label: 'Limpar célula ou seleção', keys: ['Delete'] },
        { label: 'Autocompletar inteligente', keys: ['Digitar'] }
      ]
    },
    {
      title: '📋 Área de Transferência',
      items: [
        { label: 'Copiar célula selecionada', keys: ['Ctrl', 'C'] },
        { label: 'Colar na célula atual', keys: ['Ctrl', 'V'] },
        { label: 'Colar texto puro (sanitizado)', keys: ['Automático'] }
      ]
    },
    {
      title: '🧭 Navegação na Grade',
      items: [
        { label: 'Mover para célula abaixo', keys: ['Enter', 'ou', '↓'] },
        { label: 'Mover para célula acima', keys: ['↑'] },
        { label: 'Mover para direita / esquerda', keys: ['→', '←'] },
        { label: 'Seleção em bloco', keys: ['Arrastar Mouse'] }
      ]
    },
    {
      title: '🔍 Atalhos Globais',
      items: [
        { label: 'Focar campo de pesquisa', keys: ['/'] },
        { label: 'Desmarcar seleção / Fechar', keys: ['Esc'] },
        { label: 'Navegar sugestões de busca', keys: ['Enter'] }
      ]
    }
  ];

  content.innerHTML = categories.map(cat => `
    <div class="shortcut-category-card">
      <h3 class="shortcut-category-title">${cat.title}</h3>
      <div class="shortcut-list">
        ${cat.items.map(item => `
          <div class="shortcut-row">
            <span class="shortcut-label">${item.label}</span>
            <div class="shortcut-keys">
              ${item.keys.map(k => k === 'ou' ? `<span style="font-size:0.75rem; color:var(--text-muted);">${k}</span>` : `<kbd class="kbd-key">${k}</kbd>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  const footer = Object.assign(document.createElement('div'), { className: 'modal-footer' });
  footer.append(Object.assign(document.createElement('button'), {
    className: 'btn btn-primary',
    textContent: 'Entendido',
    onclick: () => overlay.remove()
  }));

  modal.append(title, content, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setupFocusTrap(overlay);
}

// ==========================================================================
// ⚡ SISTEMA DE AUTOCOMPLETAR DE CÉLULAS
// ==========================================================================

let _cellAutocompleteEl = null;
let _activeAutocompleteCell = null;
let _selectedAutocompleteIdx = -1;

/**
 * Retorna lista de sugestões para uma célula baseado no texto digitado.
 * @param {string} filterText
 * @returns {Array<{code: string, name: string}>}
 */
function getAutocompleteOptions(filterText = '') {
  const teacherMap = getTeacherMap();
  const options = [];
  const addedCodes = new Set();
  const query = filterText.trim().toUpperCase();

  // Categorias e siglas especiais do sistema
  const specialCategories = [
    { code: 'HL', name: 'Horário Livre' },
    { code: 'PD', name: 'Plantão de Dúvidas' },
    { code: 'EL', name: 'Elefante Letrado' },
    { code: 'MTF', name: 'Matific' },
    { code: 'HTPC', name: 'HTPC Coletivo' },
    { code: 'TEATRO', name: 'Teatro / Expressão' },
    { code: '*', name: 'Célula Vazia / Janela' }
  ];

  specialCategories.forEach(item => {
    if (!query || item.code.includes(query) || item.name.toUpperCase().includes(query)) {
      options.push(item);
      addedCodes.add(item.code);
    }
  });

  // Professores e turmas mapeados
  Object.entries(teacherMap).forEach(([code, name]) => {
    if (!addedCodes.has(code)) {
      if (!query || code.toUpperCase().includes(query) || name.toUpperCase().includes(query)) {
        options.push({ code, name });
        addedCodes.add(code);
      }
    }
  });

  return options.slice(0, 8); // Limite de 8 sugestões
}

/**
 * Exibe o dropdown flutuante de autocompletar logo abaixo da célula ativa.
 * @param {HTMLElement} cell
 */
function showCellAutocomplete(cell) {
  if (document.body.classList.contains('readonly')) return;
  _activeAutocompleteCell = cell;
  const currentVal = cell.innerText.trim();
  const options = getAutocompleteOptions(currentVal);

  if (options.length === 0) {
    hideCellAutocomplete();
    return;
  }

  if (!_cellAutocompleteEl) {
    _cellAutocompleteEl = document.createElement('div');
    _cellAutocompleteEl.className = 'cell-autocomplete-popup';
    document.body.appendChild(_cellAutocompleteEl);
  }

  const rect = cell.getBoundingClientRect();
  const scrollY = window.scrollY || window.pageYOffset;
  const scrollX = window.scrollX || window.pageXOffset;

  let top = rect.bottom + scrollY + 4;
  let left = rect.left + scrollX;

  if (left + 230 > window.innerWidth) {
    left = window.innerWidth - 240;
  }
  if (rect.bottom + 230 > window.innerHeight && rect.top > 230) {
    top = rect.top + scrollY - 225;
  }

  _cellAutocompleteEl.style.top = `${top}px`;
  _cellAutocompleteEl.style.left = `${Math.max(8, left)}px`;
  _cellAutocompleteEl.style.display = 'flex';

  _selectedAutocompleteIdx = 0;
  renderAutocompleteItems(options);
}

/**
 * Renderiza os itens dentro do popup de autocompletar.
 * @param {Array<{code: string, name: string}>} options
 */
function renderAutocompleteItems(options) {
  if (!_cellAutocompleteEl) return;
  _cellAutocompleteEl.innerHTML = options.map((opt, idx) => {
    const badgeClass = opt.code.toLowerCase().replace(/[^a-z]/g, '');
    const isSelected = idx === _selectedAutocompleteIdx ? 'active' : '';
    return `
      <div class="cell-autocomplete-item ${isSelected}" data-code="${opt.code}" data-idx="${idx}">
        <span class="cell-autocomplete-badge ${badgeClass}">${opt.code}</span>
        <span class="cell-autocomplete-name">${opt.name}</span>
      </div>
    `;
  }).join('') + '<div class="cell-autocomplete-hint">Pressione Enter ou clique para aplicar</div>';

  _cellAutocompleteEl.querySelectorAll('.cell-autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      applyAutocompleteOption(item.getAttribute('data-code'));
    });
  });
}

/**
 * Aplica o código selecionado na célula ativa.
 * @param {string} code
 */
function applyAutocompleteOption(code) {
  if (!_activeAutocompleteCell) return;
  const cell = _activeAutocompleteCell;
  pushUndo(cell, cell.innerText);
  cell.innerText = code;
  applyDynamicStyles(cell);
  checkConflicts(cell);
  saveContent(getCellKey(cell), code);
  updateGlobalConflictCount();
  updateStatusBar(cell);
  createSnapshot();
  hideCellAutocomplete();
}

/**
 * Oculta o popup de autocompletar.
 */
function hideCellAutocomplete() {
  if (_cellAutocompleteEl) {
    _cellAutocompleteEl.style.display = 'none';
  }
  _activeAutocompleteCell = null;
  _selectedAutocompleteIdx = -1;
}

// Fechar autocomplete ao clicar fora
document.addEventListener('click', (e) => {
  if (!e.target.closest('.cell-autocomplete-popup') && e.target.getAttribute('contenteditable') !== 'true') {
    hideCellAutocomplete();
  }
});

// ==========================================================================
// 📋 DUPLICAR HORÁRIO DE UM DIA (COPIAR & COLAR DIA)
// ==========================================================================

/**
 * Abre o modal para duplicar toda a grade horária de um dia para outro.
 */
function openDuplicateDayModal() {
  const overlay = Object.assign(document.createElement('div'), {
    className: 'modal-overlay',
    id: 'duplicate-day-modal'
  });
  overlay.style.display = 'flex';

  const modal = Object.assign(document.createElement('div'), { className: 'modal' });
  modal.style.maxWidth = '500px';

  const title = Object.assign(document.createElement('h2'), { textContent: '📋 Duplicar Horário de um Dia' });

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">1. Dia de Origem (Copiar de):</label>
      <select id="dup-source-day" class="form-select">
        <option value="1">Segunda-feira</option>
        <option value="2">Terça-feira</option>
        <option value="3">Quarta-feira</option>
        <option value="4">Quinta-feira</option>
        <option value="5">Sexta-feira</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">2. Dia de Destino (Colar em):</label>
      <select id="dup-target-day" class="form-select">
        <option value="1">Segunda-feira</option>
        <option value="2" selected>Terça-feira</option>
        <option value="3">Quarta-feira</option>
        <option value="4">Quinta-feira</option>
        <option value="5">Sexta-feira</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">3. Período:</label>
      <select id="dup-period" class="form-select">
        <option value="all">Manhã e Tarde (Completo)</option>
        <option value="morning">Apenas Manhã</option>
        <option value="afternoon">Apenas Tarde</option>
      </select>
    </div>

    <div class="form-info-box">
      ⚠️ <b>Atenção:</b> Os horários existentes no dia de destino selecionado serão substituídos pelas aulas do dia de origem. Um ponto de restauração (backup) será criado automaticamente antes da alteração.
    </div>
  `;

  const footer = Object.assign(document.createElement('div'), { className: 'modal-footer', style: 'gap: 10px;' });
  
  const cancelBtn = Object.assign(document.createElement('button'), {
    className: 'btn',
    textContent: 'Cancelar',
    onclick: () => overlay.remove()
  });

  const confirmBtn = Object.assign(document.createElement('button'), {
    className: 'btn btn-primary',
    textContent: '📋 Duplicar Agora',
    onclick: () => {
      const srcDay = parseInt(document.getElementById('dup-source-day').value);
      const tgtDay = parseInt(document.getElementById('dup-target-day').value);
      const period = document.getElementById('dup-period').value;

      if (srcDay === tgtDay) {
        showToast("Selecione dias diferentes para origem e destino.", "error");
        return;
      }

      executeDayDuplication(srcDay, tgtDay, period);
      overlay.remove();
    }
  });

  footer.append(cancelBtn, confirmBtn);
  modal.append(title, content, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setupFocusTrap(overlay);
}

/**
 * Executa a cópia das células de um dia para outro.
 * @param {number} sourceDay - 1 a 5
 * @param {number} targetDay - 1 a 5
 * @param {string} periodChoice - 'all' | 'morning' | 'afternoon'
 */
function executeDayDuplication(sourceDay, targetDay, periodChoice) {
  const dayNames = ['', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
  let totalCopied = 0;

  const tables = [];
  if (periodChoice === 'all' || periodChoice === 'morning') {
    const morning = document.querySelector('#section-morning table');
    if (morning) tables.push({ table: morning, layout: CONFIG.LAYOUTS.morning });
  }
  if (periodChoice === 'all' || periodChoice === 'afternoon') {
    const afternoon = document.querySelector('#section-afternoon table');
    if (afternoon) tables.push({ table: afternoon, layout: CONFIG.LAYOUTS.afternoon });
  }

  createSnapshot(); // Backup preventivo

  tables.forEach(({ table, layout }) => {
    let srcOffset = 0;
    for (let i = 0; i < sourceDay - 1; i++) srcOffset += layout[i];
    const srcColCount = layout[sourceDay - 1];

    let tgtOffset = 0;
    for (let i = 0; i < targetDay - 1; i++) tgtOffset += layout[i];
    const tgtColCount = layout[targetDay - 1];

    const colsToCopy = Math.min(srcColCount, tgtColCount);
    const rows = table.rows;

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (row.classList.contains('recreio')) continue;

      for (let c = 0; c < colsToCopy; c++) {
        const srcCell = row.cells[srcOffset + c + 1];
        const tgtCell = row.cells[tgtOffset + c + 1];

        if (srcCell && tgtCell && tgtCell.getAttribute('contenteditable') === 'true') {
          const val = srcCell.innerText.trim();
          pushUndo(tgtCell, tgtCell.innerText);
          tgtCell.innerText = val;
          applyDynamicStyles(tgtCell);
          checkConflicts(tgtCell);
          saveContent(getCellKey(tgtCell), val);
          totalCopied++;
        }
      }
    }
  });

  updateGlobalConflictCount();
  createSnapshot();
  showToast(`Sucesso! ${totalCopied} horários copiados de ${dayNames[sourceDay]} para ${dayNames[targetDay]}.`, "success");
}

// ==========================================================================
// 📅 EXPORTAÇÃO PARA CALENDÁRIO (.ICS / ICALENDAR)
// ==========================================================================

/**
 * Abre o modal de exportação para calendário compatível com Google Calendar, Outlook e Apple Calendar.
 */
function openExportICSModal() {
  const teacherMap = getTeacherMap();
  const overlay = Object.assign(document.createElement('div'), {
    className: 'modal-overlay',
    id: 'export-ics-modal'
  });
  overlay.style.display = 'flex';

  const modal = Object.assign(document.createElement('div'), { className: 'modal' });
  modal.style.maxWidth = '550px';

  const title = Object.assign(document.createElement('h2'), { textContent: '📅 Exportar para Calendário (.ics)' });

  const currentYear = 2026;
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Filtrar Aulas para Exportação:</label>
      <select id="ics-filter-type" class="form-select" onchange="document.getElementById('ics-teacher-group').style.display = this.value === 'specific' ? 'block' : 'none'">
        <option value="all">Todas as Aulas e Professores</option>
        <option value="specific">Professor / Turma Específico</option>
      </select>
    </div>

    <div class="form-group" id="ics-teacher-group" style="display: none;">
      <label class="form-label">Selecione o Professor / Sigla:</label>
      <select id="ics-teacher-select" class="form-select">
        ${Object.entries(teacherMap).sort((a, b) => a[0].localeCompare(b[0])).map(([sigla, nome]) => `
          <option value="${sigla}">${sigla} - ${nome}</option>
        `).join('')}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Data de Início do Período Letivo:</label>
      <input type="date" id="ics-start-date" class="form-input" value="${currentYear}-02-02">
    </div>

    <div class="form-group">
      <label class="form-label">Data de Término do Período Letivo:</label>
      <input type="date" id="ics-end-date" class="form-input" value="${currentYear}-12-18">
    </div>

    <div class="form-info-box">
      ℹ️ O arquivo <b>.ics</b> gerado cria eventos semanais recorrentes em seu calendário para cada aula, com horários de início e término exatos da escola.
    </div>
  `;

  const footer = Object.assign(document.createElement('div'), { className: 'modal-footer', style: 'gap: 10px;' });
  
  const cancelBtn = Object.assign(document.createElement('button'), {
    className: 'btn',
    textContent: 'Cancelar',
    onclick: () => overlay.remove()
  });

  const exportBtn = Object.assign(document.createElement('button'), {
    className: 'btn btn-primary',
    textContent: '📥 Baixar Arquivo .ics',
    onclick: () => {
      const filterType = document.getElementById('ics-filter-type').value;
      const targetTeacher = filterType === 'specific' ? document.getElementById('ics-teacher-select').value : null;
      const startDate = document.getElementById('ics-start-date').value;
      const endDate = document.getElementById('ics-end-date').value;

      if (!startDate || !endDate) {
        showToast("Informe as datas de início e término.", "error");
        return;
      }

      generateAndDownloadICS(targetTeacher, startDate, endDate);
      overlay.remove();
    }
  });

  footer.append(cancelBtn, exportBtn);
  modal.append(title, content, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setupFocusTrap(overlay);
}

/**
 * Gera o arquivo iCalendar (.ics) e inicia o download no navegador.
 * @param {string|null} targetTeacher
 * @param {string} startDateStr
 * @param {string} endDateStr
 */
function generateAndDownloadICS(targetTeacher, startDateStr, endDateStr) {
  const teacherMap = getTeacherMap();
  const dayRRuleMap = ['', 'MO', 'TU', 'WE', 'TH', 'FR'];
  
  const events = [];
  const tables = [
    { el: document.querySelector('#section-morning table'), layout: CONFIG.LAYOUTS.morning, periodName: 'Manhã' },
    { el: document.querySelector('#section-afternoon table'), layout: CONFIG.LAYOUTS.afternoon, periodName: 'Tarde' }
  ];

  tables.forEach(({ el: table, layout, periodName }) => {
    if (!table) return;
    const rows = table.rows;

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (row.classList.contains('recreio')) continue;

      const timeText = row.cells[0]?.textContent.trim();
      if (!timeText) continue;

      const parts = timeText.split(' - ');
      if (parts.length < 2) continue;

      const startMin = timeToMinutes(parts[0]);
      const endMin = timeToMinutes(parts[1]);
      if (startMin === null || endMin === null) continue;

      let colOffset = 0;
      layout.forEach((colsInDay, dayIdx) => {
        const dayNum = dayIdx + 1; // 1 = Seg, 5 = Sex
        for (let c = 0; c < colsInDay; c++) {
          const specHeader = table.rows[1].cells[colOffset + c]?.textContent.trim();
          const cell = row.cells[colOffset + c + 1];
          if (!cell) continue;

          const cellText = cell.textContent.trim();
          if (!cellText || cellText === '*' || cellText === 'HL') continue;

          if (targetTeacher) {
            const matchesCode = cellText.toUpperCase() === targetTeacher.toUpperCase() || 
                                specHeader.toUpperCase() === targetTeacher.toUpperCase();
            if (!matchesCode) continue;
          }

          const teacherDesc = teacherMap[cellText] || teacherMap[specHeader] || '';
          events.push({
            dayNum,
            dayRRule: dayRRuleMap[dayNum],
            startMin,
            endMin,
            subject: cellText,
            specialist: specHeader,
            description: teacherDesc,
            periodName
          });
        }
        colOffset += colsInDay;
      });
    }
  });

  if (events.length === 0) {
    showToast("Nenhuma aula encontrada para os filtros selecionados.", "warning");
    return;
  }

  const formatICSDate = (dateObj, minutes) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return `${y}${m}${d}T${hh}${mm}00`;
  };

  const cleanEnd = endDateStr.replace(/-/g, '') + 'T235959Z';
  const baseDate = new Date(startDateStr + 'T12:00:00');

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EMEB Anna Bonagura//Horario Escolar//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Horário Escolar 2026',
    'X-WR-TIMEZONE:America/Sao_Paulo'
  ];

  events.forEach((ev, idx) => {
    const eventDate = new Date(baseDate);
    const currentDay = eventDate.getDay();
    const diff = (ev.dayNum - currentDay + 7) % 7;
    eventDate.setDate(eventDate.getDate() + diff);

    const dtStart = formatICSDate(eventDate, ev.startMin);
    const dtEnd = formatICSDate(eventDate, ev.endMin);
    const uid = `horario-2026-${idx}-${ev.dayNum}-${ev.startMin}@bonagura`;

    icsContent.push('BEGIN:VEVENT');
    icsContent.push(`UID:${uid}`);
    icsContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    icsContent.push(`DTSTART:${dtStart}`);
    icsContent.push(`DTEND:${dtEnd}`);
    icsContent.push(`RRULE:FREQ=WEEKLY;UNTIL=${cleanEnd};BYDAY=${ev.dayRRule}`);
    icsContent.push(`SUMMARY:Aula ${ev.subject} (${ev.specialist})`);
    icsContent.push(`DESCRIPTION:Turma/Disciplina: ${ev.subject}\\nEspecialista: ${ev.specialist}\\nDetalhes: ${ev.description}\\nPeríodo: ${ev.periodName}`);
    icsContent.push('LOCATION:EMEB Prof. Anna Bonagura de Andrade');
    icsContent.push('STATUS:CONFIRMED');
    icsContent.push('END:VEVENT');
  });

  icsContent.push('END:VCALENDAR');

  const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = targetTeacher 
    ? `horario-${targetTeacher.replace(/[^a-zA-Z0-9]/g, '_')}-2026.ics` 
    : 'horario-escolar-2026.ics';
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Arquivo ${filename} gerado com ${events.length} aulas!`, "success");
}
