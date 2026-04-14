const STORAGE_KEY = 'school_schedule_v1';
const THEME_KEY = 'school_schedule_theme';
const cells = document.querySelectorAll('[contenteditable="true"]');

const LAYOUTS = {
  morning: [6, 5, 4, 4, 5],
  afternoon: [5, 4, 4, 5, 4]
};

// Mapeamento de Professores (Edite aqui para vincular nomes)
const SPECIALIST_SIGLAS = ['A(S)', 'A(M)', 'EF(M)', 'EF(P)', 'CT(D)', 'EDM(L)', 'EDM', 'EL', 'MTF', 'PI', 'PII'];
const DATA_CATEGORIES = ['HL', 'HTPC', 'PD', 'EL', 'MTF'];

const TEACHER_MAP = {
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
  const section = cell.closest('[id^="section-"]');
  const rowIndex = cell.parentElement.rowIndex;
  const colIndex = cell.cellIndex;
  const time = table.rows[rowIndex].cells[0].innerText.trim();
  const specialist = table.rows[1].cells[colIndex - 1]?.innerText.trim() || colIndex;
  return `${section.id}_${time}_${specialist}`.replace(/\s+/g, '_');
}

const saveContent = debounce((key, text) => {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  data[key] = text;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  
  const indicator = document.getElementById('save-indicator');
  indicator.style.opacity = '1';
  setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
});

// Detecta se a mesma turma está em duas salas no mesmo horário
function checkConflicts(cell) {
  const text = cell.innerText.trim().toUpperCase();
  const row = cell.parentElement;
  
  // Limpa conflitos antigos na linha
  row.querySelectorAll('.conflict-error').forEach(c => c.classList.remove('conflict-error'));

  if (!text || text === '*' || SPECIALIST_SIGLAS.includes(text)) return;

  const editableInRow = Array.from(row.querySelectorAll('[contenteditable="true"]'));
  const duplicates = editableInRow.filter(c => c.innerText.trim().toUpperCase() === text);

  if (duplicates.length > 1) {
    duplicates.forEach(c => c.classList.add('conflict-error'));
  }
}

// Aplica cores baseadas no texto (HL, PD, etc)
function applyDynamicStyles(cell) {
  const text = cell.innerText.trim().toUpperCase();
  const baseCode = text.split('(')[0].trim(); // Extrai "3B" de "3B(N)"
  const teacherName = TEACHER_MAP[text] || TEACHER_MAP[baseCode];

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
    }
  });

  // Aplica as divisórias de dia iniciais
  applyStaticDayDividers();

  // Adiciona atributos de acessibilidade e labels
  cells.forEach(cell => {
    cell.setAttribute('role', 'textbox');
    cell.setAttribute('aria-multiline', 'false');
    const timeHeader = cell.closest('tr').querySelector('td:first-child')?.innerText || 'Horário desconhecido';
    const specialistHeader = cell.closest('table').rows[1].cells[cell.cellIndex - 1]?.innerText || 'Especialista desconhecido';
    cell.setAttribute('aria-label', `Célula de edição para ${specialistHeader} no horário ${timeHeader}`);
  });
}

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
      // Lógica aprimorada para destacar cabeçalhos complexos (rowspan/colspan)
      const morningLayout = [6, 5, 4, 4, 5];
      const afternoonLayout = [5, 4, 4, 5, 4];
      const layout = table.closest('#section-morning') ? morningLayout : afternoonLayout;
      
      let dayIdx = 0;
      let colSum = 0;
      for(let i = 0; i < layout.length; i++) {
        colSum += layout[i];
        if (colIndex <= colSum) {
          dayIdx = i + 1; // +1 devido à coluna "Horário"
          break;
        }
      }

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
    const teacherName = TEACHER_MAP[text] || TEACHER_MAP[baseCode];

    const colIndex = cell.cellIndex;
    const table = cell.closest('table');
    const row = cell.parentElement;

    // Destaca a linha
    document.querySelectorAll('tr').forEach(r => r.classList.remove('row-highlight'));
    row.classList.add('row-highlight');

    // Encontra o cabeçalho correto
    // Usa o índice da célula para encontrar o especialista correspondente na linha 1
    const professorHeader = table.rows[1].cells[colIndex - 1];
    if (professorHeader) {
      const sigla = professorHeader.innerText;
      const nomeProf = TEACHER_MAP[sigla] || sigla;
      
      // Tenta encontrar o nome da regente pelo conteúdo da célula (ex: "1A")
      const nomeRegente = teacherName && !SPECIALIST_SIGLAS.includes(text) && !SPECIALIST_SIGLAS.includes(baseCode) 
        ? ` | <b>Regente:</b> ${teacherName}` 
        : '';
      
      document.getElementById('statusBar').innerHTML = `
        <div class="status-item"><b>Especialista:</b> ${nomeProf}</div>
        <div class="status-item"><b>Sala/Turma:</b> ${cell.innerText || '(vazia)'}${nomeRegente}</div>
      `;

      document.querySelectorAll('th').forEach(th => th.classList.remove('header-highlight'));
      professorHeader.classList.add('header-highlight');
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
  if (isReadonlyCurrently) {
    const senha = prompt("Digite a senha para entrar no modo de edição:");
    if (senha !== 'qwe123') {
      alert("Senha incorreta!");
      return;
    }
  }
  
  const isReadonly = body.classList.toggle('readonly');
  cells.forEach(cell => {
    cell.contentEditable = !isReadonly;
  });

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
  let csv = "Periodo;Horario;Especialista;Turma\n";
  cells.forEach(cell => {
    const table = cell.closest('table');
    const section = cell.closest('[id^="section-"]').querySelector('h2').innerText;
    const time = table.rows[cell.parentElement.rowIndex].cells[0].innerText;
    const specialist = table.rows[1].cells[cell.cellIndex - 1]?.innerText || "";
    const value = cell.innerText.trim();
    
    if (value && value !== '*') {
      csv += `${section};${time};${specialist};${value}\n`;
    }
  });

  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `horario_escolar_${new Date().toLocaleDateString()}.csv`);
  link.click();
}

function exportToJson() {
  const data = localStorage.getItem(STORAGE_KEY);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `horario_escolar_${new Date().toLocaleDateString()}.json`;
  a.click();
}

function importFromJson(input) {
  const file = input.files[0];
  if (!file) return;
  
  if (!confirm('Esta ação substituirá todos os dados atuais pelo arquivo de backup. Deseja continuar?')) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      location.reload();
    } catch (err) {
      alert('Erro ao importar arquivo: Formato inválido.');
    }
  };
  reader.readAsText(file);
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
    // Mapeia colunas por dia (Manhã: [6,5,4,4,5] | Tarde: [5,4,4,5,4])
    const morningLayout = [6, 5, 4, 4, 5];
    const afternoonLayout = [5, 4, 4, 5, 4];
    // Identifica a tabela pelo contêiner pai em vez da ordem no DOM
    const currentLayout = table.closest('#section-morning') ? morningLayout : afternoonLayout;

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

    layout.forEach((colsInDay, idx) => {
      if (idx === layout.length - 1) return; // Não coloca na última coluna da tabela
      
      colOffset += colsInDay;
      // Aplica no cabeçalho de especialista
      if (specialistRow.cells[colOffset - 1]) {
        specialistRow.cells[colOffset - 1].classList.add('day-divider');
      }
      // Aplica nas células de dados
      for (let r = 2; r < table.rows.length; r++) {
        const cell = table.rows[r].cells[colOffset]; // colOffset já considera o índice correto (+1 horário)
        if (cell) cell.classList.add('day-divider');
      }
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

    // Itera pelas colunas de especialistas para encontrar correspondências
    for (let i = 0; i < specialistRow.cells.length; i++) {
      const th = specialistRow.cells[i];
      const headerText = th.innerText.trim().toUpperCase();
      const headerTitle = (th.title || "").toUpperCase();
      
      let isMatch = false;
      if (category === 'pd' && (headerText.includes('EDM(L)') || headerTitle.includes('LETÍCIA'))) isMatch = true;
      if (category === 'el' && headerText === 'EL') isMatch = true;
      if (category === 'mtf' && headerText === 'MTF') isMatch = true;

      if (isMatch) {
        th.classList.toggle('category-select', isActive);
        // Aplica o destaque em todas as células de dados desta coluna
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
cells.forEach(cell => cell.contentEditable = false); // Garante estado inicial bloqueado

setInterval(updateHighlights, 60000); // Atualiza a cada 1 minuto
setInterval(updateTimeCounter, 1000); // Atualiza o contador de tempo a cada 1 segundo