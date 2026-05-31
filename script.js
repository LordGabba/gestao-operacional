// ============================================================
// script.js - Sistema de Gestão Operacional
// Lógica principal de interface e operações
// ============================================================

// ============================================================
// ESTADO GLOBAL
// ============================================================
const APP = {
  pagina: 'dashboard',
  config: {},
  dados: {
    colaboradores: [],
    staff: [],
    escalas: [],
    programacoes: [],
    performance: { mop: [], atendimento: [], csat: [], agentHistory: [] },
  },
  paginacao: {
    colaboradores: { pagina: 1, porPagina: 20 },
    staff: { pagina: 1, porPagina: 20 },
    escalas: { pagina: 1, porPagina: 20 },
    programacoes: { pagina: 1, porPagina: 20 },
  },
  filtros: {
    colaboradores: {},
    staff: {},
    escalas: {},
    programacoes: {},
    performance: {},
  },
  busca: '',
  editandoId: null,
  calendarioData: new Date(),
  tema: localStorage.getItem('tema') || 'claro',
  sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  aplicarTema(APP.tema);
  if (APP.sidebarCollapsed) toggleSidebar(false);
  const autenticado = await Auth.inicializar();
  if (!autenticado) {
    mostrarLoader(false);
    return;
  }
  Security.inicializar();
  await inicializarApp();
});

async function inicializarApp() {
  mostrarLoader(true);
  try {
    APP.config = await DB.configuracoes.listar();
    const paginaInicial = Permissions.getDefaultPage();
    navegarPara(paginaInicial);
    configurarEventos();
    configurarRealtime();
    Security.aplicarRestricoesVisuais();
    mostrarLoader(false);
  } catch (e) {
    mostrarLoader(false);
    toast('Erro ao conectar com o banco de dados. Verifique as configurações.', 'error');
    console.error(e);
  }
}

// ============================================================
// LOADER
// ============================================================
function mostrarLoader(show) {
  const el = document.getElementById('global-loader');
  if (!el) return;
  if (show) { el.classList.remove('hidden'); }
  else { setTimeout(() => el.classList.add('hidden'), 400); }
}

// ============================================================
// TEMA
// ============================================================
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema === 'escuro' ? 'dark' : '');
  APP.tema = tema;
  localStorage.setItem('tema', tema);
  const btn = document.getElementById('btn-tema');
  if (btn) btn.textContent = tema === 'escuro' ? '☀️' : '🌙';
}

function toggleTema() {
  aplicarTema(APP.tema === 'escuro' ? 'claro' : 'escuro');
}

// ============================================================
// SIDEBAR
// ============================================================
function toggleSidebar(salvar = true) {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');
  APP.sidebarCollapsed = !APP.sidebarCollapsed;
  sidebar.classList.toggle('collapsed', APP.sidebarCollapsed);
  main.classList.toggle('sidebar-collapsed', APP.sidebarCollapsed);
  if (salvar) localStorage.setItem('sidebarCollapsed', APP.sidebarCollapsed);
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('visible');
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function navegarPara(pagina) {
  if (!Security.protegerPaginaAtual(pagina)) {
    pagina = Permissions.getDefaultPage();
    if (!Security.protegerPaginaAtual(pagina)) return;
  }
  APP.pagina = pagina;
  // Atualiza nav items
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pagina);
  });
  // Atualiza páginas
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${pagina}`);
  });
  // Breadcrumb
  const labels = {
    dashboard: 'Dashboard', colaboradores: 'Colaboradores', staff: 'Staff / Liderança',
    escalas: 'Escalas', programacoes: 'Programações', ferias: 'Férias',
    relatorios: 'Relatórios', performance: 'Performance Operacional',
    importacao: 'Importação em Massa', configuracoes: 'Configurações'
  };
  const el = document.getElementById('breadcrumb-page');
  if (el) el.textContent = labels[pagina] || pagina;
  carregarPagina(pagina);
  // Fecha sidebar mobile
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

async function carregarPagina(pagina) {
  if (!Security.protegerPaginaAtual(pagina)) return;
  switch (pagina) {
    case 'dashboard': await carregarDashboard(); break;
    case 'colaboradores': await carregarColaboradores(); break;
    case 'staff': await carregarStaff(); break;
    case 'escalas': await carregarEscalas(); break;
    case 'programacoes': await carregarProgramacoes(); break;
    case 'ferias': await carregarFerias(); break;
    case 'relatorios': await carregarRelatorios(); break;
    case 'performance': await carregarPerformanceOperacional(); break;
    case 'importacao': carregarImportacao(); break;
    case 'configuracoes': await carregarConfiguracoes(); break;
  }
  Security.aplicarRestricoesVisuais();
}

// ============================================================
// EVENTOS GERAIS
// ============================================================
function configurarEventos() {
  // Busca global no topbar
  const searchInput = document.getElementById('topbar-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(e => {
      APP.busca = e.target.value;
      if (APP.pagina === 'colaboradores') renderizarTabelaColaboradores();
      if (APP.pagina === 'staff') renderizarTabelaStaff();
    }, 300));
  }
}

// ============================================================
// REALTIME
// ============================================================
function configurarRealtime() {
  DB.assinarTabela('colaboradores', async () => {
    if (APP.pagina === 'colaboradores' || APP.pagina === 'dashboard') {
      APP.dados.colaboradores = await DB.colaboradores.listar(APP.filtros.colaboradores);
      renderizarTabelaColaboradores();
      if (APP.pagina === 'dashboard') carregarDashboard();
    }
  });
  DB.assinarTabela('programacoes', async () => {
    if (APP.pagina === 'programacoes' || APP.pagina === 'dashboard') {
      await carregarPagina(APP.pagina);
    }
  });
}

// ============================================================
// DASHBOARD
// ============================================================
async function carregarDashboard() {
  const container = document.getElementById('dashboard-stats');
  if (!container) return;
  container.innerHTML = '<div class="loading-inline"><div class="spinner"></div> Carregando...</div>';
  try {
    const [total, ativos, ferias, dayoff] = await Promise.all([
      DB.colaboradores.contar(),
      DB.colaboradores.contarPorStatus('Ativo'),
      DB.colaboradores.contarPorStatus('Férias'),
      DB.colaboradores.contarPorStatus('Day Off'),
    ]);
    const programacoesPendentes = (await DB.programacoes.listar({ status: 'Pendente' })).length;
    container.innerHTML = `
      <div class="stat-card"><div class="stat-icon blue">👥</div><div class="stat-info"><div class="stat-value">${total}</div><div class="stat-label">Total Colaboradores</div></div></div>
      <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><div class="stat-value">${ativos}</div><div class="stat-label">Ativos</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">🏖️</div><div class="stat-info"><div class="stat-value">${ferias}</div><div class="stat-label">Em Férias</div></div></div>
      <div class="stat-card"><div class="stat-icon blue">☕</div><div class="stat-info"><div class="stat-value">${dayoff}</div><div class="stat-label">Day Off</div></div></div>
      <div class="stat-card"><div class="stat-icon red">⏳</div><div class="stat-info"><div class="stat-value">${programacoesPendentes}</div><div class="stat-label">Prog. Pendentes</div></div></div>
    `;

    // Carregar lista recente
    const recentes = await DB.colaboradores.listar({ status: 'Ativo' });
    const listEl = document.getElementById('dashboard-recentes');
    if (listEl) {
      listEl.innerHTML = recentes.slice(0, 8).map(c => `
        <tr>
          <td>${c.matricula || '-'}</td>
          <td>${c.nome}</td>
          <td>${c.celula || '-'}</td>
          <td>${c.horario || '-'}</td>
          <td>${badgeStatus(c.status)}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="text-muted text-center">Nenhum colaborador</td></tr>';
    }

    // Distribuição por célula
    const celulas = {};
    recentes.forEach(c => { if (c.celula) celulas[c.celula] = (celulas[c.celula] || 0) + 1; });
    renderizarGraficoCelulas(celulas);

  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro ao carregar</div><div class="empty-desc">${e.message}</div></div>`;
  }
}

function renderizarGraficoCelulas(celulas) {
  const el = document.getElementById('chart-celulas');
  if (!el) return;
  const max = Math.max(...Object.values(celulas), 1);
  el.innerHTML = Object.entries(celulas).map(([nome, qtd]) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:90px;font-size:12px;color:var(--text2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nome}</div>
      <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
        <div style="width:${(qtd/max)*100}%;height:100%;background:var(--primary);border-radius:4px;transition:width 0.5s ease"></div>
      </div>
      <div style="width:24px;font-size:12px;font-weight:600">${qtd}</div>
    </div>
  `).join('') || '<p class="text-muted text-sm">Sem dados</p>';
}

// ============================================================
// COLABORADORES
// ============================================================
async function carregarColaboradores() {
  APP.dados.colaboradores = await carregarComLoading('tabela-colaboradores', () =>
    DB.colaboradores.listar(APP.filtros.colaboradores)
  );
  preencherFiltrosColaboradores();
  renderizarTabelaColaboradores();
}

function renderizarTabelaColaboradores() {
  const tbody = document.getElementById('tabela-colaboradores');
  if (!tbody) return;
  Security.aplicarRestricoesVisuais();

  let dados = filtrarDados(APP.dados.colaboradores, APP.filtros.colaboradores, APP.busca);
  const pag = APP.paginacao.colaboradores;
  const total = dados.length;
  const inicio = (pag.pagina - 1) * pag.porPagina;
  const slice = dados.slice(inicio, inicio + pag.porPagina);

  tbody.innerHTML = slice.length ? slice.map(c => `
    <tr>
      <td><input type="checkbox" class="row-check" data-id="${c.id}"></td>
      <td class="font-mono text-sm">${c.matricula || '-'}</td>
      <td><strong>${c.nome}</strong></td>
      <td>${c.celula || '-'}</td>
      <td>${c.grupo || '-'}</td>
      <td>${c.cargo || '-'}</td>
      <td>${c.horario || '-'}</td>
      <td>${c.escala || '-'}</td>
      <td>${c.filial || '-'}</td>
      <td>${c.supervisor || '-'}</td>
      <td>${c.admissao ? formatarData(c.admissao) : '-'}</td>
      <td>${c.tempo_meses != null ? c.tempo_meses + ' m' : '-'}</td>
      <td>${badgeStatus(c.status)}</td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn edit" onclick="abrirModalColaborador(${c.id})" title="Editar">✏️</button>
          <button class="table-action-btn del" onclick="confirmarExclusao('colaboradores',${c.id},'${c.nome}')" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="14"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Nenhum colaborador encontrado</div></div></td></tr>`;

  renderizarPaginacao('colaboradores', total, pag);
  atualizarContadorSelecao();
  Security.aplicarRestricoesVisuais();
}

function filtrarDados(dados, filtros, busca) {
  return dados.filter(d => {
    if (busca && !JSON.stringify(d).toLowerCase().includes(busca.toLowerCase())) return false;
    for (const [k, v] of Object.entries(filtros)) {
      if (v && d[k] !== v) return false;
    }
    return true;
  });
}

function preencherFiltrosColaboradores() {
  // Status
  preencherSelectFiltro('filtro-col-status', extrairUnicos(APP.dados.colaboradores, 'status'), APP.filtros.colaboradores.status);
  preencherSelectFiltro('filtro-col-celula', extrairUnicos(APP.dados.colaboradores, 'celula'), APP.filtros.colaboradores.celula);
  preencherSelectFiltro('filtro-col-grupo', extrairUnicos(APP.dados.colaboradores, 'grupo'), APP.filtros.colaboradores.grupo);
  preencherSelectFiltro('filtro-col-filial', extrairUnicos(APP.dados.colaboradores, 'filial'), APP.filtros.colaboradores.filial);
}

function preencherSelectFiltro(id, opcoes, valorAtual) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = el.value || valorAtual || '';
  el.innerHTML = '<option value="">Todos</option>' + opcoes.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('');
}

function extrairUnicos(dados, campo) {
  return [...new Set(dados.map(d => d[campo]).filter(Boolean))].sort();
}

function filtrarColaboradores() {
  APP.filtros.colaboradores = {
    status: document.getElementById('filtro-col-status')?.value || '',
    celula: document.getElementById('filtro-col-celula')?.value || '',
    grupo: document.getElementById('filtro-col-grupo')?.value || '',
    filial: document.getElementById('filtro-col-filial')?.value || '',
  };
  APP.paginacao.colaboradores.pagina = 1;
  renderizarTabelaColaboradores();
}

// ============================================================
// MODAL COLABORADOR
// ============================================================
async function abrirModalColaborador(id = null) {
  if (!Security.requirePermission(id ? 'editar_colaborador' : 'cadastrar_colaborador')) return;
  APP.editandoId = id;
  const modal = document.getElementById('modal-colaborador');
  const title = document.getElementById('modal-col-title');
  if (!modal) return;

  if (id) {
    title.textContent = 'Editar Colaborador';
    try {
      const dados = await DB.colaboradores.buscarPorId(id);
      preencherFormularioColaborador(dados);
    } catch (e) { toast('Erro ao carregar dados', 'error'); return; }
  } else {
    title.textContent = 'Novo Colaborador';
    document.getElementById('form-colaborador')?.reset();
  }
  abrirModal('modal-colaborador');
}

function preencherFormularioColaborador(dados) {
  const form = document.getElementById('form-colaborador');
  if (!form) return;
  Object.entries(dados).forEach(([k, v]) => {
    const el = form.querySelector(`[name="${k}"]`);
    if (el && v !== null && v !== undefined) el.value = v;
  });
}

async function salvarColaborador() {
  if (!Security.requirePermission(APP.editandoId ? 'editar_colaborador' : 'cadastrar_colaborador')) return;
  const form = document.getElementById('form-colaborador');
  if (!form) return;
  const dados = Object.fromEntries(new FormData(form));
  // Validações
  if (!dados.nome?.trim()) { toast('Nome é obrigatório', 'error'); return; }
  if (dados.cpf && !validarCPF(dados.cpf)) { toast('CPF inválido', 'error'); return; }

  const btn = document.getElementById('btn-salvar-colaborador');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    if (APP.editandoId) {
      await DB.colaboradores.atualizar(APP.editandoId, dados);
      toast('Colaborador atualizado com sucesso', 'success');
    } else {
      await DB.colaboradores.criar(dados);
      toast('Colaborador cadastrado com sucesso', 'success');
    }
    fecharModal('modal-colaborador');
    await carregarColaboradores();
  } catch (e) {
    toast('Erro ao salvar: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
}

// ============================================================
// STAFF
// ============================================================
async function carregarStaff() {
  APP.dados.staff = await carregarComLoading('tabela-staff', () =>
    DB.staff.listar(APP.filtros.staff)
  );
  renderizarTabelaStaff();
}

function renderizarTabelaStaff() {
  const tbody = document.getElementById('tabela-staff');
  if (!tbody) return;
  let dados = filtrarDados(APP.dados.staff, APP.filtros.staff, APP.busca);
  const pag = APP.paginacao.staff;
  const total = dados.length;
  const slice = dados.slice((pag.pagina - 1) * pag.porPagina, pag.pagina * pag.porPagina);

  tbody.innerHTML = slice.length ? slice.map(s => `
    <tr>
      <td class="font-mono text-sm">${s.matricula || '-'}</td>
      <td><strong>${s.nome}</strong></td>
      <td>${s.cargo || '-'}</td>
      <td>${s.nivel_hierarquico || '-'}</td>
      <td>${s.celula || '-'}</td>
      <td>${s.equipe_responsavel || '-'}</td>
      <td>${s.quantidade_colaboradores || 0}</td>
      <td>${s.tipo_lideranca || '-'}</td>
      <td>${badgeStatus(s.status)}</td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn edit" onclick="abrirModalStaff(${s.id})" title="Editar">✏️</button>
          <button class="table-action-btn del" onclick="confirmarExclusao('staff',${s.id},'${s.nome}')" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">👔</div><div class="empty-title">Nenhum staff encontrado</div></div></td></tr>`;

  renderizarPaginacao('staff', total, pag);
  Security.aplicarRestricoesVisuais();
}

async function abrirModalStaff(id = null) {
  if (!Security.requirePermission(id ? 'editar_staff' : 'cadastrar_staff')) return;
  APP.editandoId = id;
  const title = document.getElementById('modal-staff-title');
  if (id) {
    title.textContent = 'Editar Staff';
    try {
      const dados = await DB.staff.buscarPorId(id);
      const form = document.getElementById('form-staff');
      Object.entries(dados).forEach(([k, v]) => {
        const el = form?.querySelector(`[name="${k}"]`);
        if (el && v !== null) el.value = v;
      });
    } catch (e) { toast('Erro ao carregar dados', 'error'); return; }
  } else {
    title.textContent = 'Novo Staff';
    document.getElementById('form-staff')?.reset();
  }
  abrirModal('modal-staff');
}

async function salvarStaff() {
  if (!Security.requirePermission(APP.editandoId ? 'editar_staff' : 'cadastrar_staff')) return;
  const form = document.getElementById('form-staff');
  if (!form) return;
  const dados = Object.fromEntries(new FormData(form));
  if (!dados.nome?.trim()) { toast('Nome é obrigatório', 'error'); return; }
  try {
    if (APP.editandoId) {
      await DB.staff.atualizar(APP.editandoId, dados);
      toast('Staff atualizado', 'success');
    } else {
      await DB.staff.criar(dados);
      toast('Staff cadastrado', 'success');
    }
    fecharModal('modal-staff');
    await carregarStaff();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

// ============================================================
// ESCALAS
// ============================================================
async function carregarEscalas() {
  const hoje = new Date();
  APP.calendarioData = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  APP.dados.colaboradores = await DB.colaboradores.listar({ status: 'Ativo' });
  if (Security.isAgente()) {
    const colaboradorId = Security.getColaboradorLogadoId();
    APP.filtros.escalas.colaborador_id = colaboradorId ? String(colaboradorId) : '';
  }
  preencherFiltrosEscalas();
  await renderizarCalendario();
}

function preencherFiltrosEscalas() {
  const colabSel = document.getElementById('filtro-escala-colaborador');
  const reporteSel = document.getElementById('filtro-escala-reporte');
  const colaboradores = APP.dados.colaboradores || [];

  if (colabSel) {
    const atual = colabSel.value;
    colabSel.innerHTML = '<option value="">Todos colaboradores</option>' +
      colaboradores.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    colabSel.value = atual || APP.filtros.escalas.colaborador_id || '';
  }

  if (reporteSel) {
    const atual = reporteSel.value;
    const reportes = [...new Set(colaboradores.map(c => c.reporte).filter(Boolean))].sort();
    reporteSel.innerHTML = '<option value="">Todos reportes</option>' +
      reportes.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    reporteSel.value = atual || APP.filtros.escalas.reporte || '';
  }
}

function aplicarFiltroEscalas(campo, valor) {
  APP.filtros.escalas[campo] = valor;
  renderizarCalendario();
}

async function renderizarCalendario() {
  const container = document.getElementById('calendario-grid');
  if (!container) return;
  const ano = APP.calendarioData.getFullYear();
  const mes = APP.calendarioData.getMonth();
  const label = document.getElementById('calendario-mes-label');
  if (label) {
    label.textContent = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();

  // Buscar escalas do mês
  const dataInicio = `${ano}-${String(mes+1).padStart(2,'0')}-01`;
  const dataFim = `${ano}-${String(mes+1).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`;
  let escalas = await DB.escalas.listar({
    data_inicio: dataInicio,
    data_fim: dataFim,
    colaborador_id: APP.filtros.escalas.colaborador_id || ''
  });

  if (APP.filtros.escalas.reporte) {
    const idsReporte = (APP.dados.colaboradores || [])
      .filter(c => c.reporte === APP.filtros.escalas.reporte)
      .map(c => String(c.id));
    escalas = escalas.filter(e => idsReporte.includes(String(e.colaborador_id)));
  }

  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let html = dias.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

  // Dias do mês anterior
  for (let i = 0; i < primeiroDia; i++) {
    html += `<div class="calendar-day other-month"></div>`;
  }
  // Dias do mês
  for (let d = 1; d <= ultimoDia; d++) {
    const dataStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isHoje = hoje.getFullYear()===ano && hoje.getMonth()===mes && hoje.getDate()===d;
    const escalasHoje = escalas.filter(e => e.data === dataStr);
    const evHtml = escalasHoje.slice(0,3).map(e => {
      const cor = e.cor || corTipoEscala(e.tipo_alteracao);
      return `<div class="calendar-event" style="background:${cor}20;color:${cor}">${e.colaborador_nome || 'Colaborador'}</div>`;
    }).join('');
    html += `
      <div class="calendar-day ${isHoje ? 'today' : ''}" onclick="abrirDiaEscala('${dataStr}')">
        <div class="calendar-date">${d}${escalasHoje.length > 3 ? `<span style="color:var(--primary);margin-left:4px">+${escalasHoje.length-3}</span>` : ''}</div>
        ${evHtml}
      </div>`;
  }
  container.innerHTML = html;
  Security.aplicarRestricoesVisuais();
}

function corTipoEscala(tipo) {
  const cores = {
    'Férias': '#f59e0b', 'Day Off': '#3b82f6', 'Folga': '#10b981',
    'Treinamento': '#6366f1', 'Home Office': '#8b5cf6', 'Licença': '#ef4444',
    'Normal': '#6b7280'
  };
  return cores[tipo] || '#6b7280';
}

async function abrirDiaEscala(data) {
  let escalas = await DB.escalas.listar({
    data_inicio: data,
    data_fim: data,
    colaborador_id: APP.filtros.escalas.colaborador_id || ''
  });
  if (APP.filtros.escalas.reporte) {
    const idsReporte = (APP.dados.colaboradores || [])
      .filter(c => c.reporte === APP.filtros.escalas.reporte)
      .map(c => String(c.id));
    escalas = escalas.filter(e => idsReporte.includes(String(e.colaborador_id)));
  }
  const modal = document.getElementById('modal-dia-escala');
  const title = document.getElementById('modal-dia-title');
  const body = document.getElementById('modal-dia-body');
  if (!modal) return;
  title.textContent = `Escalas — ${formatarData(data)}`;
  body.innerHTML = escalas.length ? `
    <div style="margin-bottom:12px;display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" onclick="abrirModalNovaEscala('${data}')">+ Nova Escala</button>
    </div>
    <div class="table-wrapper">
    <table class="table">
      <thead><tr><th>Colaborador</th><th>Entrada</th><th>Saída</th><th>Pausa 1</th><th>Pausa 2</th><th>Tipo</th><th>Obs</th><th></th></tr></thead>
      <tbody>
        ${escalas.map(e => `
          <tr>
            <td>${e.colaborador_nome || '-'}</td>
            <td>${e.entrada || e.horario || '-'}</td>
            <td>${e.saida || '-'}</td>
            <td>${e.pausa1 || '-'}</td>
            <td>${e.pausa2 || '-'}</td>
            <td>${badgeEscala(e.tipo_alteracao)}</td>
            <td class="text-sm text-muted">${e.observacao || '-'}</td>
            <td><button class="table-action-btn del" onclick="excluirEscala(${e.id})">🗑️</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  ` : `
    <div class="empty-state">
      <div class="empty-icon">📅</div>
      <div class="empty-title">Nenhuma escala neste dia</div>
    </div>
    <div style="text-align:center;margin-top:12px">
      <button class="btn btn-primary" onclick="abrirModalNovaEscala('${data}')">+ Adicionar Escala</button>
    </div>
  `;
  abrirModal('modal-dia-escala');
  Security.aplicarRestricoesVisuais();
}

async function abrirModalNovaEscala(data = '') {
  if (!Security.requirePermission('cadastrar_escala')) return;
  fecharModal('modal-dia-escala');
  document.getElementById('esc-data').value = data;
  // Carregar colaboradores no select
  const sel = document.getElementById('esc-colaborador');
  if (sel) {
    const colaboradores = await DB.colaboradores.listar({ status: 'Ativo' });
    sel.innerHTML = '<option value="">Selecione...</option>' +
      colaboradores.map(c => `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`).join('');
  }
  abrirModal('modal-nova-escala');
}


function minutosDoHorario(valor) {
  const match = String(valor || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return null;
  return horas * 60 + minutos;
}

function obterIntervaloHorario(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return null;
  const match = texto.match(/(\d{1,2}:\d{2})\s*(?:-|às|a|ate|até)\s*(\d{1,2}:\d{2})/i);
  if (!match) return null;
  return {
    inicioTexto: match[1],
    fimTexto: match[2],
    inicio: minutosDoHorario(match[1]),
    fim: minutosDoHorario(match[2])
  };
}

function validarAlmocoPorEntrada(entrada, almoco) {
  if (!String(almoco || '').trim()) return { ok: true };
  if (!String(entrada || '').trim()) {
    return { ok: false, mensagem: 'Informe a Entrada antes de preencher o Almoço.' };
  }

  const entradaMin = minutosDoHorario(entrada);
  const intervalo = obterIntervaloHorario(almoco);

  if (entradaMin === null) {
    return { ok: false, mensagem: 'Entrada inválida. Use o formato HH:MM.' };
  }

  if (!intervalo || intervalo.inicio === null || intervalo.fim === null) {
    return { ok: false, mensagem: 'Almoço inválido. Use o formato 12:00-13:00.' };
  }

  if (intervalo.fim <= intervalo.inicio) {
    return { ok: false, mensagem: 'O horário final do Almoço deve ser maior que o inicial.' };
  }

  const limiteInicio = entradaMin + 5 * 60;
  const limiteFim = entradaMin + 6 * 60;

  if (intervalo.inicio > limiteInicio || intervalo.fim > limiteFim) {
    const hh = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return {
      ok: false,
      mensagem: `Almoço fora do limite. Para entrada ${entrada}, use no máximo ${hh(limiteInicio)}-${hh(limiteFim)}.`
    };
  }

  return { ok: true };
}

async function salvarEscala() {
  if (!Security.requirePermission('cadastrar_escala')) return;
  const form = document.getElementById('form-nova-escala');
  const dados = Object.fromEntries(new FormData(form));
  if (!dados.colaborador_id) { toast('Selecione um colaborador', 'error'); return; }
  if (!dados.data) { toast('Data inicial é obrigatória', 'error'); return; }

  const validacaoAlmoco = validarAlmocoPorEntrada(dados.entrada, dados.almoco);
  if (!validacaoAlmoco.ok) { toast(validacaoAlmoco.mensagem, 'error'); return; }

  const sel = document.getElementById('esc-colaborador');
  const opt = sel.querySelector(`option[value="${dados.colaborador_id}"]`);
  dados.colaborador_nome = opt?.dataset.nome || '';

  const dataInicio = dados.data;
  const dataFim = dados.data_fim || dados.data;
  const sabado = !!dados.folga_sabado;
  const domingo = !!dados.folga_domingo;

  delete dados.data_fim;
  delete dados.folga_sabado;
  delete dados.folga_domingo;

  dados.hora_extra = dados.hora_extra === '' ? null : Number(dados.hora_extra || 0);

  try {
    const registros = gerarRegistrosEscala(dados, dataInicio, dataFim, sabado, domingo);

    if (!registros.length) {
      toast('Nenhuma data válida no período selecionado', 'warning');
      return;
    }

    await DB.escalas.importarLote(registros);
    toast(`${registros.length} escala(s) adicionada(s)`, 'success');
    fecharModal('modal-nova-escala');
    await renderizarCalendario();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

function gerarRegistrosEscala(base, dataInicio, dataFim, somenteSabado, somenteDomingo) {
  const registros = [];
  const inicio = new Date(`${dataInicio}T00:00:00`);
  const fim = new Date(`${dataFim}T00:00:00`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) {
    return [];
  }

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const diaSemana = d.getDay();
    const filtrarFimDeSemana = somenteSabado || somenteDomingo;

    if (filtrarFimDeSemana && !((somenteSabado && diaSemana === 6) || (somenteDomingo && diaSemana === 0))) {
      continue;
    }

    registros.push({
      ...base,
      data: d.toISOString().slice(0, 10),
      tipo_alteracao: filtrarFimDeSemana ? 'Folga' : (base.tipo_alteracao || 'Normal'),
      status: filtrarFimDeSemana ? 'Folga' : (base.status || 'Normal')
    });
  }

  return registros;
}

async function excluirEscala(id) {
  if (!Security.requirePermission('excluir_escala')) return;
  if (!confirm('Excluir esta escala?')) return;
  try {
    await DB.escalas.excluir(id);
    toast('Escala excluída', 'success');
    fecharModal('modal-dia-escala');
    await renderizarCalendario();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

function mesAnterior() {
  APP.calendarioData.setMonth(APP.calendarioData.getMonth() - 1);
  renderizarCalendario();
}

function selecionarArquivoEscalas() {
  if (!Security.requirePermission('importar_escala')) return;
  const input = document.getElementById('escala-file-input');
  if (input) input.click();
}

async function processarArquivoEscalas(file) {
  if (!Security.requirePermission('importar_escala')) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    toast('Formato inválido. Use CSV ou Excel.', 'error');
    return;
  }

  toast('Processando escalas...', 'info');
  const reader = new FileReader();

  reader.onload = async e => {
    try {
      let dados = [];
      if (ext === 'csv') {
        dados = parsearCSV(e.target.result);
      } else {
        if (typeof XLSX === 'undefined') {
          toast('Biblioteca XLSX não carregada. Exporte como CSV ou confira o index.html.', 'error');
          return;
        }
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        dados = XLSX.utils.sheet_to_json(ws, { defval: '' });
      }

      await importarEscalasEmMassa(dados);
    } catch (err) {
      toast('Erro ao importar escalas: ' + err.message, 'error');
    } finally {
      const input = document.getElementById('escala-file-input');
      if (input) input.value = '';
    }
  };

  if (ext === 'csv') reader.readAsText(file);
  else reader.readAsBinaryString(file);
}

async function importarEscalasEmMassa(dados) {
  if (!Security.requirePermission('importar_escala')) return;
  if (!dados?.length) {
    toast('Nenhuma escala encontrada no arquivo', 'warning');
    return;
  }

  const get = (obj, nomes) => {
    const normalizar = s => String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/^\ufeff/, '');

    const mapa = Object.fromEntries(
      Object.keys(obj).map(k => [normalizar(k), k])
    );

    for (const nome of nomes) {
      const chave = mapa[normalizar(nome)];
      if (chave && String(obj[chave] ?? '').trim() !== '') {
        return String(obj[chave]).trim();
      }
    }
    return '';
  };

  const colaboradores = APP.dados.colaboradores?.length
    ? APP.dados.colaboradores
    : await DB.colaboradores.listar({ status: 'Ativo' });

  const buscarColaborador = row => {
    const matricula = get(row, ['matricula', 'Matrícula', 'MATRICULA']);
    const nome = get(row, ['nome', 'colaborador', 'Colaborador']);
    return colaboradores.find(c =>
      (matricula && String(c.matricula || '').trim() === matricula) ||
      (nome && String(c.nome || '').trim().toLowerCase() === nome.toLowerCase())
    );
  };

  let registros = [];

  dados.forEach(row => {
    const colab = buscarColaborador(row);

    const dataInicio = normalizarData(get(row, ['data', 'Data', 'DATA']));
    const dataFim = normalizarData(get(row, ['data_fim', 'Data fim', 'Data Fim', 'DATA FIM'])) || dataInicio;

    const base = {
      colaborador_id: colab?.id || null,
      colaborador_nome: colab?.nome || get(row, ['nome', 'colaborador', 'Colaborador']),
      entrada: get(row, ['entrada', 'Entrada']),
      saida: get(row, ['saida', 'Saída', 'Saida']),
      almoco: get(row, ['almoco', 'Almoço', 'Almoco']),
      pausa1: get(row, ['pausa1', 'Pausa 1', 'Pausa1']),
      pausa2: get(row, ['pausa2', 'Pausa 2', 'Pausa2']),
      tipo_alteracao: get(row, ['tipo', 'Tipo', 'tipo_alteracao', 'Tipo alteração', 'Escala']) || 'Normal',
      observacao: get(row, ['observacao', 'Observação', 'Obs']),
      status: get(row, ['status', 'Status']) || 'Normal'
    };

    if (!base.colaborador_nome || !dataInicio) return;

    registros.push(...gerarRegistrosEscala(base, dataInicio, dataFim, false, false));
  });

  if (!registros.length) {
    toast('Nenhuma escala válida. Confira Colaborador, Data e Data fim.', 'error');
    return;
  }

  const almocoInvalido = registros.find(r => !validarAlmocoPorEntrada(r.entrada, r.almoco).ok);
  if (almocoInvalido) {
    const validacao = validarAlmocoPorEntrada(almocoInvalido.entrada, almocoInvalido.almoco);
    toast(`${almocoInvalido.colaborador_nome} em ${formatarData(almocoInvalido.data)}: ${validacao.mensagem}`, 'error');
    return;
  }

  await DB.escalas.importarLote(registros);
  toast(`${registros.length} escala(s) importada(s) com sucesso`, 'success');
  await renderizarCalendario();
}
function proxMes() {
  APP.calendarioData.setMonth(APP.calendarioData.getMonth() + 1);
  renderizarCalendario();
}

// ============================================================
// PROGRAMAÇÕES
// ============================================================
async function carregarProgramacoes() {
  APP.dados.programacoes = await carregarComLoading('tabela-programacoes', () =>
    DB.programacoes.listar(APP.filtros.programacoes)
  );
  renderizarTabelaProgramacoes();
}

function renderizarTabelaProgramacoes() {
  const tbody = document.getElementById('tabela-programacoes');
  if (!tbody) return;
  let dados = filtrarDados(APP.dados.programacoes, APP.filtros.programacoes, APP.busca);
  const pag = APP.paginacao.programacoes;
  const total = dados.length;
  const slice = dados.slice((pag.pagina - 1) * pag.porPagina, pag.pagina * pag.porPagina);

  tbody.innerHTML = slice.length ? slice.map(p => `
    <tr>
      <td>${p.colaborador_nome || '-'}</td>
      <td>${badgeEscala(p.tipo)}</td>
      <td>${formatarData(p.data_inicio)}</td>
      <td>${p.data_fim ? formatarData(p.data_fim) : '-'}</td>
      <td>${p.recorrente ? '🔄 Sim' : 'Não'}</td>
      <td>${p.motivo || '-'}</td>
      <td>${badgeProgramacaoStatus(p.status)}</td>
      <td>
        <div class="table-actions">
          ${p.status === 'Pendente' ? `<button class="table-action-btn" onclick="aprovarProgramacao(${p.id})" title="Aprovar" style="color:var(--success)">✅</button>` : ''}
          <button class="table-action-btn del" onclick="excluirProgramacao(${p.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Nenhuma programação</div></div></td></tr>`;

  renderizarPaginacao('programacoes', total, pag);
  Security.aplicarRestricoesVisuais();
}

async function abrirModalProgramacao() {
  if (!Security.requirePermission('cadastrar_programacao')) return;
  document.getElementById('form-programacao')?.reset();
  APP.editandoId = null;
  const sel = document.getElementById('prog-colaborador');
  if (sel) {
    const colaboradores = await DB.colaboradores.listar({ status: 'Ativo' });
    sel.innerHTML = '<option value="">Selecione...</option>' +
      colaboradores.map(c => `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`).join('');
  }
  abrirModal('modal-programacao');
}

async function salvarProgramacao() {
  if (!Security.requirePermission('cadastrar_programacao')) return;
  const form = document.getElementById('form-programacao');
  const dados = Object.fromEntries(new FormData(form));
  if (!dados.colaborador_id) { toast('Selecione um colaborador', 'error'); return; }
  if (!dados.tipo) { toast('Tipo é obrigatório', 'error'); return; }
  if (!dados.data_inicio) { toast('Data início é obrigatória', 'error'); return; }
  const sel = document.getElementById('prog-colaborador');
  const opt = sel?.querySelector(`option[value="${dados.colaborador_id}"]`);
  dados.colaborador_nome = opt?.dataset.nome || '';
  dados.recorrente = dados.recorrente === 'on';
  try {
    await DB.programacoes.criar(dados);
    toast('Programação criada', 'success');
    fecharModal('modal-programacao');
    await carregarProgramacoes();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function aprovarProgramacao(id) {
  if (!Security.requirePermission('aprovar_programacao')) return;
  try {
    await DB.programacoes.aprovar(id, 'Admin');
    toast('Programação aprovada', 'success');
    await carregarProgramacoes();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function excluirProgramacao(id) {
  if (!Security.requirePermission('excluir_programacao')) return;
  if (!confirm('Excluir esta programação?')) return;
  try {
    await DB.programacoes.excluir(id);
    toast('Excluída com sucesso', 'success');
    await carregarProgramacoes();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

// ============================================================
// FÉRIAS (filtragem do Colaboradores)
// ============================================================
async function carregarFerias() {
  const container = document.getElementById('tabela-ferias');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="8"><div class="loading-inline"><div class="spinner"></div> Carregando...</div></td></tr>';
  try {
    const todos = await DB.colaboradores.listar();
    const emFerias = todos.filter(c => c.status === 'Férias' || c.primeiro_dia_ferias);
    container.innerHTML = emFerias.length ? emFerias.map(c => `
      <tr>
        <td>${c.matricula || '-'}</td>
        <td><strong>${c.nome}</strong></td>
        <td>${c.celula || '-'}</td>
        <td>${c.supervisor || '-'}</td>
        <td>${c.primeiro_dia_ferias ? formatarData(c.primeiro_dia_ferias) : '-'}</td>
        <td>${c.ultimo_dia_ferias ? formatarData(c.ultimo_dia_ferias) : '-'}</td>
        <td>${diasFerias(c.primeiro_dia_ferias, c.ultimo_dia_ferias)}</td>
        <td>${badgeStatus(c.status)}</td>
      </tr>
    `).join('') : `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🏖️</div><div class="empty-title">Nenhum colaborador em férias</div></div></td></tr>`;
  } catch (e) { toast('Erro ao carregar férias', 'error'); }
}

function diasFerias(inicio, fim) {
  if (!inicio || !fim) return '-';
  const d1 = new Date(inicio), d2 = new Date(fim);
  const diff = Math.ceil((d2 - d1) / (1000*60*60*24)) + 1;
  return diff + ' dias';
}

// ============================================================
// RELATÓRIOS
// ============================================================
async function carregarRelatorios() {
  // Mostrar resumo básico
  const el = document.getElementById('relatorio-resumo');
  if (!el) return;
  try {
    const [total, ativos, ferias] = await Promise.all([
      DB.colaboradores.contar(),
      DB.colaboradores.contarPorStatus('Ativo'),
      DB.colaboradores.contarPorStatus('Férias'),
    ]);
    el.innerHTML = `
      <p>Total de colaboradores: <strong>${total}</strong></p>
      <p>Ativos: <strong>${ativos}</strong></p>
      <p>Em férias: <strong>${ferias}</strong></p>
    `;
  } catch (e) {}
}

async function gerarRelatorio(tipo) {
  if (!Security.requirePermission('exportar_relatorios')) return;
  toast('Gerando relatório...', 'info');
  try {
    let dados = [];
    let nome = tipo;
    switch (tipo) {
      case 'colaboradores': dados = await DB.colaboradores.listar(); nome = 'colaboradores'; break;
      case 'staff': dados = await DB.staff.listar(); nome = 'staff'; break;
      case 'escalas': dados = await DB.escalas.listar(); nome = 'escalas'; break;
      case 'programacoes': dados = await DB.programacoes.listar(); nome = 'programacoes'; break;
      case 'ferias':
        const todos = await DB.colaboradores.listar();
        dados = todos.filter(c => c.status === 'Férias' || c.primeiro_dia_ferias);
        nome = 'ferias';
        break;
    }
    exportarCSV(dados, nome);
    toast('Relatório exportado com sucesso!', 'success');
  } catch (e) { toast('Erro ao gerar relatório', 'error'); }
}

// ============================================================
// IMPORTAÇÃO EM MASSA
// ============================================================
function carregarImportacao() {
  configurarDropzone();
  Security.aplicarRestricoesVisuais();
}

function configurarDropzone() {
  if (!Security.verificarPermissao('importar_dados')) return;
  const dropzone = document.getElementById('dropzone-import');
  if (!dropzone) return;
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processarArquivoImportacao(file);
  });
  const input = document.getElementById('import-file-input');
  if (input) input.addEventListener('change', e => {
    if (e.target.files[0]) processarArquivoImportacao(e.target.files[0]);
  });
}

async function processarArquivoImportacao(file) {
  if (!Security.requirePermission('importar_dados')) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    toast('Formato inválido. Use CSV ou Excel.', 'error');
    return;
  }
  toast('Processando arquivo...', 'info');
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      let dados = [];
      if (ext === 'csv') {
        dados = parsearCSV(e.target.result);
      } else {
        // XLSX via SheetJS se disponível
        if (typeof XLSX !== 'undefined') {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          dados = XLSX.utils.sheet_to_json(ws);
        } else {
          toast('Para Excel, instale a lib XLSX ou exporte como CSV', 'warning');
          return;
        }
      }
      mostrarPreviewImportacao(dados);
    } catch (err) { toast('Erro ao processar: ' + err.message, 'error'); }
  };
  if (ext === 'csv') reader.readAsText(file);
  else reader.readAsBinaryString(file);
}

function parsearCSV(texto) {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return [];

  const primeiraLinha = linhas[0];
  const separador = primeiraLinha.includes(';') ? ';' : ',';
  const dividir = linha => linha
    .split(separador)
    .map(v => v.trim().replace(/^"|"$/g, ''));

  const headers = dividir(primeiraLinha);
  return linhas.slice(1).map(linha => {
    const valores = dividir(linha);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = valores[i] || ''; });
    return obj;
  });
}

function normalizarData(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }

  // Corrige data serial do Excel, mesmo quando vem como texto: "46174"
  if (
    typeof valor === 'number' ||
    /^\d{5}$/.test(String(valor).trim())
  ) {
    const numero = Number(String(valor).trim());
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + numero);
    return excelEpoch.toISOString().slice(0, 10);
  }

  const v = String(valor).trim();

  const iso = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const [, dia, mes, ano] = br;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  return null;
}

function mostrarPreviewImportacao(dados) {
  const preview = document.getElementById('import-preview');
  if (!preview) return;
  if (!dados.length) { toast('Nenhum dado encontrado', 'warning'); return; }
  const headers = Object.keys(dados[0]);
  preview.innerHTML = `
    <div class="card mt-4">
      <div class="card-header">
        <div class="card-title">Pré-visualização (${dados.length} registros)</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" onclick="confirmarImportacao(window._dadosImport)">
            ✅ Importar ${dados.length} registros
          </button>
          <button class="btn btn-secondary" onclick="document.getElementById('import-preview').innerHTML=''">Cancelar</button>
        </div>
      </div>
      <div class="table-wrapper" style="max-height:320px;overflow:auto">
        <table class="table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${dados.slice(0, 20).map(row => `<tr>${headers.map(h => `<td class="text-sm">${row[h] || ''}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${dados.length > 20 ? `<div style="padding:10px 16px;font-size:12px;color:var(--text2)">... e mais ${dados.length - 20} registros</div>` : ''}
    </div>
  `;
  window._dadosImport = dados;
}

async function confirmarImportacao(dados) {
  if (!Security.requirePermission('importar_dados')) return;
  if (!dados?.length) return;
  const destino = document.getElementById('import-destino')?.value || 'colaboradores';
  toast(`Importando ${dados.length} registros...`, 'info');
  try {
    // Mapear campos comuns
    const mapeados = dados.map(d => ({
      nome: d.nome || d.Colaborador || d.COLABORADOR || d.Nome || '',
      matricula: d.matricula || d.Matrícula || d.MATRICULA || '',
      email: d.email || d.Email || d.EMAIL || '',
      celula: d.celula || d.Célula || d.CELULA || '',
      status: d.status || d.Status || 'Ativo',
      cargo: d.cargo || d.Cargo || '',
      cpf: d.cpf || d.CPF || '',
      filial: d.filial || d.Filial || '',
      grupo: d.grupo || d.Grupo || '',
      horario: d.horario || d.Horário || d.Horario || '',
    })).filter(d => d.nome);

    if (destino === 'colaboradores') {
      await DB.colaboradores.importarLote(mapeados);
    } else if (destino === 'staff') {
      const { data, error } = await db.from('staff').upsert(mapeados, { onConflict: 'matricula' });
      if (error) throw error;
    }

    toast(`${mapeados.length} registros importados com sucesso!`, 'success');
    document.getElementById('import-preview').innerHTML = '';
    window._dadosImport = null;
  } catch (e) { toast('Erro na importação: ' + e.message, 'error'); }
}

// ============================================================
// PERFORMANCE OPERACIONAL
// ============================================================
const PERFORMANCE_METAS = {
  tme_segundos: 30 * 60,
  tm1r_segundos: 60,
  tmr_segundos: 3 * 60,
  tma_segundos: 20 * 60,
  csat: 85
};

window._performanceImportacao = { arquivos: {} };
let performanceHistoricoCarregamentoId = 0;
let performanceMesesCarregamentoId = 0;
let performanceDadosCarregamentoId = 0;

async function carregarPerformanceOperacional() {
  if (!Security.requirePermission('visualizar_performance_operacional')) return;
  const filtroMes = document.getElementById('performance-filtro-mes');
  const competenciaInput = document.getElementById('performance-import-competencia');
  const mesPadrao = APP.filtros.performance.competencia_mes || new Date().toISOString().slice(0, 7);
  const hoje = new Date().toISOString().slice(0, 10);
  const dataPadraoImportacao = mesPadrao === hoje.slice(0, 7) ? hoje : `${mesPadrao}-01`;

  APP.filtros.performance.competencia_mes = mesPadrao;
  APP.dados.performance = criarDadosPerformanceVazios();
  preencherFiltrosPerformance([mesPadrao]);
  if (filtroMes) filtroMes.value = mesPadrao;
  if (competenciaInput && !competenciaInput.value) competenciaInput.value = dataPadraoImportacao;
  configurarEventosPerformance();
  renderizarPerformanceOperacional();
  carregarDadosPerformanceEmSegundoPlano(mesPadrao);
  carregarMesesPerformanceEmSegundoPlano(true);
}

function criarDadosPerformanceVazios() {
  return { mop: [], atendimento: [], csat: [], agentHistory: [] };
}

async function carregarDadosPerformanceEmSegundoPlano(competenciaMes) {
  const carregamentoId = ++performanceDadosCarregamentoId;
  performanceHistoricoCarregamentoId += 1;
  try {
    const dados = await DB.performance.listar({
      competencia_mes: competenciaMes,
      incluir_agent_history: false
    });
    if (carregamentoId !== performanceDadosCarregamentoId) return;
    if (APP.filtros.performance.competencia_mes !== competenciaMes) return;
    APP.dados.performance = dados;
    atualizarFiltrosDependentesPerformance();
    renderizarPerformanceOperacional();
  } catch (e) {
    if (carregamentoId !== performanceDadosCarregamentoId) return;
    console.warn('Dados de performance não puderam ser carregados:', e.message);
    toast('Não foi possível carregar os dados de performance: ' + e.message, 'error');
  }
}

async function carregarMesesPerformanceEmSegundoPlano(selecionarUltimoImportado = false) {
  const carregamentoId = ++performanceMesesCarregamentoId;
  try {
    const meses = await DB.performance.listarMesesImportados();
    if (carregamentoId !== performanceMesesCarregamentoId) return;
    const semDados = ['mop', 'atendimento', 'csat'].every(tipo => !(APP.dados.performance[tipo] || []).length);
    const mesImportado = meses[0];
    if (selecionarUltimoImportado && semDados && mesImportado && mesImportado !== APP.filtros.performance.competencia_mes) {
      APP.filtros.performance.competencia_mes = mesImportado;
      APP.dados.performance = criarDadosPerformanceVazios();
      preencherFiltrosPerformance(meses);
      renderizarPerformanceOperacional();
      carregarDadosPerformanceEmSegundoPlano(mesImportado);
      return;
    }
    preencherFiltrosPerformance(meses);
  } catch (e) {
    if (carregamentoId !== performanceMesesCarregamentoId) return;
    console.warn('Competências importadas não puderam ser carregadas:', e.message);
    toast('A lista de meses importados não respondeu: ' + e.message, 'warning');
  }
}

async function carregarAgentHistoryPerformanceEmSegundoPlano(competenciaMes) {
  const carregamentoId = ++performanceHistoricoCarregamentoId;
  try {
    const historico = await DB.performance.listarAgentHistory(
      { competencia_mes: competenciaMes },
      APP.dados.performance.mop || []
    );
    if (carregamentoId !== performanceHistoricoCarregamentoId) return;
    if (APP.filtros.performance.competencia_mes !== competenciaMes) return;
    APP.dados.performance.agentHistory = historico;
    renderizarPerformanceOperacional();
  } catch (e) {
    if (carregamentoId !== performanceHistoricoCarregamentoId) return;
    console.warn('AgentHistory não pôde ser carregado:', e.message);
    toast('Métricas carregadas. O AgentHistory não respondeu: ' + e.message, 'warning');
  }
}

function configurarEventosPerformance() {
  const ids = [
    'performance-filtro-mes',
    'performance-filtro-data-inicio',
    'performance-filtro-data-fim',
    'performance-filtro-lider',
    'performance-filtro-colaborador'
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.performanceBound) return;
    el.dataset.performanceBound = 'true';
    el.addEventListener('change', () => aplicarFiltrosPerformance());
  });
}

function preencherFiltrosPerformance(mesesImportados = []) {
  preencherFiltroMesPerformance(mesesImportados);
  atualizarFiltrosDependentesPerformance();
}

function preencherFiltroMesPerformance(mesesImportados = []) {
  const filtros = APP.filtros.performance || {};
  const mesEl = document.getElementById('performance-filtro-mes');
  const meses = [...new Set([filtros.competencia_mes, ...mesesImportados].filter(Boolean))].sort().reverse();
  if (mesEl) {
    mesEl.innerHTML = meses.map(mes => `<option value="${escapeHtml(mes)}">${escapeHtml(mes)}</option>`).join('');
    mesEl.value = filtros.competencia_mes || meses[0] || '';
  }
}

function preencherFiltroLiderPerformance() {
  const filtros = { ...(APP.filtros.performance || {}), lider: '', chave_colaborador: '' };
  const dados = filtrarDadosPerformance(APP.dados.performance, filtros);
  const registros = [...dados.mop, ...dados.atendimento, ...dados.csat, ...dados.agentHistory];
  const lideres = extrairUnicos(registros, 'lider');
  const liderEl = document.getElementById('performance-filtro-lider');
  if (liderEl) {
    liderEl.innerHTML = '<option value="">Todos</option>' + lideres.map(lider =>
      `<option value="${escapeHtml(lider)}">${escapeHtml(lider)}</option>`
    ).join('');
    liderEl.value = lideres.includes(APP.filtros.performance.lider) ? APP.filtros.performance.lider : '';
    APP.filtros.performance.lider = liderEl.value;
  }
}

function preencherFiltroColaboradorPerformance() {
  const filtros = { ...(APP.filtros.performance || {}), chave_colaborador: '' };
  const dados = filtrarDadosPerformance(APP.dados.performance, filtros);
  const registros = [...dados.mop, ...dados.atendimento, ...dados.csat, ...dados.agentHistory];
  const pessoas = new Map();
  registros.forEach(item => {
    const chave = obterChaveColaboradorPerformance(item);
    if (!chave) return;
    const atual = pessoas.get(chave) || {};
    pessoas.set(chave, {
      chave,
      nome: atual.nome || item.colaborador_nome || item.agent_name || item.usuario_blip || item.agent_identity || chave,
      usuario_blip: atual.usuario_blip || item.usuario_blip || item.agent_identity || ''
    });
  });

  const colaboradorEl = document.getElementById('performance-filtro-colaborador');
  if (colaboradorEl) {
    colaboradorEl.innerHTML = '<option value="">Todos</option>' + [...pessoas.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(item =>
      `<option value="${escapeHtml(item.chave)}">${escapeHtml(item.usuario_blip && normalizarChavePerformance(item.usuario_blip) !== normalizarChavePerformance(item.nome)
        ? `${item.nome} - ${item.usuario_blip}`
        : item.nome)}</option>`
    ).join('');
    colaboradorEl.value = pessoas.has(APP.filtros.performance.chave_colaborador) ? APP.filtros.performance.chave_colaborador : '';
    APP.filtros.performance.chave_colaborador = colaboradorEl.value;
  }
}

function atualizarFiltrosDependentesPerformance() {
  preencherFiltroLiderPerformance();
  preencherFiltroColaboradorPerformance();
}

async function aplicarFiltrosPerformance() {
  try {
    const mesAnterior = APP.filtros.performance.competencia_mes;
    APP.filtros.performance = {
      competencia_mes: document.getElementById('performance-filtro-mes')?.value || '',
      data_inicio: document.getElementById('performance-filtro-data-inicio')?.value || '',
      data_fim: document.getElementById('performance-filtro-data-fim')?.value || '',
      lider: document.getElementById('performance-filtro-lider')?.value || '',
      chave_colaborador: document.getElementById('performance-filtro-colaborador')?.value || ''
    };

    if (APP.filtros.performance.competencia_mes !== mesAnterior) {
      APP.dados.performance = criarDadosPerformanceVazios();
      carregarDadosPerformanceEmSegundoPlano(APP.filtros.performance.competencia_mes);
    }

    atualizarFiltrosDependentesPerformance();
    renderizarPerformanceOperacional();
    carregarMesesPerformanceEmSegundoPlano();
  } catch (e) {
    toast('Erro ao aplicar filtros de performance: ' + e.message, 'error');
  }
}

function limparFiltrosPerformance() {
  const mes = document.getElementById('performance-filtro-mes')?.value || APP.filtros.performance.competencia_mes || '';
  APP.filtros.performance = { competencia_mes: mes };
  ['performance-filtro-data-inicio', 'performance-filtro-data-fim', 'performance-filtro-lider', 'performance-filtro-colaborador']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  atualizarFiltrosDependentesPerformance();
  renderizarPerformanceOperacional();
}

function filtrarDadosPerformance(dados = {}, filtros = {}) {
  const filtrar = (item, considerarData = true) => {
    if (filtros.competencia_mes && item.competencia_mes && item.competencia_mes !== filtros.competencia_mes) return false;
    if (filtros.lider && item.lider !== filtros.lider) return false;
    if (filtros.chave_colaborador && obterChaveColaboradorPerformance(item) !== filtros.chave_colaborador) return false;
    if (!considerarData) return true;
    const dataReferencia = converterDataPerformance(item.data_referencia);
    if (!dataReferencia) return !filtros.data_inicio && !filtros.data_fim;
    if (filtros.competencia_mes && dataReferencia.iso.slice(0, 7) !== filtros.competencia_mes) return false;
    const dataInicio = converterDataPerformance(filtros.data_inicio);
    const dataFim = converterDataPerformance(filtros.data_fim);
    if (dataInicio && dataReferencia.tempo < dataInicio.tempo) return false;
    if (dataFim && dataReferencia.tempo > dataFim.tempo) return false;
    return true;
  };
  return {
    mop: (dados.mop || []).filter(item => filtrar(item, false)),
    atendimento: (dados.atendimento || []).filter(item => filtrar(item)),
    csat: (dados.csat || []).filter(item => filtrar(item)),
    agentHistory: (dados.agentHistory || []).filter(item => filtrar(item))
  };
}

function dadosFiltradosPerformance() {
  return filtrarDadosPerformance(APP.dados.performance, APP.filtros.performance || {});
}

function converterDataPerformance(valor) {
  const iso = normalizarData(valor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const tempo = new Date(`${iso}T00:00:00`).getTime();
  return Number.isFinite(tempo) ? { iso, tempo } : null;
}

function renderizarPerformanceOperacional() {
  const dados = dadosFiltradosPerformance();
  renderizarCardsPerformance(dados);
  renderizarGraficoProdutividadePerformance(dados);
  renderizarGraficoCsatPerformance(dados);
  renderizarTabelaRankingPerformance(dados);
  renderizarPontosAtencaoPerformance(dados);
  Security.aplicarRestricoesVisuais();
}

function calcularMediaPonderada(registros, campo) {
  let somaPesos = 0;
  let somaPonderada = 0;
  (registros || []).forEach(item => {
    const peso = Number(item.tickets_finalizados) || 0;
    const valorOriginal = campo === 'tme_segundos'
      ? item.tme_total_segundos ?? item.tme_segundos
      : item[campo];
    if (valorOriginal === null || valorOriginal === undefined || valorOriginal === '') return;
    const valor = Number(valorOriginal);
    if (!peso || !Number.isFinite(valor)) return;
    somaPesos += peso;
    somaPonderada += valor * peso;
  });
  return somaPesos ? somaPonderada / somaPesos : null;
}

function calcularCsat(registros) {
  const notas = (registros || [])
    .map(item => normalizarNotaPerformance(item.nota))
    .filter(nota => nota !== null);
  if (!notas.length) return null;
  return (notas.filter(nota => nota >= 4 && nota <= 5).length / notas.length) * 100;
}

function classificarMetaPerformance(valor, meta, maiorMelhor = false) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return 'sem-dados';
  return maiorMelhor
    ? Number(valor) >= Number(meta) ? 'dentro' : 'fora'
    : Number(valor) <= Number(meta) ? 'dentro' : 'fora';
}

function renderizarCardsPerformance(dados = dadosFiltradosPerformance()) {
  const el = document.getElementById('performance-cards');
  if (!el) return;
  const atendimento = dados.atendimento || [];
  const ticketsFinalizados = atendimento.reduce((soma, item) => soma + (Number(item.tickets_finalizados) || 0), 0);
  const totalTickets = calcularTotalTicketsPerformance(dados, ticketsFinalizados);
  const cards = [
    { nome: 'Total de Tickets', valor: totalTickets, formato: 'numero', status: 'info', descricao: 'Volume total recebido no período' },
    { nome: 'Tickets Finalizados', valor: ticketsFinalizados, formato: 'numero', status: 'info', descricao: 'Total de tickets finalizados no período' },
    { nome: 'TMAX.E', valor: calcularTmaxePerformance(dados), formato: 'tempo', status: 'info', descricao: 'Maior tempo de espera registrado no período' },
    { nome: 'TME', valor: calcularMediaPonderada(atendimento, 'tme_segundos'), meta: PERFORMANCE_METAS.tme_segundos, formato: 'tempo' },
    { nome: 'TM1.R', valor: calcularMediaPonderada(atendimento, 'tm1r_segundos'), meta: PERFORMANCE_METAS.tm1r_segundos, formato: 'tempo' },
    { nome: 'TMR', valor: calcularMediaPonderada(atendimento, 'tmr_segundos'), meta: PERFORMANCE_METAS.tmr_segundos, formato: 'tempo' },
    { nome: 'TMA', valor: calcularMediaPonderada(atendimento, 'tma_segundos'), meta: PERFORMANCE_METAS.tma_segundos, formato: 'tempo' },
    { nome: 'CSAT', valor: calcularCsat(dados.csat), meta: PERFORMANCE_METAS.csat, formato: 'percentual', maiorMelhor: true }
  ];

  el.innerHTML = cards.map(card => {
    const status = card.status || classificarMetaPerformance(card.valor, card.meta, card.maiorMelhor);
    const temValor = card.valor !== null && card.valor !== undefined && Number.isFinite(Number(card.valor));
    const valor = !temValor ? '-' : card.formato === 'tempo'
      ? formatarSegundosParaHHMMSS(card.valor)
      : card.formato === 'percentual' ? formatarPercentualPerformance(card.valor) : Number(card.valor).toLocaleString('pt-BR');
    if (card.status === 'info') {
      return `
        <div class="performance-metric-card status-info">
          <div class="performance-metric-title">${card.nome}</div>
          <div class="performance-metric-value">${valor}</div>
          <div class="performance-metric-description">${card.descricao}</div>
        </div>`;
    }
    const meta = card.formato === 'tempo'
      ? formatarSegundosParaHHMMSS(card.meta) : `${card.meta}%`;
    const diferenca = !temValor ? '-' : card.formato === 'tempo'
      ? formatarDiferencaTempoPerformance(card.valor - card.meta)
      : formatarDiferencaPercentualPerformance(card.valor - card.meta);
    const proporcaoReal = card.meta && temValor ? (card.valor / card.meta) * 100 : null;
    const proporcaoVisual = proporcaoReal === null ? 0 : Math.min(100, proporcaoReal);
    const rotulos = { dentro: 'Dentro da meta', fora: 'Fora da meta', 'sem-dados': 'Sem dados' };
    return `
      <div class="performance-metric-card status-${status}">
        <div class="performance-metric-title">${card.nome}</div>
        <div class="performance-metric-value">${valor}</div>
        <div class="performance-metric-meta">Meta: ${meta}</div>
        <div class="performance-metric-diff">Diferença: ${diferenca}</div>
        <div class="performance-metric-proportion">Proporção: ${proporcaoReal === null ? '-' : formatarPercentualPerformance(proporcaoReal)} da meta</div>
        <div class="performance-progress"><span style="width:${proporcaoVisual}%"></span></div>
        <span class="performance-status">${rotulos[status]}</span>
      </div>`;
  }).join('');
}

function calcularTotalTicketsPerformance(dados = {}, ticketsFinalizados = 0) {
  if ((dados.agentHistory || []).length) return contarTicketsUnicosPerformance(dados.agentHistory);
  const totalInformado = (dados.atendimento || []).reduce((soma, item) => soma + (Number(item.total_tickets) || 0), 0);
  // Algumas bases mensais possuem apenas tickets finalizados. Nesse caso, o volume total usa o mesmo valor temporariamente.
  return totalInformado || ticketsFinalizados;
}

function calcularTmaxePerformance(dados = {}) {
  const atendimento = dados.atendimento || [];
  const prioridades = [
    atendimento.map(item => item.tmaxe_segundos),
    atendimento.map(item => item.tme_total_segundos),
    atendimento.map(item => item.tme_segundos),
    (dados.agentHistory || []).map(item => item.queue_time_segundos)
  ];
  for (const valores of prioridades) {
    const validos = valores
      .filter(valor => valor !== null && valor !== undefined && valor !== '')
      .map(Number)
      .filter(Number.isFinite);
    if (validos.length) return Math.max(...validos);
  }
  return null;
}

function formatarPercentualPerformance(valor) {
  return `${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatarDiferencaPercentualPerformance(valor) {
  if (!Number.isFinite(Number(valor))) return '-';
  const numero = Number(valor);
  return `${numero >= 0 ? '+' : ''}${numero.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;
}

function formatarDiferencaTempoPerformance(segundos) {
  if (!Number.isFinite(Number(segundos))) return '-';
  return `${segundos > 0 ? '+' : segundos < 0 ? '-' : ''}${formatarSegundosParaHHMMSS(Math.abs(segundos))}`;
}

function renderizarGraficoProdutividadePerformance(dados = dadosFiltradosPerformance()) {
  const el = document.getElementById('performance-grafico-produtividade');
  if (!el) return;
  const porDia = agruparSomaPerformance(dados.atendimento, 'data_referencia', 'tickets_finalizados');
  renderizarBarrasPerformance(el, porDia, valor => Math.round(valor).toLocaleString('pt-BR'));
}

function renderizarGraficoCsatPerformance(dados = dadosFiltradosPerformance()) {
  const el = document.getElementById('performance-grafico-csat');
  if (!el) return;
  const grupos = agruparPerformance(dados.csat, item => item.data_referencia || 'Sem data');
  const porDia = Object.entries(grupos)
    .map(([data, itens]) => ({ chave: data, valor: calcularCsat(itens) }))
    .filter(item => item.valor !== null)
    .sort((a, b) => a.chave.localeCompare(b.chave));
  if (!porDia.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-title">Sem dados no período</div></div>';
    return;
  }
  el.innerHTML = '<div class="performance-csat-wrap"><div class="performance-csat-target">Meta 85%</div><div class="performance-chart-bars">' +
    porDia.map(item => `
      <div class="performance-chart-column">
        <div class="performance-chart-value">${formatarPercentualPerformance(item.valor)}</div>
        <div class="performance-chart-bar csat ${item.valor >= PERFORMANCE_METAS.csat ? 'csat-dentro' : 'csat-fora'}" style="height:${Math.max(3, item.valor)}%"></div>
        <div class="performance-chart-label">${formatarRotuloDataPerformance(item.chave)}</div>
      </div>`).join('') + '</div></div>';
}

function renderizarBarrasPerformance(el, dados, formatarValor) {
  if (!dados.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-title">Sem dados no período</div></div>';
    return;
  }
  const max = Math.max(...dados.map(item => item.valor), 1);
  el.innerHTML = '<div class="performance-chart-bars">' + dados.map(item => `
    <div class="performance-chart-column">
      <div class="performance-chart-value">${formatarValor(item.valor)}</div>
      <div class="performance-chart-bar" style="height:${Math.max(3, (item.valor / max) * 100)}%"></div>
      <div class="performance-chart-label">${formatarRotuloDataPerformance(item.chave)}</div>
    </div>`).join('') + '</div>';
}

function renderizarTabelaRankingPerformance(dados = dadosFiltradosPerformance()) {
  const tbody = document.getElementById('performance-ranking-body');
  if (!tbody) return;
  const busca = (document.getElementById('performance-ranking-busca')?.value || '').toLowerCase();
  const ranking = montarRankingPerformance(dados)
    .filter(item => !busca || `${item.nome} ${item.lider}`.toLowerCase().includes(busca));

  tbody.innerHTML = ranking.length ? ranking.map((item, indice) => `
    <tr>
      <td><strong>${indice + 1}</strong></td>
      <td><strong>${escapeHtml(item.nome)}</strong></td>
      <td>${escapeHtml(item.lider || '-')}</td>
      <td>${item.tickets.toLocaleString('pt-BR')}</td>
      <td>${item.produtividade.toFixed(1)}</td>
      <td>${formatarSegundosParaHHMMSS(item.tme)}</td>
      <td>${formatarSegundosParaHHMMSS(item.tm1r)}</td>
      <td>${formatarSegundosParaHHMMSS(item.tmr)}</td>
      <td>${formatarSegundosParaHHMMSS(item.tma)}</td>
      <td>${item.csat === null ? '-' : formatarPercentualPerformance(item.csat)}</td>
      <td><span class="badge badge-${item.status === 'Dentro da meta' ? 'green' : 'red'}">${item.status}</span></td>
    </tr>`).join('') : '<tr><td colspan="11" class="text-muted text-center">Nenhum colaborador encontrado</td></tr>';
}

function montarRankingPerformance(dados = dadosFiltradosPerformance()) {
  const grupos = agruparPerformance(dados.atendimento, chaveAgrupamentoPerformance);
  const csatPorIdentidade = indexarCsatPorIdentidadePerformance(dados.csat);

  return Object.entries(grupos).map(([chave, itens]) => {
    const tickets = itens.reduce((soma, item) => soma + (Number(item.tickets_finalizados) || 0), 0);
    const dias = new Set(itens.map(item => item.data_referencia).filter(Boolean)).size || 1;
    const tme = calcularMediaPonderada(itens, 'tme_segundos');
    const tm1r = calcularMediaPonderada(itens, 'tm1r_segundos');
    const tmr = calcularMediaPonderada(itens, 'tmr_segundos');
    const tma = calcularMediaPonderada(itens, 'tma_segundos');
    const chavesCsat = new Set(itens.flatMap(chavesIdentidadePerformance));
    const avaliacoesCsat = [...chavesCsat].flatMap(item => csatPorIdentidade[item] || []);
    const csat = calcularCsat([...new Set(avaliacoesCsat)]);
    const estados = [
      classificarMetaPerformance(tme, PERFORMANCE_METAS.tme_segundos),
      classificarMetaPerformance(tm1r, PERFORMANCE_METAS.tm1r_segundos),
      classificarMetaPerformance(tmr, PERFORMANCE_METAS.tmr_segundos),
      classificarMetaPerformance(tma, PERFORMANCE_METAS.tma_segundos),
      classificarMetaPerformance(csat, PERFORMANCE_METAS.csat, true)
    ];
    return {
      nome: itens[0].colaborador_nome || chave,
      lider: itens[0].lider || '',
      tickets,
      produtividade: tickets / dias,
      tme, tm1r, tmr, tma, csat,
      status: estados.includes('fora') ? 'Fora da meta' : 'Dentro da meta'
    };
  }).sort((a, b) => b.tickets - a.tickets);
}

function renderizarPontosAtencaoPerformance(dados = dadosFiltradosPerformance()) {
  const el = document.getElementById('performance-pontos-atencao');
  if (!el) return;
  const ranking = montarRankingPerformance(dados);
  const foraTme = ranking.filter(item => item.tme !== null && item.tme > PERFORMANCE_METAS.tme_segundos).length;
  const foraTma = ranking.filter(item => item.tma !== null && item.tma > PERFORMANCE_METAS.tma_segundos).length;
  const foraCsat = ranking.filter(item => item.csat !== null && item.csat < PERFORMANCE_METAS.csat).length;
  const maiorTme = [...ranking].filter(item => item.tme !== null).sort((a, b) => b.tme - a.tme)[0];
  const menorCsat = [...ranking].filter(item => item.csat !== null).sort((a, b) => a.csat - b.csat)[0];
  const ofensoresPorLider = {};
  ranking.filter(item => item.status === 'Fora da meta').forEach(item => {
    const lider = item.lider || 'Sem líder';
    ofensoresPorLider[lider] = (ofensoresPorLider[lider] || 0) + 1;
  });
  const liderOfensor = Object.entries(ofensoresPorLider).sort((a, b) => b[1] - a[1])[0];
  const itens = [
    ['Fora da meta de TME', foraTme],
    ['Fora da meta de TMA', foraTma],
    ['Abaixo da meta de CSAT', foraCsat],
    ['Maior TME', maiorTme ? `${maiorTme.nome} · ${formatarSegundosParaHHMMSS(maiorTme.tme)}` : '-'],
    ['Menor CSAT', menorCsat ? `${menorCsat.nome} · ${menorCsat.csat.toFixed(1)}%` : '-'],
    ['Líder com mais ofensores', liderOfensor ? `${liderOfensor[0]} · ${liderOfensor[1]}` : '-']
  ];
  el.innerHTML = itens.map(([label, valor]) => `
    <div class="performance-attention-item">
      <div class="performance-attention-label">${escapeHtml(label)}</div>
      <div class="performance-attention-value">${escapeHtml(valor)}</div>
    </div>`).join('');
}

function selecionarArquivoPerformance(tipo) {
  if (!Security.requirePermission('importar_performance_operacional')) return;
  document.getElementById(`performance-file-${tipo}`)?.click();
}

async function previewImportacaoPerformance(tipo, arquivo) {
  if (!Security.requirePermission('importar_performance_operacional') || !arquivo) return;
  const competenciaData = document.getElementById('performance-import-competencia')?.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(competenciaData || '')) {
    toast('Selecione o dia da competência antes do arquivo.', 'warning');
    return;
  }
  const competenciaMes = competenciaData.slice(0, 7);
  if (!/\.(csv|xlsx|xls)$/i.test(arquivo.name)) {
    toast('Formato inválido. Use CSV, XLSX ou XLS.', 'error');
    return;
  }

  try {
    const linhas = await lerPlanilhaPerformance(arquivo);
    const mopAtual = tipo === 'mop'
      ? linhas.map(row => mapearRegistroPerformance('mop', row, competenciaMes, [], 0, competenciaData).registro)
      : obterMopImportacaoPerformance();
    const processados = linhas.map((row, indice) => {
      const processado = mapearRegistroPerformance(tipo, row, competenciaMes, mopAtual, indice + 2, competenciaData);
      if (tipo !== 'mop' && processado.registro.data_referencia !== competenciaData) {
        processado.valido = false;
        processado.inconsistencias.push(`Linha ${indice + 2}: data fora da competência diária selecionada`);
      }
      return processado;
    });
    window._performanceImportacao.arquivos[tipo] = {
      tipo,
      nome: arquivo.name,
      competenciaData,
      totalLidos: linhas.length,
      registros: processados.filter(item => item.valido).map(item => item.registro),
      inconsistencias: processados.flatMap(item => item.inconsistencias)
    };
    if (tipo !== 'mop' && !window._performanceImportacao.arquivos[tipo].registros.length) {
      toast(`Nenhum registro de ${rotuloTipoPerformance(tipo)} corresponde ao dia ${formatarRotuloDataPerformance(competenciaData)}. Revise a data escolhida.`, 'warning');
    }
    if (tipo === 'mop') atualizarRelacionamentosPreviewPerformance();
    renderizarPreviewImportacaoPerformance();
  } catch (e) {
    toast('Erro ao ler arquivo: ' + e.message, 'error');
  }
}

function atualizarRelacionamentosPreviewPerformance() {
  const mop = obterMopImportacaoPerformance();
  ['metricas', 'agent_history', 'csat'].forEach(tipo => {
    const arquivo = window._performanceImportacao.arquivos[tipo];
    if (!arquivo) return;
    const inconsistenciasEstruturais = arquivo.inconsistencias.filter(item => !item.includes('não encontrado na MOP'));
    const relacionados = arquivo.registros.map(registro => relacionarComMop(registro, mop));
    arquivo.inconsistencias = [
      ...inconsistenciasEstruturais,
      ...relacionados
        .filter(item => !item.encontrado)
        .map(item => `${item.registro.colaborador_nome || item.registro.agent_name || 'Sem identificação'} não encontrado na MOP`)
    ];
    arquivo.registros = relacionados.map(item => item.registro);
  });
}

function obterMopImportacaoPerformance() {
  return window._performanceImportacao.arquivos.mop?.registros || APP.dados.performance.mop || [];
}

function renderizarPreviewImportacaoPerformance() {
  const el = document.getElementById('performance-import-preview');
  if (!el) return;
  const arquivos = Object.values(window._performanceImportacao.arquivos);
  if (!arquivos.length) {
    el.innerHTML = '';
    return;
  }
  const inconsistencias = arquivos.flatMap(item => item.inconsistencias);
  const arquivosDiariosVazios = arquivos.filter(item => item.tipo !== 'mop' && !item.registros.length);
  const resumoInconsistencias = resumirInconsistenciasPerformance(inconsistencias);
  el.innerHTML = `
    <div class="performance-preview-card">
      <strong>Prévia da importação</strong>
      <div class="performance-preview-list">
        ${arquivos.map(item => `
          <div class="performance-preview-line">
            <span>${escapeHtml(rotuloTipoPerformance(item.tipo))} · ${escapeHtml(item.nome)}</span>
            <strong>${item.registros.length} registros</strong>
          </div>`).join('')}
      </div>
      <div class="text-sm"><strong>${inconsistencias.length}</strong> inconsistência(s) encontrada(s)</div>
      ${inconsistencias.length ? `<div class="text-xs text-muted mt-4">${resumoInconsistencias}</div>` : ''}
      ${inconsistencias.length ? `<div class="performance-inconsistencies">${[...new Set(inconsistencias)].slice(0, 100).map(item => `<div>${escapeHtml(item)}</div>`).join('')}</div>` : ''}
      <div class="mt-4 flex gap-2">
        <button class="btn btn-primary" onclick="confirmarImportacaoPerformance()" ${arquivosDiariosVazios.length ? 'disabled' : ''}>Confirmar importação</button>
        <button class="btn btn-secondary" onclick="cancelarImportacaoPerformance()">Cancelar</button>
      </div>
    </div>`;
}

function resumirInconsistenciasPerformance(inconsistencias = []) {
  const semMop = inconsistencias.filter(item => item.includes('não encontrado na MOP')).length;
  const semIdentificacao = inconsistencias.filter(item => item.includes('sem identificação')).length;
  const dataInvalida = inconsistencias.filter(item => item.includes('data inválida')).length;
  const dataForaCompetencia = inconsistencias.filter(item => item.includes('data fora da competência diária')).length;
  return [
    semMop ? `${semMop} sem correspondência na MOP` : '',
    semIdentificacao ? `${semIdentificacao} sem identificação` : '',
    dataInvalida ? `${dataInvalida} com data inválida` : '',
    dataForaCompetencia ? `${dataForaCompetencia} fora do dia selecionado` : ''
  ].filter(Boolean).join(' · ');
}

function cancelarImportacaoPerformance() {
  window._performanceImportacao = { arquivos: {} };
  document.getElementById('performance-import-preview').innerHTML = '';
  ['mop', 'metricas', 'agent_history', 'csat'].forEach(tipo => {
    const input = document.getElementById(`performance-file-${tipo}`);
    if (input) input.value = '';
  });
}

async function confirmarImportacaoPerformance() {
  if (!Security.requirePermission('importar_performance_operacional')) return;
  const competenciaData = document.getElementById('performance-import-competencia')?.value;
  const competenciaMes = /^\d{4}-\d{2}-\d{2}$/.test(competenciaData || '') ? competenciaData.slice(0, 7) : '';
  const arquivos = window._performanceImportacao.arquivos;
  const ordem = ['mop', 'metricas', 'agent_history', 'csat'].filter(tipo => arquivos[tipo]);
  if (!competenciaMes || !ordem.length) {
    toast('Selecione o dia da competência e ao menos um arquivo.', 'warning');
    return;
  }
  if (ordem.some(tipo => arquivos[tipo].competenciaData !== competenciaData)) {
    toast('A data da competência mudou. Selecione novamente os arquivos para atualizar a prévia.', 'warning');
    return;
  }
  const arquivosDiariosVazios = ordem.filter(tipo => tipo !== 'mop' && !arquivos[tipo].registros.length);
  if (arquivosDiariosVazios.length) {
    toast(`A importação foi bloqueada: ${arquivosDiariosVazios.map(rotuloTipoPerformance).join(', ')} não possui registros para o dia selecionado.`, 'warning');
    return;
  }

  try {
    toast('Importando performance do dia...', 'info');
    for (const tipo of ordem) {
      const arquivo = arquivos[tipo];
      await DB.performance.importarMes({
        competencia_mes: competenciaMes,
        competencia_data: competenciaData,
        tipo_arquivo: tipo,
        nome_arquivo: arquivo.nome,
        registros: arquivo.registros,
        observacao: arquivo.inconsistencias.length
          ? `${arquivo.inconsistencias.length} inconsistência(s) identificada(s) na prévia`
          : 'Importação validada sem inconsistências'
      });
    }
    cancelarImportacaoPerformance();
    APP.filtros.performance.competencia_mes = competenciaMes;
    toast('Performance importada com sucesso.', 'success');
    await carregarPerformanceOperacional();
  } catch (e) {
    toast('Erro ao importar performance: ' + e.message, 'error');
  }
}

async function lerPlanilhaPerformance(arquivo) {
  const conteudo = await arquivo.arrayBuffer();
  if (/\.csv$/i.test(arquivo.name || '')) {
    return analisarCsvPerformance(new TextDecoder('utf-8').decode(conteudo));
  }
  if (typeof XLSX === 'undefined') throw new Error('A biblioteca SheetJS não foi carregada.');
  const workbook = XLSX.read(conteudo, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
}

function analisarCsvPerformance(texto) {
  const conteudo = String(texto || '').replace(/^\uFEFF/, '');
  const primeiraLinha = conteudo.split(/\r?\n/, 1)[0] || '';
  const delimitador = detectarDelimitadorCsvPerformance(primeiraLinha);
  const linhas = [];
  let linha = [];
  let valor = '';
  let dentroDeAspas = false;

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    const proximo = conteudo[indice + 1];
    if (caractere === '"') {
      if (dentroDeAspas && proximo === '"') {
        valor += '"';
        indice += 1;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (!dentroDeAspas && caractere === delimitador) {
      linha.push(valor);
      valor = '';
    } else if (!dentroDeAspas && (caractere === '\n' || caractere === '\r')) {
      if (caractere === '\r' && proximo === '\n') indice += 1;
      linha.push(valor);
      if (linha.some(item => String(item || '').trim() !== '')) linhas.push(linha);
      linha = [];
      valor = '';
    } else {
      valor += caractere;
    }
  }
  linha.push(valor);
  if (linha.some(item => String(item || '').trim() !== '')) linhas.push(linha);
  if (!linhas.length) return [];

  const cabecalhos = linhas[0].map(item => String(item || '').trim());
  return linhas.slice(1).map(valores =>
    Object.fromEntries(cabecalhos.map((cabecalho, indice) => [cabecalho, valores[indice] ?? '']))
  );
}

function detectarDelimitadorCsvPerformance(primeiraLinha) {
  const candidatos = [',', ';', '\t'];
  let melhor = ',';
  let maiorQuantidade = -1;
  candidatos.forEach(candidato => {
    let quantidade = 0;
    let dentroDeAspas = false;
    for (let indice = 0; indice < primeiraLinha.length; indice += 1) {
      if (primeiraLinha[indice] === '"') dentroDeAspas = !dentroDeAspas;
      else if (!dentroDeAspas && primeiraLinha[indice] === candidato) quantidade += 1;
    }
    if (quantidade > maiorQuantidade) {
      maiorQuantidade = quantidade;
      melhor = candidato;
    }
  });
  return melhor;
}

function mapearRegistroPerformance(tipo, row, competencia, mop = [], linha = 0, competenciaData = '') {
  const nome = valorPerformance(row, [
    'Atendente', 'Nome do Atendente', 'Nome Atendente', 'Agente', 'Agent', 'AgentName', 'Agent Name',
    'Nome do Agente', 'Nome Agente', 'Nome do colaborador', 'Nome Colaborador', 'Nome completo',
    'Colaborador', 'Funcionário', 'Funcionario', 'Operador', 'Responsável', 'Responsavel', 'Nome'
  ]);
  const email = valorPerformance(row, [
    'E-mail', 'Email', 'E-mail corporativo', 'Email corporativo', 'E-mail do colaborador',
    'Email do colaborador', 'E-mail do atendente', 'Email do atendente', 'AgentEmail', 'Agent Email'
  ]);
  const usuarioBlip = valorPerformance(row, [
    'Usuário Blip', 'Usuario Blip', 'Usuário', 'Usuario', 'User Blip', 'Blip', 'Login Blip',
    'Identidade Blip', 'AgentIdentity', 'Agent Identity', 'Identity', 'Login'
  ]);
  const matricula = valorPerformance(row, ['Matrícula', 'Matricula', 'ID colaborador', 'ID Colaborador']);
  const valorData = valorPerformance(row, [
    'Data', 'StorageDate', 'Storage Date', 'CloseDate', 'Close Date', 'Data da avaliação',
    'Data da avaliacao', 'Data de fechamento', 'Data do atendimento', 'CreatedDate', 'Created Date',
    'Data de referência', 'Data de referencia', 'ReferenceDate', 'Reference Date', 'Date'
  ]);
  const data = tipo === 'metricas' && String(valorData || '').trim() === ''
    ? competenciaData
    : normalizarDataPerformanceParaCompetencia(valorData, competenciaData);
  const base = {
    competencia_mes: competencia,
    data_referencia: data,
    colaborador_nome: String(nome || '').trim(),
    colaborador_email: String(email || '').trim().toLowerCase(),
    usuario_blip: String(usuarioBlip || '').trim(),
    matricula: String(matricula || '').trim(),
    origem_arquivo: tipo
  };
  let registro;
  const inconsistencias = [];

  if (tipo === 'mop') {
    registro = {
      competencia_mes: competencia,
      colaborador_nome: String(nome || '').trim(),
      colaborador_email: String(email || '').trim().toLowerCase(),
      usuario_blip: String(usuarioBlip || '').trim(),
      matricula: String(matricula || '').trim(),
      lider: String(valorPerformance(row, [
        'Líder', 'Lider', 'Líder imediato', 'Lider imediato', 'Reporte', 'Gestor', 'Gestor imediato',
        'Supervisor', 'Coordenação', 'Coordenacao'
      ]) || '').trim(),
      status: String(valorPerformance(row, ['Status']) || 'Ativo').trim(),
      origem_arquivo: tipo
    };
    registro.chave_colaborador = obterChaveColaboradorPerformance(registro);
    if (!registro.chave_colaborador) {
      inconsistencias.push(`Linha ${linha}: colaborador sem identificação`);
    }
    return { registro, valido: !inconsistencias.length, inconsistencias };
  }

  if (tipo === 'metricas') {
    registro = {
      ...base,
      total_tickets: normalizarNumeroPerformance(valorPerformance(row, ['Total de tickets', 'Total Tickets', 'Tickets recebidos', 'Tickets Recebidos'])),
      tickets_finalizados: normalizarNumeroPerformance(valorPerformance(row, ['Tickets finalizados', 'Tickets Finalizados', 'Tickets atendidos', 'Tickets Atendidos'])),
      tm1r_segundos: normalizarTempoParaSegundos(valorPerformance(row, ['Tempo médio da 1ª resposta', 'Tempo medio da 1 resposta', 'FirstResponseTime'])),
      tme_segundos: normalizarTempoParaSegundos(valorPerformance(row, ['Tempo médio de espera', 'Tempo medio de espera', 'QueueTime'])),
      tme_total_segundos: normalizarTempoParaSegundos(valorPerformance(row, ['Tempo médio de espera total', 'Tempo medio de espera total'])),
      tmr_segundos: normalizarTempoParaSegundos(valorPerformance(row, ['Tempo médio de resposta', 'Tempo medio de resposta', 'AverageResponseTime'])),
      tma_segundos: normalizarTempoParaSegundos(valorPerformance(row, ['Tempo médio de atendimento', 'Tempo medio de atendimento', 'Tempo de atendimento'])),
      tmaxe_segundos: normalizarTempoParaSegundos(valorPerformance(row, ['Tempo máximo de espera', 'Tempo maximo de espera', 'MaximumQueueTime']))
    };
  } else if (tipo === 'agent_history') {
    registro = {
      ...base,
      sequential_id: String(valorPerformance(row, ['SequentialId', 'Sequential ID', 'Sequential Id', 'Ticket', 'Ticket ID', 'Protocolo']) || '').trim(),
      agent_name: String(nome || '').trim(),
      agent_email: String(email || '').trim().toLowerCase(),
      agent_identity: String(usuarioBlip || '').trim(),
      status: String(valorPerformance(row, ['Status']) || '').trim(),
      queue_time_segundos: normalizarTempoParaSegundos(valorPerformance(row, ['QueueTime', 'Tempo médio de espera', 'Tempo medio de espera'])),
      first_response_time_segundos: normalizarTempoParaSegundos(valorPerformance(row, ['FirstResponseTime', 'Tempo médio da 1ª resposta', 'Tempo medio da 1 resposta'])),
      average_response_time_segundos: normalizarTempoParaSegundos(valorPerformance(row, ['AverageResponseTime', 'Tempo médio de resposta', 'Tempo medio de resposta'])),
      close_date: normalizarDataPerformanceParaCompetencia(valorPerformance(row, ['CloseDate', 'Data de fechamento']), competenciaData)
    };
  } else {
    registro = {
      ...base,
      nota: normalizarNotaPerformance(valorPerformance(row, ['Nota', 'Avaliação', 'Avaliacao', 'Rating'])),
      avaliacao_id: String(valorPerformance(row, ['Ticket', 'ID', 'Id', 'Avaliação ID', 'Avaliacao ID']) || '').trim()
    };
  }

  registro.chave_colaborador = obterChaveColaboradorPerformance(registro);
  const semIdentificacao = !registro.chave_colaborador;
  if (!registro.data_referencia) inconsistencias.push(`Linha ${linha}: data inválida ou ausente`);
  if (semIdentificacao) inconsistencias.push(`Linha ${linha}: colaborador sem identificação`);
  const relacionado = semIdentificacao ? { registro, encontrado: false } : relacionarComMop(registro, mop);
  if (!semIdentificacao && !relacionado.encontrado) {
    inconsistencias.push(`${base.colaborador_nome || base.colaborador_email || base.usuario_blip} não encontrado na MOP`);
  }
  return { registro: relacionado.registro, valido: !inconsistencias.some(item => item.includes('data inválida') || item.includes('sem identificação')), inconsistencias };
}

function relacionarComMop(registro, mop = []) {
  const blip = normalizarTextoPerformance(registro.usuario_blip || registro.agent_identity);
  const email = normalizarTextoPerformance(registro.colaborador_email || registro.agent_email);
  const nome = normalizarTextoPerformance(registro.colaborador_nome || registro.agent_name);
  const matricula = normalizarTextoPerformance(registro.matricula);
  const chave = String(registro.chave_colaborador || '').trim().toLowerCase();
  const encontrado = (chave && (mop || []).find(item => String(item.chave_colaborador || '').trim().toLowerCase() === chave))
    || (blip && (mop || []).find(item => normalizarTextoPerformance(item.usuario_blip) === blip))
    || (email && (mop || []).find(item => normalizarTextoPerformance(item.colaborador_email) === email))
    || (nome && (mop || []).find(item => normalizarTextoPerformance(item.colaborador_nome) === nome))
    || (matricula && (mop || []).find(item => normalizarTextoPerformance(item.matricula) === matricula))
    || encontrarMopUnicoPorNomeSimplificado(registro.colaborador_nome || registro.agent_name, mop);

  if (!encontrado) return { registro, encontrado: false };
  return {
    encontrado: true,
    registro: {
      ...registro,
      chave_colaborador: encontrado.chave_colaborador || obterChaveColaboradorPerformance(encontrado) || obterChaveColaboradorPerformance(registro),
      colaborador_nome: encontrado.colaborador_nome || registro.colaborador_nome || registro.agent_name,
      colaborador_email: encontrado.colaborador_email || registro.colaborador_email || registro.agent_email,
      usuario_blip: encontrado.usuario_blip || registro.usuario_blip || registro.agent_identity,
      lider: encontrado.lider || registro.lider || ''
    }
  };
}

function encontrarMopUnicoPorNomeSimplificado(nome, mop = []) {
  const normalizado = normalizarNomePerformance(nome);
  if (!normalizado) return null;
  const encontrados = (mop || []).filter(item =>
    normalizarNomePerformance(item.colaborador_nome) === normalizado
  );
  return encontrados.length === 1 ? encontrados[0] : null;
}

function valorPerformance(row, aliases) {
  const mapa = Object.fromEntries(Object.entries(row || {}).map(([chave, valor]) => [normalizarTextoPerformance(chave), valor]));
  for (const alias of aliases) {
    const valor = mapa[normalizarTextoPerformance(alias)];
    if (valor !== undefined && valor !== null && valor !== '') return valor;
  }
  return '';
}

function normalizarTextoPerformance(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function normalizarDataPerformanceParaCompetencia(valor, competenciaData = '') {
  const data = normalizarData(valor);
  if (!competenciaData || data === competenciaData) return data;
  const texto = String(valor || '').trim();
  const partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!partes) return data;
  const alternativa = `${partes[3]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`;
  return alternativa === competenciaData ? alternativa : data;
}

function normalizarNomePerformance(valor) {
  const ignorar = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(parte => parte && !ignorar.has(parte))
    .join('');
}

function normalizarNumeroPerformance(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  let texto = String(valor).trim().replace(/[^\d,.-]/g, '');
  if (texto.includes(',') && texto.includes('.')) {
    texto = texto.lastIndexOf(',') > texto.lastIndexOf('.')
      ? texto.replace(/\./g, '').replace(',', '.')
      : texto.replace(/,/g, '');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(texto)) {
    texto = texto.replace(/\./g, '');
  } else {
    texto = texto.replace(',', '.');
  }
  return Number(texto) || 0;
}

function normalizarNotaPerformance(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const nota = normalizarNumeroPerformance(valor);
  return Number.isFinite(nota) && nota >= 1 && nota <= 5 ? nota : null;
}

function normalizarTempoParaSegundos(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') {
    if (valor > 0 && valor < 1) return Math.round(valor * 86400);
    return Math.round(valor);
  }
  const texto = String(valor).trim();
  if (!texto) return null;
  if (/^\d+([.,]\d+)?$/.test(texto)) return Math.round(Number(texto.replace(',', '.')));
  const partes = texto.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (partes) {
    if (partes[3] === undefined) return Number(partes[1]) * 60 + Number(partes[2]);
    return Number(partes[1]) * 3600 + Number(partes[2]) * 60 + Number(partes[3]);
  }
  const horas = Number(texto.match(/(\d+(?:[.,]\d+)?)\s*h/i)?.[1]?.replace(',', '.') || 0);
  const minutos = Number(texto.match(/(\d+(?:[.,]\d+)?)\s*m/i)?.[1]?.replace(',', '.') || 0);
  const segundos = Number(texto.match(/(\d+(?:[.,]\d+)?)\s*s/i)?.[1]?.replace(',', '.') || 0);
  return horas || minutos || segundos ? Math.round(horas * 3600 + minutos * 60 + segundos) : null;
}

function formatarSegundosParaHHMMSS(valor) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return '-';
  const total = Math.max(0, Math.round(Number(valor)));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  return [horas, minutos, segundos].map(item => String(item).padStart(2, '0')).join(':');
}

function contarTicketsUnicosPerformance(registros = []) {
  const identificadores = new Set();
  let semIdentificador = 0;
  registros.forEach(item => {
    const identificador = String(item.sequential_id || '').trim();
    if (identificador) identificadores.add(identificador);
    else semIdentificador += 1;
  });
  return identificadores.size + semIdentificador;
}

function normalizarChavePerformance(valor) {
  return String(valor || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function obterChaveColaboradorPerformance(item = {}) {
  const chaveExistente = normalizarChavePerformance(item.chave_colaborador);
  if (chaveExistente) return chaveExistente;
  const candidatos = [
    ['blip', item.usuario_blip || item.agent_identity],
    ['email', item.colaborador_email || item.agent_email],
    ['nome', item.colaborador_nome || item.agent_name],
    ['matricula', item.matricula]
  ];
  for (const [tipo, valor] of candidatos) {
    const normalizado = normalizarChavePerformance(valor);
    if (normalizado) return `${tipo}:${normalizado}`;
  }
  return '';
}

function chavesIdentidadePerformance(item = {}) {
  const chaves = [
    ['chave', item.chave_colaborador],
    ['blip', item.usuario_blip || item.agent_identity],
    ['email', item.colaborador_email || item.agent_email],
    ['nome', item.colaborador_nome || item.agent_name],
    ['matricula', item.matricula]
  ].map(([tipo, valor]) => {
    const normalizado = normalizarChavePerformance(valor);
    return normalizado ? `${tipo}:${normalizado}` : '';
  }).filter(Boolean);
  return [...new Set(chaves)];
}

function chaveAgrupamentoPerformance(item = {}) {
  return obterChaveColaboradorPerformance(item) || 'sem-identificacao';
}

function indexarCsatPorIdentidadePerformance(registros = []) {
  return registros.reduce((indice, item) => {
    chavesIdentidadePerformance(item).forEach(chave => {
      indice[chave] = indice[chave] || [];
      indice[chave].push(item);
    });
    return indice;
  }, {});
}

function agruparPerformance(lista, obterChave) {
  return (lista || []).reduce((grupos, item) => {
    const chave = obterChave(item);
    grupos[chave] = grupos[chave] || [];
    grupos[chave].push(item);
    return grupos;
  }, {});
}

function agruparSomaPerformance(lista, campoChave, campoValor) {
  const grupos = agruparPerformance(lista, item => item[campoChave] || 'Sem data');
  return Object.entries(grupos)
    .map(([chave, itens]) => ({ chave, valor: itens.reduce((soma, item) => soma + (Number(item[campoValor]) || 0), 0) }))
    .sort((a, b) => a.chave.localeCompare(b.chave));
}

function formatarRotuloDataPerformance(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return data;
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

function rotuloTipoPerformance(tipo) {
  return { mop: 'MOP', metricas: 'Métricas', agent_history: 'AgentHistory', csat: 'CSAT' }[tipo] || tipo;
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================
async function carregarConfiguracoes() {
  try {
    APP.config = await DB.configuracoes.listar();
    const empresa = document.getElementById('cfg-empresa');
    if (empresa && APP.config.empresa) empresa.value = JSON.parse(APP.config.empresa || '""');
    if (verificarPermissao('gerenciar_usuarios')) await carregarUsuariosAutorizados();
  } catch (e) {}
}

async function salvarConfiguracoes() {
  if (!Security.requirePermission('acessar_configuracoes')) return;
  const empresa = document.getElementById('cfg-empresa')?.value;
  try {
    await DB.configuracoes.salvar('empresa', JSON.stringify(empresa));
    await DB.configuracoes.salvar('tema', JSON.stringify(APP.tema));
    toast('Configurações salvas', 'success');
  } catch (e) { toast('Erro ao salvar', 'error'); }
}

// ============================================================
// EXPORTAÇÃO
// ============================================================
async function carregarUsuariosAutorizados() {
  if (!Security.requirePermission('gerenciar_usuarios')) return;
  const tbody = document.getElementById('tabela-usuarios-autorizados');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5"><div class="loading-inline"><div class="spinner"></div> Carregando...</div></td></tr>';
  try {
    const usuarios = await DB.usuariosAutorizados.listar();
    tbody.innerHTML = usuarios.length ? usuarios.map(u => `
      <tr>
        <td>${escapeHtml(u.nome || '-')}</td>
        <td>${escapeHtml(u.email || '-')}</td>
        <td><span class="badge badge-blue">${escapeHtml(u.perfil || '-')}</span></td>
        <td>${badgeStatus(u.status)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="preencherUsuarioAutorizado('${u.id}','${escapeHtml(u.nome || '')}','${escapeHtml(u.email || '')}','${escapeHtml(u.perfil || '')}','${escapeHtml(u.status || '')}')">Editar</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="text-muted text-center">Nenhum usuario autorizado</td></tr>';
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-title">Erro ao carregar usuarios</div><div class="empty-desc">${escapeHtml(e.message)}</div></div></td></tr>`;
  }
}

function preencherUsuarioAutorizado(id, nome, email, perfil, status) {
  if (!Security.requirePermission('gerenciar_usuarios')) return;
  document.getElementById('usr-nome').value = nome;
  document.getElementById('usr-email').value = email;
  document.getElementById('usr-email').dataset.id = id;
  document.getElementById('usr-perfil').value = perfil || 'CONSULTA';
  document.getElementById('usr-status').value = status || 'Ativo';
}

async function salvarUsuarioAutorizado() {
  if (!Security.requirePermission('gerenciar_usuarios')) return;
  const nome = document.getElementById('usr-nome')?.value || '';
  const email = document.getElementById('usr-email')?.value || '';
  const perfil = document.getElementById('usr-perfil')?.value || 'CONSULTA';
  const status = document.getElementById('usr-status')?.value || 'Ativo';

  if (!email.trim()) {
    toast('E-mail e obrigatorio', 'error');
    return;
  }

  try {
    await DB.usuariosAutorizados.salvar({ nome, email, perfil, status });
    toast('Usuario autorizado salvo', 'success');
    document.getElementById('usr-nome').value = '';
    document.getElementById('usr-email').value = '';
    document.getElementById('usr-email').dataset.id = '';
    document.getElementById('usr-perfil').value = 'CONSULTA';
    document.getElementById('usr-status').value = 'Ativo';
    await carregarUsuariosAutorizados();
  } catch (e) {
    toast('Erro ao salvar usuario: ' + e.message, 'error');
  }
}

async function exportarColaboradores(formato) {
  if (!Security.requirePermission('exportar_relatorios')) return;
  const dados = await DB.colaboradores.listar(APP.filtros.colaboradores);
  if (formato === 'csv') exportarCSV(dados, 'colaboradores');
  else if (formato === 'pdf') exportarPDF(dados, 'Colaboradores');
}

function exportarCSV(dados, nome) {
  if (!dados.length) { toast('Sem dados para exportar', 'warning'); return; }
  const headers = Object.keys(dados[0]);
  const rows = dados.map(d => headers.map(h => `"${(d[h] || '').toString().replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  downloadArquivo(csv, `${nome}_${dataHoje()}.csv`, 'text/csv');
}

function exportarPDF(dados, titulo) {
  if (!dados.length) { toast('Sem dados para exportar', 'warning'); return; }
  const headers = Object.keys(dados[0]).slice(0, 8);
  const html = `
    <html><head><title>${titulo}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
      h1{font-size:16px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f5f5f5;font-weight:bold}
      tr:nth-child(even){background:#fafafa}
    </style></head><body>
    <h1>${titulo} — ${dataHoje()}</h1>
    <p>Total: ${dados.length} registros</p>
    <table>
      <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${dados.slice(0,500).map(d=>`<tr>${headers.map(h=>`<td>${d[h]||''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    </body></html>
  `;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.print();
}

function downloadArquivo(conteudo, nome, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// EXCLUSÃO COM CONFIRMAÇÃO
// ============================================================
async function confirmarExclusao(tabela, id, nome) {
  const acoes = {
    colaboradores: 'excluir_colaborador',
    staff: 'excluir_staff',
    escalas: 'excluir_escala',
    programacoes: 'excluir_programacao'
  };
  if (!Security.requirePermission(acoes[tabela] || 'excluir_registro')) return;
  const modal = document.getElementById('modal-confirm');
  const msg = document.getElementById('confirm-msg');
  if (msg) msg.textContent = `Deseja excluir "${nome}"? Esta ação não pode ser desfeita.`;
  window._confirmCallback = async () => {
    try {
      await DB[tabela].excluir(id);
      toast('Registro excluído com sucesso', 'success');
      fecharModal('modal-confirm');
      await carregarPagina(APP.pagina);
    } catch (e) { toast('Erro ao excluir: ' + e.message, 'error'); }
  };
  abrirModal('modal-confirm');
}

// ============================================================
// PAGINAÇÃO
// ============================================================
function renderizarPaginacao(chave, total, pag) {
  const container = document.getElementById(`paginacao-${chave}`);
  if (!container) return;
  const totalPaginas = Math.ceil(total / pag.porPagina);
  const inicio = Math.min((pag.pagina - 1) * pag.porPagina + 1, total);
  const fim = Math.min(pag.pagina * pag.porPagina, total);

  const btns = [];
  if (pag.pagina > 1) btns.push(`<button class="page-btn" onclick="irParaPagina('${chave}',${pag.pagina-1})">‹</button>`);
  for (let i = Math.max(1, pag.pagina-2); i <= Math.min(totalPaginas, pag.pagina+2); i++) {
    btns.push(`<button class="page-btn ${i===pag.pagina?'active':''}" onclick="irParaPagina('${chave}',${i})">${i}</button>`);
  }
  if (pag.pagina < totalPaginas) btns.push(`<button class="page-btn" onclick="irParaPagina('${chave}',${pag.pagina+1})">›</button>`);

  container.innerHTML = `
    <div class="pagination">
      <div class="pagination-info">Exibindo ${inicio}–${fim} de ${total} registros</div>
      <div class="pagination-btns">${btns.join('')}</div>
    </div>
  `;
}

function irParaPagina(chave, pagina) {
  APP.paginacao[chave].pagina = pagina;
  if (chave === 'colaboradores') renderizarTabelaColaboradores();
  if (chave === 'staff') renderizarTabelaStaff();
  if (chave === 'programacoes') renderizarTabelaProgramacoes();
}

// ============================================================
// MODAL HELPERS
// ============================================================
function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}
function fecharTodosModais() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
}
// Fechar modal ao clicar fora
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) fecharTodosModais();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecharTodosModais();
});

// ============================================================
// TOAST
// ============================================================
function toast(msg, tipo = 'info', duracao = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.innerHTML = `<span class="toast-icon">${icons[tipo] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 250);
  }, duracao);
}

// ============================================================
// HELPERS
// ============================================================
function badgeStatus(status) {
  const map = {
    'Ativo': 'badge-active', 'Inativo': 'badge-inactive', 'Desligado': 'badge-inactive',
    'Férias': 'badge-ferias', 'Day Off': 'badge-dayoff', 'Afastado': 'badge-yellow',
    'Treinamento': 'badge-purple'
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status || '-'}</span>`;
}
function badgeEscala(tipo) {
  const map = {
    'Férias': 'badge-ferias', 'Day Off': 'badge-dayoff', 'Folga': 'badge-green',
    'Treinamento': 'badge-purple', 'Home Office': 'badge-purple', 'Licença': 'badge-red', 'Normal': 'badge-gray'
  };
  return `<span class="badge ${map[tipo] || 'badge-gray'}">${tipo || '-'}</span>`;
}
function badgeProgramacaoStatus(status) {
  const map = { 'Aprovado': 'badge-green', 'Pendente': 'badge-yellow', 'Rejeitado': 'badge-red', 'Cancelado': 'badge-gray' };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status || '-'}</span>`;
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cpf[10]);
}

function formatarData(data) {
  if (!data) return '-';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

function dataHoje() {
  return new Date().toISOString().split('T')[0];
}

async function carregarComLoading(tbodyId, fn) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="20"><div class="loading-inline"><div class="spinner"></div> Carregando...</div></td></tr>`;
  try {
    return await fn();
  } catch (e) {
    if (el) el.innerHTML = `<tr><td colspan="20"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro ao carregar: ${e.message}</div></div></td></tr>`;
    return [];
  }
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function atualizarContadorSelecao() {
  const checks = document.querySelectorAll('.row-check:checked');
  const bar = document.getElementById('selection-bar');
  const cnt = document.getElementById('selection-count');
  if (bar) bar.classList.toggle('hidden', checks.length === 0);
  if (cnt) cnt.textContent = checks.length;
}

// Select all checkbox
document.addEventListener('change', e => {
  if (e.target.id === 'check-all') {
    document.querySelectorAll('.row-check').forEach(c => c.checked = e.target.checked);
    atualizarContadorSelecao();
  }
  if (e.target.classList.contains('row-check')) atualizarContadorSelecao();
});

// Inicializa dropzone quando carrega a aba
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(configurarDropzone, 500);
});function escapeHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
