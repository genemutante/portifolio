// ------------------ ESTADO GLOBAL ------------------
// Proteção contra dupla declaração
if (typeof APP_VERSION === 'undefined') {
    var APP_VERSION = "2025.1";
}

const storedVersion = localStorage.getItem("appVersion");
if (storedVersion !== APP_VERSION) {
  localStorage.setItem("appVersion", APP_VERSION);
  console.warn("Versão da aplicação atualizada.");
}

const STATE = {
  role: null, // 'professor' | 'aluno'
  questions: [],
  answers: [],
  grid: null, // matriz [row][col]
  words: [], // lista de palavras posicionadas
  timer: {
    startTime: null,
    intervalId: null,
  },
  totalLetters: 0,
};

STATE.performance = {
  lastLettersCorrect: 0,
  lastWrong: 0,
  lastActionTime: Date.now()
};

STATE.feedback = {
  lastKey: null,
  lastText: ""
};

STATE.lastAction = {
  type: "inicio",
  row: null,
  col: null,
  timestamp: Date.now()
};





// Exemplo padrão
const SAMPLE_DATA = {
  questions: [
    "Capital do Brasil?",
    "Maior planeta do Sistema Solar?",
    "Processo de transformação da lagarta em borboleta?",
    "Gás essencial para a respiração humana?",
    "Principal estrela do Sistema Solar?",
    "Instrumento usado para ver objetos muito pequenos?",
    "Profissional que ensina em sala de aula?",
    "Área da ciência que estuda os seres vivos?",
    "Planeta conhecido como Planeta Vermelho?",
    "Líquido essencial à vida, incolor e sem sabor.",
  ],
  answers: [
    "BRASILIA",
    "JUPITER",
    "METAMORFOSE",
    "OXIGENIO",
    "SOL",
    "MICROSCOPIO",
    "PROFESSOR",
    "BIOLOGIA",
    "MARTE",
    "AGUA",
  ],
};

// ------------------ FUNÇÕES DE INICIALIZAÇÃO ------------------

document.addEventListener("DOMContentLoaded", () => {
  setupProfessorForm();
  setupLogoutButtons();
  checkPersistentLogin();

  // Atualização em tempo real
  const fields = [
    "crossword-title",
    "crossword-discipline",
    "professor-name"
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", atualizarPainelProfessor);
      el.addEventListener("change", atualizarPainelProfessor);
    }
  });
});

// ------------------ LOGIN ------------------
function entrarComoAluno() {
  const codeInput = document.getElementById("accessCode");
  const code = (codeInput?.value || "").trim().toUpperCase();

  if (!code) {
    alert("Digite o código de acesso.");
    return;
  }

  localStorage.removeItem("userRole");
  document.body.classList.remove("aluno-logado", "professor-logado");
  document.body.classList.add("mostrar-login");

  if (stopTimer) stopTimer();

  if (code === "PROFESSOR") {
    STATE.role = "professor";
    localStorage.setItem("userRole", "professor");
    document.body.classList.remove("mostrar-login");
    document.body.classList.add("professor-logado");
    showScreen("professor-screen");
    return;
  }

  if (code === "ALUNO") {
    STATE.role = "aluno";
    localStorage.setItem("userRole", "aluno");

    showLoadingOverlay(true);

    document.body.classList.remove("mostrar-login");
    document.body.classList.add("aluno-logado");
    showScreen("aluno-screen");

    const grid = document.getElementById("crossword-grid");
    if (grid) grid.innerHTML = "";

    startTimer();

    setTimeout(() => {
        ensureCrosswordExists();
    }, 100);
    return;
  }

  alert("Código inválido. Use apenas: ALUNO ou PROFESSOR.");
}

function checkPersistentLogin() {
  const role = localStorage.getItem("userRole");

  document.body.classList.remove("aluno-logado", "professor-logado");
  document.body.classList.add("mostrar-login");
  STATE.role = null;

  showScreen("login-screen");

  if (!role) return;

  if (role === "professor") {
    STATE.role = "professor";
    document.body.classList.remove("mostrar-login");
    document.body.classList.add("professor-logado");
    showScreen("professor-screen");
    return;
  }

  if (role === "aluno") {
    STATE.role = "aluno";
    showLoadingOverlay(true);
    document.body.classList.remove("mostrar-login");
    document.body.classList.add("aluno-logado");
    showScreen("aluno-screen");

    const grid = document.getElementById("crossword-grid");
    if (grid) grid.innerHTML = "";

    startTimer();
    setTimeout(() => ensureCrosswordExists(), 100);
  }
}

function showScreen(id) {
  const allScreens = ["login-screen", "aluno-screen", "professor-screen"];
  allScreens.forEach((screenId) => {
    const el = document.getElementById(screenId);
    if (el) {
      el.style.display = "";
      el.classList.remove("active");
    }
  });

  const screen = document.getElementById(id);
  if (screen) screen.classList.add("active");

  const header = document.querySelector(".app-header");
  if (header) header.style.display = id === "login-screen" ? "block" : "none";

  const app = document.querySelector(".app");
  if (app) {
    if (id === "aluno-screen") app.classList.add("aluno-mode");
    else app.classList.remove("aluno-mode");
  }
}

function setupLogoutButtons() {
  const logoutProf = document.getElementById("logout-prof");
  const logoutAluno = document.getElementById("logout-aluno");

  function executarLogout() {
    STATE.role = null;
    localStorage.removeItem("userRole");
    stopTimer();
    showLoadingOverlay(false);

    document.body.classList.remove("aluno-logado", "professor-logado");
    document.body.classList.add("mostrar-login");

    showScreen("login-screen");
    window.scrollTo(0, 0);
  }

  if (logoutProf) logoutProf.onclick = executarLogout;
  if (logoutAluno) logoutAluno.onclick = executarLogout;
}

// ------------------ PROFESSOR ------------------
function setupProfessorForm() {
  const form = document.getElementById("professor-form");
  const fillBtn = document.getElementById("fill-sample");
  const status = document.getElementById("professor-status");

  if (!form || !fillBtn || !status) return;

  // Botão de preencher exemplo (mantido igual)
  fillBtn.addEventListener("click", () => {
    for (let i = 1; i <= 10; i++) {
      const qInput = form.querySelector(`[name="q${i}"]`);
      const aInput = form.querySelector(`[name="a${i}"]`);
      if (qInput && aInput) {
        qInput.value = SAMPLE_DATA.questions[i - 1] || "";
        aInput.value = SAMPLE_DATA.answers[i - 1] || "";
      }
    }
    status.textContent = "Exemplo preenchido. Clique em “Gerar Cruzadinha”.";
    status.style.color = "#2563eb";
  });

  // Evento de Salvar/Gerar
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    status.textContent = "";
    
    const questions = [];
    const answers = [];

    // --- CORREÇÃO AQUI: CAPTURA DOS 3 CAMPOS ---
    const title = document.getElementById("crossword-title")?.value.trim() || "";
    const discipline = document.getElementById("crossword-discipline")?.value || "";
    
    // Tenta pegar o nome do professor (verifica dois IDs possíveis para segurança)
    const professorInput = document.getElementById("professor-name") || document.getElementById("crossword-professor");
    const professor = professorInput ? professorInput.value.trim() : "";

    if (!title || !discipline) {
      status.textContent = "⚠️ Preencha o Título e a Disciplina.";
      status.style.color = "#ef4444";
      return;
    }

    // Captura das perguntas e respostas
    for (let i = 1; i <= 10; i++) {
      const qInput = form.querySelector(`[name="q${i}"]`);
      const aInput = form.querySelector(`[name="a${i}"]`);
      const q = (qInput?.value || "").trim();
      const a = (aInput?.value || "").trim();

      // Validação básica
      if (!q || !a) {
        status.textContent = "⚠️ Preencha todas as 10 perguntas e respostas.";
        status.style.color = "#ef4444";
        return;
      }
      // Validação de espaço (apenas uma palavra)
      if (/\s/.test(a)) {
        status.textContent = `⚠️ A resposta ${i} deve ser uma única palavra (sem espaços).`;
        status.style.color = "#ef4444";
        return;
      }
      questions.push(q);
      answers.push(a);
    }

    try {
      // --- CORREÇÃO AQUI: SALVANDO O PROFESSOR NO JSON ---
      const dataToStore = { 
          title: title, 
          discipline: discipline, 
          professor: professor, // <--- Agora está sendo salvo!
          questions: questions, 
          answers: answers 
      };

      // Salva no local que o aluno lê ("ultimaCruzadinha")
        localStorage.setItem("ultimaCruzadinha", JSON.stringify(dataToStore));
        
        // Teste de geração para validar se as palavras cruzam
        buildCrosswordFromData(questions, answers);
        
        status.textContent = "✔️ Cruzadinha salva e gerada com sucesso!";
        status.style.color = "#22c55e";
        

      // Feedback visual extra (opcional)
      if(typeof showSuperToast === 'function') {
          showSuperToast("Atividade salva com sucesso!", "success");
      }

    } catch (err) {
      console.error(err);
      status.textContent = "❌ Erro ao gerar: palavras difíceis de cruzar. Tente mudar algumas.";
      status.style.color = "#ef4444";
    }
  });
}


// =====================================================
// ATUALIZAÇÃO EM TEMPO REAL DO PAINEL DO PROFESSOR
// =====================================================
function atualizarPainelProfessor() {
  const title = document.getElementById("crossword-title")?.value.trim();
  const discipline = document.getElementById("crossword-discipline")?.value.trim();
  const professor = document.getElementById("professor-name")?.value.trim();

  const elTitle = document.getElementById("display-theme");
  const elDisc  = document.getElementById("display-discipline");
  const elProf  = document.getElementById("display-professor");

  if (elTitle) elTitle.textContent = title || "Nova Atividade";
  if (elDisc)  elDisc.textContent  = discipline || "Disciplina";
  if (elProf)  elProf.textContent  = professor || "Professor";
}

// ------------------ ALGORITMO CRUZADINHA ------------------

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function ensureCrosswordExists() {
if (STATE.role !== "aluno") return;

  let tentativa = 0;
  const MAX_TENTATIVAS = 100;

  // CORREÇÃO: Buscando os novos IDs exclusivos da tela do aluno
  const elTheme = document.getElementById("aluno-display-theme");
  const elDisc = document.getElementById("aluno-display-discipline");
  const elProf = document.getElementById("aluno-display-professor");

  function tentarGerar() {
    if (STATE.role !== "aluno") return;
    tentativa++;

    try {
      // 1. CORREÇÃO: Busca na chave que o diagnóstico confirmou existir
      const stored = localStorage.getItem("ultimaCruzadinha");
      
      // Se não tiver nada, usa o exemplo
      const data = stored ? JSON.parse(stored) : SAMPLE_DATA;

      // Geração da Grade
      buildCrosswordFromData(data.questions, data.answers);
      renderCrossword();
      updateScores();

// 2. ATUALIZAÇÃO DOS DADOS NO PAINEL DO ALUNO (Refatorado para robustez)

// Título/Tema
if (elTheme) {
  // Prioriza 'title' que foi salvo no submit
  const tema = String(data.title || "").trim();
  elTheme.textContent = tema.length > 0 ? tema : "Atividade de Fixação";
}

// Disciplina
if (elDisc) {
  // Prioriza 'discipline' que foi salvo no submit
  const disciplina = String(data.discipline || "").trim();
  elDisc.textContent = disciplina.length > 0 ? disciplina : "Geral";
}

// Professor
if (elProf) {
  // Prioriza 'professor' que foi salvo no submit
  const professor = String(data.professor || "").trim();
  elProf.textContent = professor.length > 0 ? professor : "Professor";
}

      showLoadingOverlay(false);
      
    } catch (e) {
      console.warn(`♻️ Tentativa ${tentativa}: ${e.message}`);

      if (tentativa < MAX_TENTATIVAS) {
        setTimeout(tentarGerar, 10);
      } else {
        console.error("❌ Falha crítica.");
        alert("Erro ao gerar cruzadinha. Avise o professor.");
        showLoadingOverlay(false);
      }
    }
  }

  showLoadingOverlay(true);
  tentarGerar();
}




function showLoadingOverlay(show) {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.style.display = show ? "flex" : "none";
}

function buildCrosswordFromData(questions, answers) {
  const normAnswers = answers.map((a) => a.replace(/\s+/g, "").toUpperCase());
  STATE.questions = [...questions];
  STATE.answers = [...normAnswers];

  // Aumentei um pouco o grid interno para facilitar o encaixe
  const gridSize = 22; 
  const grid = [];
  for (let r = 0; r < gridSize; r++) {
    grid[r] = new Array(gridSize).fill(null);
  }

  const words = [];
  const order = normAnswers.map((_, idx) => idx);
  shuffleArray(order);

  // Começa no meio
  const baseRow = Math.floor(gridSize / 2) - 2;
  const baseCol = Math.floor(gridSize / 2) - 2;

  order.forEach((originalIndex, orderPos) => {
    const answer = normAnswers[originalIndex];
    const questionText = questions[originalIndex];
    const questionNumber = originalIndex + 1;
    const L = answer.length;

    if (orderPos === 0) {
      // Primeira palavra
      const dir = Math.random() < 0.5 ? "H" : "V";
      let r = baseRow, c = baseCol;
      
      // Ajuste fino para não estourar bordas logo de cara
      if(dir === 'H' && c + L > gridSize) c = gridSize - L - 1;
      if(dir === 'V' && r + L > gridSize) r = gridSize - L - 1;

      placeWord(grid, words, answer, questionText, questionNumber, r, c, dir);
    } else {
      // Tenta cruzar
      const placed = tryPlaceWordWithCross(grid, words, answer, questionText, questionNumber);
      
      if (!placed) {
        // Fallback: tentar posicionar isolado em algum lugar livre (brute force simplificado)
        let success = false;
        for (let t = 0; t < 80; t++) {
            const tr = Math.floor(Math.random() * (gridSize - L - 1));
            const tc = Math.floor(Math.random() * (gridSize - L - 1));
            const tDir = Math.random() < 0.5 ? "H" : "V";
            try {
                placeWord(grid, words, answer, questionText, questionNumber, tr, tc, tDir);
                success = true;
                break;
            } catch(e) {}
        }
        // Se não couber, ignoramos essa palavra (melhor que crashar)
        if(!success) {
            console.log("Palavra ignorada (não coube):", answer);
        }
      }
    }
  });

  // Conta letras
  let totalLetters = 0;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c]?.char) totalLetters++;
    }
  }

  STATE.grid = grid;
  STATE.words = words;
  STATE.totalLetters = totalLetters;
}

function placeWord(grid, words, answer, questionText, questionNumber, row, col, direction) {
  const size = grid.length;
  const L = answer.length;

  // 1) Verifica Limites do Grid
  if (row < 0 || col < 0) throw new Error("Fora do grid (negativo)");
  if (direction === "H" && col + L >= size) throw new Error("Fora do grid H");
  if (direction === "V" && row + L >= size) throw new Error("Fora do grid V");

  // 2) Verifica Célula de INÍCIO (Start Cell)
  // A célula [row][col] será o número. Não pode ter LETRA lá.
  const cellStart = grid[row][col];
  if (cellStart && cellStart.char) {
      throw new Error("Start cell colide com letra existente");
  }

  // 3) Verifica as LETRAS
  for (let i = 0; i < L; i++) {
    const r = row + (direction === "V" ? i + 1 : 0);
    const c = col + (direction === "H" ? i + 1 : 0);

    const cell = grid[r][c];
    
    // Colisão com Start Cell de outra palavra
    if (cell && cell.isStart) {
        throw new Error("Letra colide com Start Cell de outra palavra");
    }

    // Colisão de letras diferentes
    if (cell && cell.char && cell.char !== answer[i]) {
        throw new Error("Conflito de letras");
    }
  }

  // 4) Verifica vizinhos (não colar palavras lado a lado sem cruzar)
  // Verifica antes do start e depois do fim
// 4) Verifica vizinhos antes e depois da palavra (não pode colar nem virar rabo)
if (direction === "H") {
    // Antes do start
    if (col - 1 >= 0) {
        const before = grid[row][col - 1];
        if (before && (before.char || before.isStart)) {
            throw new Error("Colado antes (H)");
        }
    }

    // Depois do fim real (última letra)
    const endC = col + L;
    if (endC < size) {
        const after = grid[row][endC];
        if (after && (after.char || after.isStart)) {
            throw new Error("Colado depois (H)");
        }
    }

} else { // VERTICAL
    if (row - 1 >= 0) {
        const before = grid[row - 1][col];
        if (before && (before.char || before.isStart)) {
            throw new Error("Colado antes (V)");
        }
    }

    const endR = row + L;
    if (endR < size) {
        const after = grid[endR][col];
        if (after && (after.char || after.isStart)) {
            throw new Error("Colado depois (V)");
        }
    }
}


  // 5) Grava no Grid
  // Marca Start Cell
  if (!grid[row][col]) {
      grid[row][col] = { isStart: true, labelNumber: questionNumber, questionText, startDirection: direction };
  } else {
      // Se já era start (cruzamento de starts improvável mas possível), atualiza
      grid[row][col].isStart = true;
      grid[row][col].labelNumber = questionNumber; 
      grid[row][col].questionText = questionText;
      grid[row][col].startDirection = direction;
  }

  // Marca Letras
  for (let i = 0; i < L; i++) {
    const r = row + (direction === "V" ? i + 1 : 0);
    const c = col + (direction === "H" ? i + 1 : 0);
    
    if (!grid[r][c]) {
        grid[r][c] = { char: answer[i], isStart: false };
    } else {
        grid[r][c].char = answer[i];
    }
  }

  // Registra
  words.push({
    question: questionText,
    answer,
    direction,
    row,
    col,
    questionNumber,
    index: words.length
  });
}

function placeWord(grid, words, answer, questionText, questionNumber, row, col, direction) {
  const size = grid.length;
  const L = answer.length;

  // 1) Verifica Limites do Grid
  if (row < 0 || col < 0) throw new Error("Fora do grid (negativo)");
  if (direction === "H" && col + L > size) throw new Error("Fora do grid H"); // Ajustado para > size (borda exata)
  if (direction === "V" && row + L > size) throw new Error("Fora do grid V");

  // 2) Verifica Célula de INÍCIO (Start Cell)
  const cellStart = grid[row][col];
  if (cellStart && cellStart.char) {
      throw new Error("Start cell colide com letra existente");
  }

  // 3) Verifica as LETRAS (Colisões internas)
  for (let i = 0; i < L; i++) {
    const r = row + (direction === "V" ? i : 0); // Correção: i começa em 0, não precisa de +1 aqui se a lógica de r/c for direta
    const c = col + (direction === "H" ? i : 0);
    
    // Nota: No seu código original o loop usava r = row + (dir==V ? i+1 : 0). 
    // Vou manter a SUA lógica de coordenadas para não quebrar o resto do app:
    // Pelo seu padrão: Start é [row][col]. As letras começam em [row+1][col] (V) ou [row][col+1] (H)?
    // OLHANDO SEU RENDER:
    //   if (cellData.isStart) ... else if (cellData.char) ...
    //   E no placeWord original:
    //   const r = row + (direction === "V" ? i + 1 : 0);
    //   Isso indica que a palavra "SOL" ocupa 4 células? 1 de numero + 3 de letras?
    //   Se for isso, o cálculo de vizinhança muda.
    
    // VERIFICANDO SEU ALGORITMO ORIGINAL:
    // "Start Cell" é separada das letras.
    // Se "SOL" (3 letras) em H na [0,0]:
    // [0,0] = Start. [0,1]=S, [0,2]=O, [0,3]=L.
    // Fim real da palavra é col + L. (0 + 3 = 3).
  }

  // --- REVISÃO DA SUA LÓGICA DE START X LETRAS ---
  // No seu código original:
  // Letras loop i=0..L.
  // r = row + (dir=V ? i+1 : 0)
  // Isso significa que a palavra real ocupa L+1 espaços (1 pro número, L pras letras).
  
  // LOGO, a verificação de vizinhos precisa considerar esse "i+1".
  
  // 3) Verifica as LETRAS (Mantendo sua lógica original de Start separado)
  for (let i = 0; i < L; i++) {
    const r = row + (direction === "V" ? i + 1 : 0);
    const c = col + (direction === "H" ? i + 1 : 0);

    const cell = grid[r][c];
    if (cell && cell.isStart) throw new Error("Colisão com Start Cell");
    if (cell && cell.char && cell.char !== answer[i]) throw new Error("Conflito de letras");
  }

  // 4) Verifica VIZINHOS (A CORREÇÃO DEFINITIVA)
  if (direction === "H") {
    // Esquerda (Antes do Start)
    if (col - 1 >= 0) {
        const before = grid[row][col - 1];
        if (before && (before.char || before.isStart)) throw new Error("Colado antes (H)");
    }
    
    // Direita (Depois da última letra)
    // Se start é col, letras vão até col + L. A casa vizinha é col + L + 1.
    // Ex: Start=0. S=1, O=2, L=3. Vizinho perigoso=4.
    // Conta: 0 + 3 + 1 = 4.
    const endC = col + L + 1; 
    if (endC < size) {
        const after = grid[row][endC];
        if (after && (after.char || after.isStart)) throw new Error("Colado depois (H)");
    }
  } else { // VERTICAL
    // Acima (Antes do Start)
    if (row - 1 >= 0) {
        const before = grid[row - 1][col];
        if (before && (before.char || before.isStart)) throw new Error("Colado antes (V)");
    }

    // Abaixo (Depois da última letra)
    // Se start é row. Letras vão até row + L. Vizinho perigoso é row + L + 1.
    // Ex: Start=0. S=1, O=2, L=3. Vizinho perigoso=4.
    const endR = row + L + 1; 
    
    // NO SEU CÓDIGO ORIGINAL VOCÊ TINHA "+ L + 1" E AINDA SOMAVA OUTRO NA LÓGICA?
    // Não, o erro era que sua lógica de letras usa "+1" (pula o start), então o fim é mais longe.
    
    if (endR < size) {
        const after = grid[endR][col];
        if (after && (after.char || after.isStart)) {
            throw new Error("Colado depois (V)");
        }
    }
  }

  // 5) Grava no Grid
  if (!grid[row][col]) {
      grid[row][col] = { isStart: true, labelNumber: questionNumber, questionText, startDirection: direction };
  } else {
      grid[row][col].isStart = true;
      grid[row][col].labelNumber = questionNumber; 
      grid[row][col].questionText = questionText;
      grid[row][col].startDirection = direction;
  }

  for (let i = 0; i < L; i++) {
    const r = row + (direction === "V" ? i + 1 : 0);
    const c = col + (direction === "H" ? i + 1 : 0);
    
    if (!grid[r][c]) {
        grid[r][c] = { char: answer[i], isStart: false };
    } else {
        grid[r][c].char = answer[i];
    }
  }

  words.push({
    question: questionText,
    answer,
    direction,
    row,
    col,
    questionNumber,
    index: words.length
  });
}

function tryPlaceWordWithCross(grid, words, answer, questionText, questionNumber) {
    const size = grid.length;
    // Tenta todas as palavras já colocadas para achar um cruzamento
    const wordIndexes = shuffleArray(words.map((_, i) => i));

    for (const wIdx of wordIndexes) {
        const existingWord = words[wIdx];
        const existingAns = existingWord.answer;
        
        // Tenta cruzar cada letra
        const letterIndexes = shuffleArray([...Array(answer.length).keys()]);
        
        for (const i of letterIndexes) { // i = índice na NOVA palavra
            const charNew = answer[i];
            
            // Procura esse char na palavra existente
            for (let j = 0; j < existingAns.length; j++) {
                if (existingAns[j] !== charNew) continue;

                // Achou letra igual. Calcula onde seria o inicio da nova palavra
                // Se existing é H, nova é V.
                const newDir = existingWord.direction === "H" ? "V" : "H";
                
                // Posição absoluta da letra de cruzamento
                const crossR = existingWord.row + (existingWord.direction === "V" ? j + 1 : 0);
                const crossC = existingWord.col + (existingWord.direction === "H" ? j + 1 : 0);

                // Onde deve ser o start da nova palavra?
                // Se nova é V, o start está (i+1) acima do crossR
                // Se nova é H, o start está (i+1) à esquerda do crossC
                const startR = newDir === "V" ? crossR - (i + 1) : crossR;
                const startC = newDir === "H" ? crossC - (i + 1) : crossC;

                try {
                    placeWord(grid, words, answer, questionText, questionNumber, startR, startC, newDir);
                    return true; // Sucesso!
                } catch (e) {
                    // Não deu certo nessa posição, continua tentando
                }
            }
        }
    }
    return false;
}

// ------------------ RENDERIZAÇÃO ------------------

function isGridTooBig(minR, maxR, minC, maxC) {
    // Verifica se o bounding box cabe no container visual
    const rows = maxR - minR + 1;
    const cols = maxC - minC + 1;
    // Limite visual aproximado (baseado no CSS e tamanho 36px)
    return rows > 18 || cols > 25; 
}

function renderCrossword() {
	
	
	

  const container = document.getElementById("crossword-grid");
  if (!container || !STATE.grid) return;
  container.innerHTML = "";

  const grid = STATE.grid;
  const size = grid.length;

  // Bounding Box
  let minR = size, maxR = -1, minC = size, maxC = -1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) { // Start ou Char
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }

  if (maxR === -1) {
      throw new Error("Grid vazio");
  }

  if (isGridTooBig(minR, maxR, minC, maxC)) {
      throw new Error("Grid muito expandido");
  }

  const cols = maxC - minC + 1;
  // Mantive 32px para bater com o CSS ajustado
  container.style.gridTemplateColumns = `repeat(${cols}, 32px)`;

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const cellData = grid[r][c];
      const cellDiv = document.createElement("div");
      cellDiv.className = "cell";

      if (!cellData) {
        cellDiv.classList.add("empty");
        container.appendChild(cellDiv);
        continue;
      }

      if (cellData.isStart) {
        cellDiv.classList.add("start-cell");
        cellDiv.title = cellData.questionText || "";
        
        const wrap = document.createElement("div");
        wrap.className = "start-label";
        
        const num = document.createElement("span");
        num.textContent = cellData.labelNumber;
        
        const arrow = document.createElement("span");
        arrow.className = "start-arrow";
        arrow.textContent = cellData.startDirection === "V" ? "↓" : "→";

        wrap.appendChild(num);
        wrap.appendChild(arrow);
        cellDiv.appendChild(wrap);
      } else if (cellData.char) {
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 1;
        input.dataset.row = r;
        input.dataset.col = c;

        // Eventos
        input.addEventListener("input", onCellInput);
        
        // --- ADICIONADO AQUI: Navegação por setas ---
        input.addEventListener("keydown", handleKeyboardNav); 

        cellDiv.appendChild(input);
      }

      container.appendChild(cellDiv);
    }
  }
}


function onCellInput(e) {
  const input = e.target;
  const row = parseInt(input.dataset.row, 10);
  const col = parseInt(input.dataset.col, 10);

  const cell = STATE.grid?.[row]?.[col];
  if (!cell || !cell.char) return;

  // Normaliza valor digitado
  const prevValue = (input.dataset.prevValue || "").toUpperCase();
  let newValue = (input.value || "").toUpperCase();

  if (newValue.length > 1) {
    newValue = newValue.slice(-1); // mantém só o último caractere
  }
  input.value = newValue;
  input.dataset.prevValue = newValue;

  const expected = cell.char;

  const wasEmpty   = !prevValue;
  const isEmpty    = !newValue;
  const wasCorrect = !!prevValue && prevValue === expected;
  const isCorrect  = !!newValue && newValue === expected;

  let actionType = "neutro";

  if (wasEmpty && isEmpty) {
    actionType = "neutro";
  } else if (wasEmpty && isCorrect) {
    actionType = "primeiro_acerto";
  } else if (wasEmpty && !isCorrect) {
    actionType = "primeiro_erro";
  } else if (!wasEmpty && isEmpty) {
    actionType = "apagou_letra";
  } else if (!wasCorrect && isCorrect) {
    actionType = "corrigiu_erro";
  } else if (wasCorrect && !isCorrect) {
    actionType = "estragou_acerto";
  } else if (!wasCorrect && !isCorrect && prevValue !== newValue) {
    actionType = "trocou_erro_por_erro";
  }

  STATE.lastAction = {
    type: actionType,
    row,
    col,
    wasEmpty,
    isEmpty,
    wasCorrect,
    isCorrect,
    timestamp: Date.now()
  };

  // Atualiza placar + feedback a cada troca
  updateScores();
}




// ------------------ PONTUAÇÃO ------------------

function updateScores() {
  const words = STATE.words || [];
  const grid = STATE.grid;
  if (!grid || words.length === 0) return;

  let correctWords = 0;
  let lettersCorrect = 0;
  let lettersTotal = 0;
  let wrongLetters = 0;

  const size = grid.length;

  // ======================================================
  // 1) LETRAS INDIVIDUAIS (com classes correct / wrong)
  // ======================================================
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]?.char) {
        const expected = grid[r][c].char;
        const input = document.querySelector(
          `input[data-row="${r}"][data-col="${c}"]`
        );

        if (input) {
          lettersTotal++;

          const val = (input.value || "").toUpperCase();

          // Sempre limpa o estado visual
          input.classList.remove("correct", "wrong");

          if (val === expected) {
            lettersCorrect++;
            input.classList.add("correct"); // verde
          } else if (val) {
            wrongLetters++;
            input.classList.add("wrong"); // vermelho
          }
        }
      }
    }
  }

  // ======================================================
  // 2) PALAVRAS INTEIRAS
  // ======================================================
  words.forEach(w => {
    let ok = true;
    for (let i = 0; i < w.answer.length; i++) {
      const rr = w.row + (w.direction === "V" ? i + 1 : 0);
      const cc = w.col + (w.direction === "H" ? i + 1 : 0);

      const input = document.querySelector(
        `input[data-row="${rr}"][data-col="${cc}"]`
      );

      if (!input || input.value.toUpperCase() !== w.answer[i]) {
        ok = false;
        break;
      }
    }
    if (ok) correctWords++;
  });

  // ======================================================
  // 3) MÉTRICAS E ESTADO GLOBAL DE PERFORMANCE
  // ======================================================
  const percent = lettersTotal > 0
    ? Math.round((lettersCorrect / lettersTotal) * 100)
    : 0;

  const scoreNote = correctWords;

  // segurança: inicializa valores caso não existam
  const perf = STATE.performance;
  if (perf.lastWrong == null) perf.lastWrong = 0;
  if (perf.lastLettersCorrect == null) perf.lastLettersCorrect = 0;
  if (!perf.lastActionTime) perf.lastActionTime = Date.now();

  const wrongDelta = wrongLetters - perf.lastWrong;
  perf.lastWrong = wrongLetters;

  const houveNovoAcerto = lettersCorrect > perf.lastLettersCorrect;
  if (houveNovoAcerto) perf.lastActionTime = Date.now();
  perf.lastLettersCorrect = lettersCorrect;

  const timeSinceLastAction = Math.floor((Date.now() - perf.lastActionTime) / 1000);
  const elapsedSec = Math.floor((Date.now() - STATE.timer.startTime) / 1000);

  // ======================================================
  // 4) ATUALIZA PAINEL NUMÉRICO
  // ======================================================
  const elWords   = document.getElementById("score-words");
  const elLetters = document.getElementById("score-letters");
  const elNote    = document.getElementById("score-note");
  const elConcept = document.getElementById("score-concept");
  const elFeedback = document.getElementById("feedback-message");

  if (elWords)   elWords.textContent   = `${correctWords} / ${words.length}`;
  if (elLetters) elLetters.textContent = `${lettersCorrect} / ${lettersTotal} (${percent}%)`;
  if (elNote)    elNote.textContent    = scoreNote;

  let concept = "–";
  if (scoreNote >= 9) concept = "A";
  else if (scoreNote >= 7) concept = "B";
  else if (scoreNote >= 5) concept = "C";
  else if (scoreNote >= 3) concept = "D";
  else if (scoreNote >= 1) concept = "E";

  if (elConcept) elConcept.textContent = concept;

  // ======================================================
  // 5) FEEDBACK DO PROFESSOR + SUPER TOAST
  // ======================================================
  if (elFeedback) {
    const context = {
      scoreWords: correctWords,
      percentLetters: percent,
      totalWords: words.length,
      elapsedSec,
      lettersCorrect,
      lettersTotal,
      wrongDelta,
      timeSinceLastAction,
      action: STATE.lastAction
    };

    const novaMensagem = getFeedback(context);

    // Atualiza painel do professor
    if (elFeedback.textContent !== novaMensagem) {
      elFeedback.textContent = novaMensagem;

      const containerMsg = elFeedback.closest('.painel-message');
      if (containerMsg) {
        containerMsg.classList.remove("nova-dica");
        void containerMsg.offsetWidth;
        containerMsg.classList.add("nova-dica");
      }
    }

    // ======================================================
    //  NOVO: SUPER TOAST sincronizado com a dica
    // ======================================================
    if (typeof showSuperToast === "function") {
    const toastType = getToastTypeForAction(STATE.lastAction?.type);
    showSuperToast(novaMensagem, toastType);
       }
  }
}


//VERSÃO INICIAL
//function getFeedback(score, percent, total) {
//    if (score === total) return "Parabéns! Você completou tudo!";
//    if (percent > 80) return "Quase lá! Faltam poucos detalhes.";
//    if (score > total / 2) return "Muito bem! Continue assim.";
//    if (percent > 20) return "Bom começo, continue procurando as pistas.";
//    return "Para ver a pergunta, passe o mouse sobre o número.";
//}


function rand(n) {
  return Math.floor(Math.random() * n);
}

const FEEDBACK_LIBRARY = {
  inicio: [
    "Vamos começar? Explore as pistas passando o mouse sobre os números.",
    "Primeiro passo: escolha uma palavra que pareça mais fácil e comece por ela.",
    "Observe o tabuleiro e identifique uma pista que te chame atenção para iniciar.",
    "Começar com calma faz diferença. Escolha um ponto de partida e teste sua hipótese."
  ],

  primeiro_acerto: [
    "Ótimo começo! Essa letra se encaixou perfeitamente.",
    "Excelente! Esse acerto ajuda a revelar outras palavras ao redor.",
    "Boa escolha — essa letra conversa bem com as interseções.",
    "Muito bom! Cada letra correta facilita as próximas decisões."
  ],

  corrigiu_erro: [
    "Boa revisão! Agora essa letra ficou alinhada com a pista.",
    "Perfeito — ajustar hipóteses é parte importante da aprendizagem.",
    "Você corrigiu a rota com precisão. Continue usando as pistas ao seu favor.",
    "Ótimo! Rever e ajustar mostra atenção ao detalhe."
  ],

  acerto_continuo: [
    "Você está em uma boa sequência. Continue conectando pistas e interseções.",
    "Os acertos recentes mostram que sua estratégia está funcionando.",
    "Excelente ritmo! Use essas letras certas para validar as próximas palavras.",
    "Muito bom! Sua leitura das pistas está ficando cada vez mais afinada."
  ],

  primeiro_erro: [
    "Boa tentativa! Essa letra não parece combinar com a pista, tente outra opção.",
    "Tudo bem errar — observe o enunciado e pense em outra possibilidade.",
    "Essa não encaixa tão bem. Releia a pista e considere outro caminho.",
    "Erro faz parte do processo. Use as letras cruzadas como apoio para decidir."
  ],

  trocou_erro_por_erro: [
    "Você está explorando possibilidades. Agora vale olhar com calma para o sentido da palavra.",
    "Talvez seja hora de focar na pista em vez de testar letras aleatórias.",
    "Observe o significado da frase: isso pode afunilar as opções.",
    "Tente relacionar a pista ao conteúdo estudado, não apenas às letras."
  ],

  estragou_acerto: [
    "Cuidado: essa posição parecia correta antes. Verifique se vale mesmo trocá-la.",
    "Você alterou uma letra que parecia encaixar. Confirme com as pistas ao redor.",
    "Revise essa mudança — veja se as palavras cruzadas continuam fazendo sentido.",
    "Lembre-se de conferir se a nova letra combina com as interseções já certas."
  ],

  apagou_letra: [
    "Rever faz parte: agora escolha uma nova hipótese para esse espaço.",
    "Você limpou a célula. Ótimo momento para repensar a pista com calma.",
    "Às vezes apagar é o melhor caminho para reorganizar o raciocínio.",
    "Com o espaço livre, tente relacionar novamente a pista ao conteúdo."
  ],

  progresso_inicial: [
    "Bom início! Algumas letras já estão abrindo caminhos pelo tabuleiro.",
    "Seu progresso está aparecendo. Continue explorando pistas diferentes.",
    "Ótimo, o tabuleiro já começa a ganhar forma. Veja quais cruzamentos podem ajudar.",
    "Você já construiu uma base. Agora use essas letras para confirmar novas palavras."
  ],

  progresso_medio: [
    "Você está avançando bem. Intercale entre pistas fáceis e desafiadoras.",
    "O quadro já tem boas partes preenchidas. Use isso para refinar suas hipóteses.",
    "Muito bom! Agora vale revisar alguns pontos para garantir consistência.",
    "Seu avanço é visível. Aproveite para checar se tudo está coerente com as pistas."
  ],

  quase_lá: [
    "Você está muito perto de completar. Revise com atenção as últimas interseções.",
    "Reta final! Pequenos ajustes podem fechar toda a cruzadinha.",
    "Quase concluído — confira se alguma pista ainda está em dúvida.",
    "Excelente trabalho até aqui. Faça uma leitura geral antes de finalizar."
  ],

  tempo_sem_progresso: [
    "Se estiver travado, mude de pista. Às vezes outra palavra destrava tudo.",
    "Vale a pena olhar para uma palavra diferente, especialmente as mais curtas.",
    "Quando o raciocínio trava, alterar o foco pode ajudar bastante.",
    "Dê uma olhada nas palavras horizontais ou verticais que ainda estão em branco."
  ],

  conclusao: [
    "Parabéns! Você concluiu a cruzadinha com qualidade.",
    "Excelente resultado! Todo o tabuleiro foi preenchido de forma correta.",
    "Ótimo trabalho — esse desempenho mostra boa compreensão do conteúdo.",
    "Desafio concluído com sucesso. Agora é uma boa hora para revisar o que aprendeu."
  ],

  neutro: [
    "Continue testando hipóteses e observando as interseções.",
    "Cada tentativa traz informação nova. Use isso a seu favor.",
    "Você está construindo o caminho aos poucos. Mantenha a atenção nas pistas.",
    "Siga relacionando o enunciado das pistas com o conteúdo estudado."
  ]
};

function getFeedback(ctx) {
  // Garantia de segurança caso ctx venha incompleto
  if (!ctx) ctx = {};

  const {
    scoreWords = 0,
    percentLetters = 0,
    totalWords = 0,
    elapsedSec = 0,
    lettersCorrect = 0,
    lettersTotal = 0,
    wrongDelta = 0,
    timeSinceLastAction = 0,
    action = null
  } = ctx;

  let key = "neutro";

  // ============================================================
  // 1) Situações específicas da ação
  // ============================================================
  switch (action?.type) {
    case "primeiro_acerto": key = "primeiro_acerto"; break;
    case "corrigiu_erro": key = "corrigiu_erro"; break;
    case "primeiro_erro": key = "primeiro_erro"; break;
    case "trocou_erro_por_erro": key = "trocou_erro_por_erro"; break;
    case "estragou_acerto": key = "estragou_acerto"; break;
    case "apagou_letra": key = "apagou_letra"; break;
  }

  // ============================================================
  // 2) Ajustes por estágio global
  // ============================================================

  // Início total
  if (lettersCorrect === 0 && elapsedSec < 15) {
    key = "inicio";
  }

  // Conclusão
  else if (scoreWords === totalWords && totalWords > 0) {
    key = "conclusao";
  }

  // Percentuais de progresso
  else if (percentLetters >= 60 && percentLetters < 90) {
    key = "quase_lá";
  }
  else if (percentLetters >= 30 && percentLetters < 60) {
    key = "progresso_medio";
  }
  else if (percentLetters > 0 && percentLetters < 30 && key === "neutro") {
    key = "progresso_inicial";
  }

  // ============================================================
  // 3) Tempo sem progresso
  // ============================================================
  if (timeSinceLastAction > 25 && percentLetters < 80) {
    key = "tempo_sem_progresso";
  }

  // ============================================================
  // 4) Acertos contínuos (não relacionados a ações específicas)
  // ============================================================
  const lastLetters = STATE?.performance?.lastLettersCorrect ?? 0;

  if (
    (action?.type !== "primeiro_acerto" &&
     action?.type !== "corrigiu_erro") &&
    lettersCorrect > lastLetters &&
    percentLetters >= 20
  ) {
    key = "acerto_continuo";
  }

  // ============================================================
  // 5) Seleção da frase (evita repetição)
  // ============================================================
  const pool = FEEDBACK_LIBRARY[key] || FEEDBACK_LIBRARY.neutro;

  let msg = pool[rand(pool.length)];
  const lastKey = STATE.feedback.lastKey;
  const lastText = STATE.feedback.lastText;

  // Evita repetir exatamente a mesma frase
  if (key === lastKey && msg === lastText) {
    for (let i = 0; i < 3; i++) {
      const tentativa = pool[rand(pool.length)];
      if (tentativa !== lastText) {
        msg = tentativa;
        break;
      }
    }
  }

  // Salva histórico
  STATE.feedback.lastKey = key;
  STATE.feedback.lastText = msg;

  return msg;
}


// ------------------ TIMER ------------------
function startTimer() {
  const display = document.getElementById("timer-display");
  if (!display) return;
  stopTimer();
  STATE.timer.startTime = Date.now();
  STATE.timer.intervalId = setInterval(() => {
    const diff = Math.floor((Date.now() - STATE.timer.startTime) / 1000);
    const m = Math.floor(diff / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    display.textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  if (STATE.timer.intervalId) {
    clearInterval(STATE.timer.intervalId);
    STATE.timer.intervalId = null;
  }
}

// ------------------ NAVEGAÇÃO POR TECLADO ------------------

function handleKeyboardNav(e) {
  const input = e.target;
  // Pega a posição atual convertendo para número
  const r = parseInt(input.dataset.row, 10);
  const c = parseInt(input.dataset.col, 10);

  let nextR = r;
  let nextC = c;

  // Detecta qual tecla foi pressionada
  switch (e.key) {
    case "ArrowUp":
      nextR = r - 1;
      break;
    case "ArrowDown":
      nextR = r + 1;
      break;
    case "ArrowLeft":
      nextC = c - 1;
      break;
    case "ArrowRight":
      nextC = c + 1;
      break;
      
    // BÔNUS: Backspace volta para a célula anterior se a atual estiver vazia
    case "Backspace":
      if (input.value === "") {
        // Tenta voltar para a esquerda ou para cima (lógica simplificada)
        // Primeiro tenta esquerda
        let prev = document.querySelector(`input[data-row="${r}"][data-col="${c - 1}"]`);
        if (!prev) {
             // Se não tiver na esquerda, tenta em cima
             prev = document.querySelector(`input[data-row="${r - 1}"][data-col="${c}"]`);
        }
        if (prev) {
            prev.focus();
            e.preventDefault();
        }
      }
      return; // Sai da função, não precisa focar nada mais
      
    default:
      return; // Se não for seta, não faz nada
  }

  // Tenta encontrar o input na nova posição
  const nextInput = document.querySelector(`input[data-row="${nextR}"][data-col="${nextC}"]`);

  // Se existir um input lá, joga o foco para ele
  if (nextInput) {
    nextInput.focus();
    e.preventDefault(); // Impede a página de rolar com as setas
  }
}




/* ===============================
     SUPER TOAST – ALERTA FORTE
=============================== */

/* ============================================================
   MAPEAR O TIPO DE TOAST PELO TIPO DE AÇÃO DO ALUNO
   (Define a cor e estilo visual do alerta)
============================================================ */
function getToastTypeForAction(actionType) {
  switch (actionType) {
    // Ações positivas → verde premium
    case "primeiro_acerto":
    case "corrigiu_erro":
    case "acerto_continuo":
      return "success";

    // Ações negativas → vermelho premium
    case "primeiro_erro":
    case "trocou_erro_por_erro":
    case "estragou_acerto":
      return "error";

    // Ações neutras → marrom/âmbar premium
    case "apagou_letra":
    default:
      return "neutral";
  }
}

/* ============================================================
   ÍCONES SVG PREMIUM POR TIPO DE TOAST
   (SVG garante nitidez e elegância em qualquer tamanho)
============================================================ */
function getToastIcon(type) {
  switch (type) {

    /* ÍCONE – SUCESSO */
    case "success":
      return `
        <svg class="super-toast-icon" viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2">
          <path d="M5 13l4 4L19 7" />
        </svg>
      `;

    /* ÍCONE – ERRO */
    case "error":
      return `
        <svg class="super-toast-icon" viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2">
          <path d="M12 2L2 22h20L12 2z" />
          <circle cx="12" cy="17" r="1" />
          <line x1="12" y1="9" x2="12" y2="13" />
        </svg>
      `;

    /* ÍCONE – NEUTRO */
    case "neutral":
    default:
      return `
        <svg class="super-toast-icon" viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2">
          <circle cx="12" cy="9" r="5" />
          <path d="M12 14v4M12 19v2" />
        </svg>
      `;
  }
}

/* ============================================================
   GARANTIR QUE O CONTAINER DE TOAST EXISTE
   (Evita múltiplos containers e mantém tudo organizado)
============================================================ */
function ensureToastContainer() {
  let container = document.getElementById("super-toast-container");

  if (!container) {
    container = document.createElement("div");
    container.id = "super-toast-container";
    document.body.appendChild(container);
  }

  return container;
}
/* ============================================================
   MOSTRAR O SUPER TOAST (única função válida)
============================================================ */
function showSuperToast(message, type = "neutral") {

  const container = ensureToastContainer();

  // Cria o toast
  const toast = document.createElement("div");
  toast.className = `super-toast ${type}`;

  // Ícone SVG premium
  const iconWrapper = document.createElement("div");
  iconWrapper.innerHTML = getToastIcon(type);
  iconWrapper.className = "super-toast-icon";

  // Texto
  const text = document.createElement("div");
  text.className = "super-toast-text";
  text.textContent = message;

  toast.appendChild(iconWrapper);
  toast.appendChild(text);

  // Adiciona ao container
  container.appendChild(toast);

  // Remove após animação
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}



