const urls = {
  mop: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQYdqUCiQo1j8tng89sXIumUnYaGSLAKVJAqthLeNUN31In0rllXGwE2yz011xPMw/pub?output=csv",
  satisfacao: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTQvys7JeN-rwK5sSytmUG387v1FulbtppllcqypwsI3LGUkPIrPBOyAGBelCbbtcXP6W4IT4dlJmB/pub?output=csv",
  blip: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQpsrlEOwQSEX9d1oa-wtsAny0dnmkYK5SuVoJ_-p2PXKg4ZqLawkk5BzKuVnt1euXtBBEEHtFIYZyW/pub?output=csv",
  agent: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRQskfJzWRdFIDn1lTEDGFP_o6jc8T5N3nRDa_AbHbbSYV9rOs-e3zUUDySbGUli6Lno0w1aCldXBt/pub?output=csv"
};

function normalizarNomeColuna(nome){
  return String(nome || "")
    .trim()
    .replace(/^\uFEFF/, "");
}

function parseCSV(texto){
  const linhas = [];
  let linha = [];
  let campo = "";
  let aspas = false;

  for(let i = 0; i < texto.length; i++){
    const char = texto[i];
    const prox = texto[i + 1];

    if(char === '"' && aspas && prox === '"'){
      campo += '"';
      i++;
    } else if(char === '"'){
      aspas = !aspas;
    } else if(char === "," && !aspas){
      linha.push(campo);
      campo = "";
    } else if((char === "\n" || char === "\r") && !aspas){
      if(campo || linha.length){
        linha.push(campo);
        linhas.push(linha);
        linha = [];
        campo = "";
      }
      if(char === "\r" && prox === "\n") i++;
    } else {
      campo += char;
    }
  }

  if(campo || linha.length){
    linha.push(campo);
    linhas.push(linha);
  }

  if(!linhas.length) return [];

  const headers = linhas[0].map(normalizarNomeColuna);

  return linhas.slice(1)
    .filter(l => l.some(c => String(c || "").trim() !== ""))
    .map(linha => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = linha[i] ? String(linha[i]).trim() : "";
      });
      return obj;
    });
}

async function carregarCSV(nome, url){
  const resposta = await fetch(url);

  if(!resposta.ok){
    throw new Error(`Erro ao carregar ${nome}: ${resposta.status}`);
  }

  const texto = await resposta.text();
  return parseCSV(texto);
}

function numero(valor){
  if(valor === null || valor === undefined) return 0;
  const limpo = String(valor).replace("%", "").replace(",", ".").trim();
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function pegarCampo(obj, possiveisNomes){
  for(const nome of possiveisNomes){
    if(obj[nome] !== undefined && obj[nome] !== "") return obj[nome];
  }
  return "";
}

function calcularCSAT(satisfacao){
  const validas = satisfacao.filter(x => pegarCampo(x, ["Nota", "nota", "Avaliação", "Avaliacao"]));
  const promotores = validas.filter(x => numero(pegarCampo(x, ["Nota", "nota", "Avaliação", "Avaliacao"])) >= 4);

  return {
    total: validas.length,
    promotores: promotores.length,
    percentual: validas.length ? (promotores.length / validas.length) * 100 : 0
  };
}

function criarCard(titulo, valor, subtitulo = ""){
  return `
    <div class="card">
      <div class="card-title">${titulo}</div>
      <div class="card-value">${valor}</div>
      ${subtitulo ? `<div style="font-size:12px;color:#64748b;margin-top:6px;">${subtitulo}</div>` : ""}
    </div>
  `;
}

function renderCards(dados){
  const { mop, satisfacao, blip, agent } = dados;
  const csat = calcularCSAT(satisfacao);

  const ticketsUnicos = new Set(
    agent.map(x => pegarCampo(x, ["SequentialId", "TicketId", "Id", "ID"])).filter(Boolean)
  ).size;

  const operadores = new Set(
    agent.map(x => pegarCampo(x, ["AgentName", "Atendente", "Operador", "Colaborador"])).filter(Boolean)
  ).size;

  const volume = ticketsUnicos || agent.length;
  const produtividade = operadores ? volume / operadores : 0;

  document.getElementById("cards").innerHTML =
    criarCard("Volume", volume.toLocaleString("pt-BR"), "Tickets encontrados na base Agent") +
    criarCard("CSAT", `${csat.percentual.toFixed(1)}%`, `${csat.promotores}/${csat.total} avaliações 4 e 5`) +
    criarCard("Operadores", operadores.toLocaleString("pt-BR"), "Operadores únicos na base Agent") +
    criarCard("Produtividade", produtividade.toFixed(0), "Tickets por operador") +
    criarCard("MOP", mop.length.toLocaleString("pt-BR"), "Linhas carregadas") +
    criarCard("Blip", blip.length.toLocaleString("pt-BR"), "Linhas carregadas");
}

function renderRanking(agent){
  const ranking = {};

  agent.forEach(item => {
    const agente = pegarCampo(item, ["AgentName", "Atendente", "Operador", "Colaborador"]) || "N/D";
    const id = pegarCampo(item, ["SequentialId", "TicketId", "Id", "ID"]) || Math.random().toString();
    if(!ranking[agente]) ranking[agente] = new Set();
    ranking[agente].add(id);
  });

  const ordenado = Object.entries(ranking)
    .map(([nome, ids]) => [nome, ids.size])
    .sort((a,b) => b[1] - a[1])
    .slice(0, 15);

  document.getElementById("ranking").innerHTML = ordenado.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item[0]}</td>
      <td>${item[1].toLocaleString("pt-BR")}</td>
    </tr>
  `).join("");
}

function renderStatus(agent){
  const status = {};

  agent.forEach(item => {
    const st = pegarCampo(item, ["Status", "status", "Situação", "Situacao"]) || "N/D";
    status[st] = (status[st] || 0) + 1;
  });

  document.getElementById("status").innerHTML = Object.entries(status)
    .sort((a,b) => b[1] - a[1])
    .map(([nome, qtd]) => `
      <div class="status-item">
        <span>${nome}</span>
        <strong>${qtd.toLocaleString("pt-BR")}</strong>
      </div>
    `).join("");
}

function renderAlertas(dados){
  const csat = calcularCSAT(dados.satisfacao);
  let html = "";

  if(csat.percentual < 80){
    html += `<div class="alert">CSAT abaixo de 80%: ${csat.percentual.toFixed(1)}%</div>`;
  }

  if(!dados.agent.length){
    html += `<div class="alert">Base Agent não retornou dados.</div>`;
  }

  if(!dados.satisfacao.length){
    html += `<div class="alert">Base de satisfação não retornou dados.</div>`;
  }

  document.getElementById("alertas").innerHTML = html || `<div class="ok">Todos os indicadores básicos carregaram corretamente.</div>`;
}

function renderBases(dados){
  document.getElementById("bases").innerHTML = `
    <div class="status-item"><span>MOP</span><strong>${dados.mop.length}</strong></div>
    <div class="status-item"><span>Satisfação</span><strong>${dados.satisfacao.length}</strong></div>
    <div class="status-item"><span>Blip</span><strong>${dados.blip.length}</strong></div>
    <div class="status-item"><span>Agent</span><strong>${dados.agent.length}</strong></div>
  `;
}

function mostrarErro(erro){
  const div = document.getElementById("erro");
  div.style.display = "block";
  div.textContent = erro.message || String(erro);
  document.getElementById("cards").innerHTML = "";
}

async function iniciar(){
  try{
    const [mop, satisfacao, blip, agent] = await Promise.all([
      carregarCSV("MOP", urls.mop),
      carregarCSV("Satisfação", urls.satisfacao),
      carregarCSV("Blip", urls.blip),
      carregarCSV("Agent", urls.agent)
    ]);

    const dados = { mop, satisfacao, blip, agent };

    renderCards(dados);
    renderRanking(agent);
    renderStatus(agent);
    renderAlertas(dados);
    renderBases(dados);

    console.log("Dados carregados:", dados);
  } catch(erro){
    mostrarErro(erro);
    console.error(erro);
  }
}

iniciar();
