const STORAGE_KEY = 'school_schedule_v1';
const cells = document.querySelectorAll('[contenteditable="true"]');

// Mapeamento de Professores (Edite aqui para vincular nomes)
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
  'PI': 'Projeto I',
  'PII': 'Projeto II'
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
  console.log(`Célula ${index} salva.`);
});

// Carregar dados (Estado Centralizado)
function loadData() {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  cells.forEach((cell, index) => {
    if (data[index] !== undefined) cell.innerText = data[index];
  });
}

// Gerenciamento Centralizado de Eventos (Event Delegation)
document.addEventListener('input', (e) => {
  if (e.target.getAttribute('contenteditable') === 'true') {
    const index = Array.from(cells).indexOf(e.target);
    saveContent(index, e.target.innerText);
  }
});

document.addEventListener('focusin', (e) => {
  const cell = e.target;
  if (cell.getAttribute('contenteditable') === 'true') {
    const colIndex = cell.cellIndex;
    const table = cell.closest('table');
    const row = cell.parentElement;

    // Destaca a linha
    document.querySelectorAll('tr').forEach(r => r.classList.remove('row-highlight'));
    row.classList.add('row-highlight');

    // Encontra o cabeçalho correto
    const professorHeader = table.rows[1].cells[colIndex - 1];
    if (professorHeader) {
      const sigla = professorHeader.innerText;
      const nomeProf = TEACHER_MAP[sigla] || sigla;
      
      document.getElementById('statusBar').innerHTML = `
        <div class="status-item"><b>Professor(a):</b> ${nomeProf}</div>
        <div class="status-item"><b>Sala/Turma:</b> ${cell.innerText || '(vazia)'}</div>
      `;

      document.querySelectorAll('th').forEach(th => th.classList.remove('header-highlight'));
      professorHeader.classList.add('header-highlight');
    }
  }
});

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

// Inicializa e define intervalo de atualização
loadData(); // Carrega os dados salvos
updateHighlights(); // Destaca o horário atual
setInterval(updateHighlights, 60000); // Atualiza a cada 1 minuto