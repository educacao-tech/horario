const STORAGE_KEY = 'school_schedule_v1';
const cells = document.querySelectorAll('[contenteditable="true"]');

// Mapeamento de Professores (Edite aqui para vincular nomes)
const TEACHER_MAP = {
  'A(S)': 'Artes - Silvia',
  'A(M)': 'Artes - Mauro',
  'EF(M)': 'Ed. Física - Marcelo',
  'EF(P)': 'Ed. Física - Paulo',
  'CT(D)': 'Ciência e Tecnologia - Daniela',
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

const saveContent = debounce((index, text) => {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  data[index] = text;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  
  const indicator = document.getElementById('save-indicator');
  indicator.style.opacity = '1';
  setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
});

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

  // Se o texto for uma sala (ex: 1A), busca o nome da professora no mapa
  // Ignoramos siglas de especialistas para não duplicar informação na célula
  const SPECIALIST_SIGLAS = ['A(S)', 'A(M)', 'EF(M)', 'EF(P)', 'CT(D)', 'EDM(L)', 'EDM', 'EL', 'MTF', 'PI', 'PII'];
  if (teacherName && !SPECIALIST_SIGLAS.includes(text) && !SPECIALIST_SIGLAS.includes(baseCode)) {
    // Extrai apenas o primeiro nome para não ocupar muito espaço na célula
    const fullName = teacherName.split(' (')[0];
    cell.setAttribute('data-teacher', fullName);
  }
}

// Carregar dados (Estado Centralizado)
function loadData() {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  cells.forEach((cell, index) => {
    if (data[index] !== undefined) {
      cell.innerText = data[index];
      applyDynamicStyles(cell);
    }
  });
}

// Gerenciamento Centralizado de Eventos (Event Delegation)
document.addEventListener('input', (e) => {
  if (e.target.getAttribute('contenteditable') === 'true') {
    const index = Array.from(cells).indexOf(e.target);
    applyDynamicStyles(e.target);
    saveContent(index, e.target.innerText);
    
    // Atualiza a barra de status em tempo real enquanto digita
    updateStatusBar(e.target);
  }
});

function highlightOccurrences(text) {
  const cleanText = text.trim().toUpperCase();
  cells.forEach(c => {
    const cellText = c.innerText.trim().toUpperCase();
    if (cleanText && cellText === cleanText && !['*', ''].includes(cleanText)) {
      c.classList.add('match-highlight');
    } else {
      c.classList.remove('match-highlight');
    }
  });
}

document.addEventListener('focusin', (e) => {
  const cell = e.target;
  if (cell.getAttribute('contenteditable') === 'true') {
    updateStatusBar(cell);
    highlightOccurrences(cell.innerText);
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
    // Ajuste: em tabelas com a primeira coluna fixa, o índice pode variar, mas cellIndex costuma ser confiável
    const professorHeader = table.rows[1].cells[colIndex - 1]; 
    if (professorHeader) {
      const sigla = professorHeader.innerText;
      const nomeProf = TEACHER_MAP[sigla] || sigla;
      
      // Tenta encontrar o nome da regente pelo conteúdo da célula (ex: "1A")
      const SPECIALIST_SIGLAS = ['A(S)', 'A(M)', 'EF(M)', 'EF(P)', 'CT(D)', 'EDM(L)', 'EDM', 'EL', 'MTF', 'PI', 'PII'];
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

function clearData() {
  if (confirm('Isso apagará todo o conteúdo preenchido. Confirmar?')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
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

  const timeToMinutes = (str) => {
    const match = str.toLowerCase().match(/(\d+)h(\d+)?/);
    return match ? parseInt(match[1]) * 60 + parseInt(match[2] || 0) : null;
  };

  document.querySelectorAll('table').forEach((table, tIdx) => {
    // Mapeia colunas por dia (Manhã: [6,5,4,4,5] | Tarde: [5,4,4,5,4])
    const morningLayout = [6, 5, 4, 4, 5];
    const afternoonLayout = [5, 4, 4, 5, 4];
    const currentLayout = tIdx === 0 ? morningLayout : afternoonLayout;

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
reorderSectionsByTime(); // Organiza a ordem das tabelas por relevância
updateHighlights(); // Destaca o horário atual
setInterval(updateHighlights, 60000); // Atualiza a cada 1 minuto