// ============================================================
// supabase.js - Módulo de conexão e operações com Supabase
// ============================================================

const SUPABASE_URL = 'https://pjeehaziodnxuakhacmc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqZWVoYXppb2RueHVha2hhY21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjU1MzQsImV4cCI6MjA5NDcwMTUzNH0.h5mIzDOvVS3M8BDFy3TeLM4djdBFHTM72LOpKGNgLkg';

// Inicializa o cliente Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

function permissaoLiberada(acao) {
  return !window.Security || window.Security.requirePermission(acao);
}

function temPermissao(acao) {
  return !window.Security || window.Security.verificarPermissao(acao);
}

function agenteLogado() {
  return window.Security?.isAgente?.() === true;
}

function colaboradorLogadoId() {
  return window.Security?.getColaboradorLogadoId?.() || null;
}

function emailLogado() {
  return window.Security?.getEmailLogado?.() || '';
}

// ============================================================
// MÓDULO DE BANCO DE DADOS
// ============================================================
const DB = {

  // ---------- COLABORADORES ----------
  colaboradores: {
    async listar(filtros = {}) {
      if (!permissaoLiberada(agenteLogado() ? 'visualizar_propria_escala' : 'visualizar_colaboradores')) return [];
      let query = db.from('colaboradores').select('*').order('nome');
      if (agenteLogado()) query = query.ilike('email', emailLogado());
      if (filtros.status) query = query.eq('status', filtros.status);
      if (filtros.celula) query = query.eq('celula', filtros.celula);
      if (filtros.grupo) query = query.eq('grupo', filtros.grupo);
      if (filtros.filial) query = query.eq('filial', filtros.filial);
      if (filtros.escala) query = query.eq('escala', filtros.escala);
      if (filtros.busca) query = query.ilike('nome', `%${filtros.busca}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async buscarPorId(id) {
      if (!permissaoLiberada(agenteLogado() ? 'visualizar_propria_escala' : 'visualizar_colaboradores')) return null;
      const { data, error } = await db.from('colaboradores').select('*').eq('id', id).single();
      if (error) throw error;
      if (agenteLogado() && String(data?.email || '').toLowerCase() !== emailLogado()) {
        throw new Error('Acesso negado ao colaborador solicitado.');
      }
      return data;
    },
    async criar(dados) {
      if (!permissaoLiberada('cadastrar_colaborador')) return null;
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('colaboradores').insert([payload]).select().single();
      if (error) throw error;
      await registrarAuditoria('colaboradores', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      if (!permissaoLiberada('editar_colaborador')) return null;
      const anterior = await this.buscarPorId(id);
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('colaboradores').update(payload).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('colaboradores', 'UPDATE', id, anterior, data);
      return data;
    },
    async excluir(id) {
      if (!permissaoLiberada('excluir_colaborador')) return null;
      const anterior = await this.buscarPorId(id);
      const { error } = await db.from('colaboradores').delete().eq('id', id);
      if (error) throw error;
      await registrarAuditoria('colaboradores', 'DELETE', id, anterior, null);
    },
    async importarLote(lista) {
      if (!permissaoLiberada('importar_dados')) return [];
      const payload = lista.map(d => calcularCamposAuto(d));
      const { data, error } = await db.from('colaboradores').upsert(payload, { onConflict: 'matricula' }).select();
      if (error) throw error;
      return data;
    },
    async contar() {
      if (!permissaoLiberada('visualizar_dashboard')) return 0;
      const { count, error } = await db.from('colaboradores').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    async contarPorStatus(status) {
      if (!permissaoLiberada('visualizar_dashboard')) return 0;
      const { count, error } = await db.from('colaboradores').select('*', { count: 'exact', head: true }).eq('status', status);
      if (error) throw error;
      return count || 0;
    }
  },

  // ---------- STAFF ----------
  staff: {
    async listar(filtros = {}) {
      if (!permissaoLiberada('visualizar_staff')) return [];
      let query = db.from('staff').select('*').order('nome');
      if (filtros.status) query = query.eq('status', filtros.status);
      if (filtros.celula) query = query.eq('celula', filtros.celula);
      if (filtros.busca) query = query.ilike('nome', `%${filtros.busca}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async buscarPorId(id) {
      if (!permissaoLiberada('visualizar_staff')) return null;
      const { data, error } = await db.from('staff').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async criar(dados) {
      if (!permissaoLiberada('cadastrar_staff')) return null;
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('staff').insert([payload]).select().single();
      if (error) throw error;
      await registrarAuditoria('staff', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      if (!permissaoLiberada('editar_staff')) return null;
      const anterior = await this.buscarPorId(id);
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('staff').update(payload).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('staff', 'UPDATE', id, anterior, data);
      return data;
    },
    async excluir(id) {
      if (!permissaoLiberada('excluir_staff')) return null;
      const anterior = await this.buscarPorId(id);
      const { error } = await db.from('staff').delete().eq('id', id);
      if (error) throw error;
      await registrarAuditoria('staff', 'DELETE', id, anterior, null);
    }
  },

  // ---------- ESCALAS ----------
  escalas: {
    async listar(filtros = {}) {
      if (!permissaoLiberada(agenteLogado() ? 'visualizar_propria_escala' : 'visualizar_escalas')) return [];
      let query = db.from('escalas').select('*').order('data', { ascending: false });
      if (agenteLogado()) {
        const id = colaboradorLogadoId();
        if (!id) return [];
        query = query.eq('colaborador_id', id);
      }
      if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
      if (filtros.data_inicio) query = query.gte('data', filtros.data_inicio);
      if (filtros.data_fim) query = query.lte('data', filtros.data_fim);
      if (filtros.tipo) query = query.eq('tipo_alteracao', filtros.tipo);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async criar(dados) {
      if (!permissaoLiberada('cadastrar_escala')) return null;
      const { data, error } = await db.from('escalas').insert([dados]).select().single();
      if (error) throw error;
      await registrarAuditoria('escalas', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      if (!permissaoLiberada('editar_escala')) return null;
      const { data, error } = await db.from('escalas').update(dados).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('escalas', 'UPDATE', id, null, data);
      return data;
    },
    async excluir(id) {
      if (!permissaoLiberada('excluir_escala')) return null;
      const { error } = await db.from('escalas').delete().eq('id', id);
      if (error) throw error;
    },
    async listarPorData(data) {
      if (!permissaoLiberada(agenteLogado() ? 'visualizar_propria_escala' : 'visualizar_escalas')) return [];
      let query = db.from('escalas').select('*').eq('data', data);
      if (agenteLogado()) query = query.eq('colaborador_id', colaboradorLogadoId());
      const { data: rows, error } = await query;
      if (error) throw error;
      return rows || [];
    },
    async importarLote(registros) {
      if (!permissaoLiberada('importar_escala')) return [];
      const limpos = (registros || []).map(r => ({
        ...r,
        colaborador_id: r.colaborador_id || null,
        hora_extra: r.hora_extra === '' ? null : r.hora_extra
      }));

      const { data, error } = await db
        .from('escalas')
        .upsert(limpos, { onConflict: 'colaborador_id,data' })
        .select();
      if (error) throw error;
      return data || [];
    }
  },

  // ---------- PROGRAMAÇÕES ----------
  programacoes: {
    async listar(filtros = {}) {
      if (!permissaoLiberada('visualizar_programacoes')) return [];
      let query = db.from('programacoes').select('*').order('data_inicio', { ascending: false });
      if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
      if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
      if (filtros.status) query = query.eq('status', filtros.status);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async criar(dados) {
      if (!permissaoLiberada('cadastrar_programacao')) return null;
      const { data, error } = await db.from('programacoes').insert([dados]).select().single();
      if (error) throw error;
      await registrarAuditoria('programacoes', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      if (!permissaoLiberada('editar_programacao')) return null;
      const { data, error } = await db.from('programacoes').update(dados).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('programacoes', 'UPDATE', id, null, data);
      return data;
    },
    async excluir(id) {
      if (!permissaoLiberada('excluir_programacao')) return null;
      const { error } = await db.from('programacoes').delete().eq('id', id);
      if (error) throw error;
    },
    async aprovar(id, usuario) {
      if (!permissaoLiberada('aprovar_programacao')) return null;
      const { data, error } = await db.from('programacoes').update({
        aprovado: true,
        aprovado_por: usuario,
        aprovado_em: new Date().toISOString(),
        status: 'Aprovado'
      }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
  },

  // ---------- AUDITORIA ----------
  auditoria: {
    async listar(limite = 100) {
      if (!permissaoLiberada('ver_auditoria')) return [];
      const { data, error } = await db.from('auditoria').select('*').order('created_at', { ascending: false }).limit(limite);
      if (error) throw error;
      return data || [];
    }
  },

  // ---------- CONFIGURAÇÕES ----------
  configuracoes: {
    async listar() {
      if (!temPermissao('acessar_configuracoes')) return {};
      const { data, error } = await db.from('configuracoes').select('*');
      if (error) throw error;
      const obj = {};
      (data || []).forEach(row => { obj[row.chave] = row.valor; });
      return obj;
    },
    async salvar(chave, valor) {
      if (!permissaoLiberada('acessar_configuracoes')) return null;
      const { data, error } = await db.from('configuracoes').upsert({ chave, valor }, { onConflict: 'chave' }).select().single();
      if (error) throw error;
      return data;
    }
  },

  // ---------- USUARIOS AUTORIZADOS ----------
  usuariosAutorizados: {
    async listar() {
      if (!permissaoLiberada('gerenciar_usuarios')) return [];
      const { data, error } = await db
        .from('usuarios_autorizados')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    async salvar(dados) {
      if (!permissaoLiberada('gerenciar_usuarios')) return null;
      const payload = {
        email: String(dados.email || '').trim().toLowerCase(),
        nome: String(dados.nome || '').trim(),
        perfil: String(dados.perfil || 'CONSULTA').trim().toUpperCase(),
        status: String(dados.status || 'Ativo').trim()
      };
      const { data, error } = await db
        .from('usuarios_autorizados')
        .upsert(payload, { onConflict: 'email' })
        .select()
        .single();
      if (error) throw error;
      await registrarAuditoria('usuarios_autorizados', 'UPSERT', data.id, null, data);
      return data;
    },
    async atualizarStatus(id, status) {
      if (!permissaoLiberada('gerenciar_usuarios')) return null;
      const { data, error } = await db
        .from('usuarios_autorizados')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await registrarAuditoria('usuarios_autorizados', 'UPDATE_STATUS', id, null, data);
      return data;
    }
  },

  // ---------- PERFORMANCE OPERACIONAL ----------
  performance: {
    async listar(filtros = {}) {
      if (!permissaoLiberada('visualizar_performance_operacional')) {
        return { mop: [], atendimento: [], csat: [], agentHistory: [] };
      }
      const competencia = filtros.competencia_mes;
      const [mop, atendimento, csat, agentHistory] = await Promise.all([
        listarTabelaPerformancePaginada('performance_mop', competencia, ['colaborador_nome', 'id']),
        listarTabelaPerformancePaginada('performance_atendimento', competencia, ['data_referencia', 'id']),
        listarTabelaPerformancePaginada('performance_csat', competencia, ['data_referencia', 'id']),
        listarTabelaPerformancePaginada('performance_agent_history', competencia, ['data_referencia', 'id'])
      ]);
      return {
        mop,
        atendimento: enriquecerRegistrosPerformance(atendimento, mop),
        csat: enriquecerRegistrosPerformance(csat, mop),
        agentHistory: enriquecerRegistrosPerformance(agentHistory, mop)
      };
    },
    async listarResumo(filtros = {}) {
      return this.listar(filtros);
    },
    async listarRanking(filtros = {}) {
      const dados = await this.listar(filtros);
      return { atendimento: dados.atendimento, csat: dados.csat };
    },
    async listarProdutividadePorDia(filtros = {}) {
      return (await this.listar(filtros)).atendimento;
    },
    async listarCsatPorDia(filtros = {}) {
      return (await this.listar(filtros)).csat;
    },
    async importarMes({ competencia_mes, tipo_arquivo, nome_arquivo, registros, observacao = '' }) {
      if (!permissaoLiberada('importar_performance_operacional')) return null;
      if (tipo_arquivo === 'mop') {
        return this.importarMopDireto({ competencia_mes, nome_arquivo, registros, observacao });
      }
      if (tipo_arquivo === 'agent_history') {
        return this.importarAgentHistoryDireto({ competencia_mes, nome_arquivo, registros, observacao });
      }
      const rpc = 'importar_performance_mes';
      const parametros = {
        p_competencia_mes: competencia_mes,
        p_nome_arquivo: nome_arquivo,
        p_registros: registros || [],
        p_observacao: observacao
      };
      if (tipo_arquivo !== 'mop') parametros.p_tipo_arquivo = tipo_arquivo;
      const { data, error } = await db.rpc(rpc, parametros);
      if (error?.code === 'PGRST202' || error?.message?.includes('importar_performance_mes')) {
        throw new Error(`A RPC ${rpc} ainda não está disponível no Supabase. Execute o SQL de reparo indicado e recarregue a página.`);
      }
      if (error) throw error;
      return data;
    },
    async importarMopDireto({ competencia_mes, nome_arquivo, registros, observacao = '' }) {
      if (!permissaoLiberada('importar_performance_operacional')) return null;
      const payload = (registros || []).map(registro => ({
        ...registro,
        competencia_mes,
        chave_colaborador: chaveColaboradorPerformance(registro)
      })).filter(registro => registro.chave_colaborador);

      const { data: anteriores, error: selectError } = await db
        .from('performance_mop')
        .select('*')
        .eq('competencia_mes', competencia_mes);
      if (selectError) throw selectError;

      const { error: deleteError } = await db
        .from('performance_mop')
        .delete()
        .eq('competencia_mes', competencia_mes);
      if (deleteError) throw deleteError;

      const restaurarAnteriores = async () => {
        const { error: limparError } = await db
          .from('performance_mop')
          .delete()
          .eq('competencia_mes', competencia_mes);
        if (limparError) throw limparError;

        const backup = (anteriores || []).map(({ id, created_at, ...registro }) => registro);
        if (backup.length) {
          const { error: restoreError } = await db.from('performance_mop').insert(backup);
          if (restoreError) throw restoreError;
        }
      };

      try {
        if (payload.length) {
          const { error: insertError } = await db
            .from('performance_mop')
            .insert(payload);
          if (insertError) throw insertError;
        }
      } catch (insertError) {
        try {
          await restaurarAnteriores();
        } catch (restoreError) {
          throw new Error(`${insertError.message}. A restauração automática da MOP anterior também falhou: ${restoreError.message}`);
        }
        throw insertError;
      }

      try {
        await this.registrarImportacao({
          competencia_mes,
          tipo_arquivo: 'mop',
          nome_arquivo,
          total_registros: payload.length,
          status: 'sucesso',
          observacao
        });
      } catch (logError) {
        try {
          await restaurarAnteriores();
        } catch (restoreError) {
          throw new Error(`${logError.message}. A restauração automática da MOP anterior também falhou: ${restoreError.message}`);
        }
        throw logError;
      }
      return payload.length;
    },
    async importarAgentHistoryDireto({ competencia_mes, nome_arquivo, registros, observacao = '' }) {
      if (!permissaoLiberada('importar_performance_operacional')) return null;
      const payload = (registros || [])
        .map(registro => sanitizarAgentHistoryPerformance(registro, competencia_mes))
        .filter(registro => registro.data_referencia && (registro.agent_identity || registro.agent_email || registro.agent_name));

      const anteriores = await listarTabelaPerformancePaginada(
        'performance_agent_history',
        competencia_mes,
        ['data_referencia', 'id']
      );

      const { error: deleteError } = await db
        .from('performance_agent_history')
        .delete()
        .eq('competencia_mes', competencia_mes);
      if (deleteError) throw deleteError;

      const tamanhoLote = 400;
      const inserirLotes = async lista => {
        let total = 0;
        for (let inicio = 0; inicio < lista.length; inicio += tamanhoLote) {
          const lote = lista.slice(inicio, inicio + tamanhoLote);
          const { error: insertError } = await db
            .from('performance_agent_history')
            .insert(lote);
          if (insertError) throw insertError;
          total += lote.length;
        }
        return total;
      };
      const restaurarAnteriores = async () => {
        const { error: limparError } = await db
          .from('performance_agent_history')
          .delete()
          .eq('competencia_mes', competencia_mes);
        if (limparError) throw limparError;
        const backup = (anteriores || []).map(({ id, created_at, ...registro }) => registro);
        if (backup.length) await inserirLotes(backup);
      };
      let totalInseridos = 0;
      try {
        totalInseridos = await inserirLotes(payload);
      } catch (insertError) {
        try {
          await restaurarAnteriores();
        } catch (restoreError) {
          throw new Error(`${insertError.message}. A restauração automática do AgentHistory anterior também falhou: ${restoreError.message}`);
        }
        throw insertError;
      }

      try {
        await this.registrarImportacao({
          competencia_mes,
          tipo_arquivo: 'agent_history',
          nome_arquivo,
          total_registros: totalInseridos,
          status: 'sucesso',
          observacao
        });
      } catch (logError) {
        try {
          await restaurarAnteriores();
        } catch (restoreError) {
          throw new Error(`${logError.message}. A restauração automática do AgentHistory anterior também falhou: ${restoreError.message}`);
        }
        throw logError;
      }
      return totalInseridos;
    },
    async apagarMes(competencia_mes, tipo_arquivo) {
      if (!permissaoLiberada('importar_performance_operacional')) return null;
      const tabelas = {
        mop: 'performance_mop',
        metricas: 'performance_atendimento',
        csat: 'performance_csat',
        agent_history: 'performance_agent_history'
      };
      const tabela = tabelas[tipo_arquivo];
      if (!tabela) throw new Error('Tipo de arquivo de performance inválido.');
      const { error } = await db.from(tabela).delete().eq('competencia_mes', competencia_mes);
      if (error) throw error;
      return true;
    },
    async registrarImportacao(dados) {
      if (!permissaoLiberada('importar_performance_operacional')) return null;
      const payload = {
        ...dados,
        importado_por: dados.importado_por || emailLogado(),
        importado_em: dados.importado_em || new Date().toISOString()
      };
      const { data, error } = await db.from('performance_importacoes').insert([payload]).select().single();
      if (error) throw error;
      return data;
    },
    async listarMesesImportados() {
      if (!permissaoLiberada('visualizar_performance_operacional')) return [];
      const { data, error } = await db
        .from('performance_importacoes')
        .select('competencia_mes,status')
        .order('competencia_mes', { ascending: false });
      if (error) throw error;
      const statusValidos = new Set(['sucesso', 'concluido', 'concluído', 'processado', 'finalizado']);
      return [...new Set((data || [])
        .filter(item => statusValidos.has(String(item.status || '').trim().toLowerCase()))
        .map(item => item.competencia_mes)
        .filter(Boolean))];
    }
  },

  // ---------- REALTIME ----------
  assinarTabela(tabela, callback) {
    if (agenteLogado() && !['escalas'].includes(tabela)) return null;
    return db.channel(`realtime_${tabela}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tabela }, callback)
      .subscribe();
  }
};

// ============================================================
// HELPERS INTERNOS
// ============================================================

function calcularCamposAuto(dados) {
  const d = { ...dados };
  // Calcular idade a partir da data de nascimento
  if (d.data_nasc) {
    const nasc = new Date(d.data_nasc);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    d.idade = idade;
  }
  // Calcular tempo de empresa em meses
  if (d.admissao) {
    const adm = new Date(d.admissao);
    const hoje = new Date();
    const meses = (hoje.getFullYear() - adm.getFullYear()) * 12 + (hoje.getMonth() - adm.getMonth());
    d.tempo_meses = Math.max(0, meses);
  }
  return d;
}

function chaveColaboradorPerformance(registro) {
  const limpar = valor => String(valor || '').trim().toLowerCase();
  const usuarioBlip = limpar(registro.usuario_blip || registro.agent_identity);
  const email = limpar(registro.colaborador_email || registro.agent_email);
  const nome = limpar(registro.colaborador_nome || registro.agent_name);
  if (usuarioBlip) return `blip:${usuarioBlip}`;
  if (email) return `email:${email}`;
  if (nome) return `nome:${nome}`;
  return '';
}

function sanitizarAgentHistoryPerformance(registro, competenciaMes) {
  const texto = valor => valor === null || valor === undefined ? '' : String(valor).trim();
  const numeroOuNulo = valor => valor === null || valor === undefined || valor === '' ? null : Number(valor);
  const payload = {
    competencia_mes: competenciaMes,
    data_referencia: registro.data_referencia || null,
    sequential_id: texto(registro.sequential_id),
    agent_name: texto(registro.agent_name),
    agent_email: texto(registro.agent_email).toLowerCase(),
    agent_identity: texto(registro.agent_identity),
    status: texto(registro.status),
    queue_time_segundos: numeroOuNulo(registro.queue_time_segundos),
    first_response_time_segundos: numeroOuNulo(registro.first_response_time_segundos),
    average_response_time_segundos: numeroOuNulo(registro.average_response_time_segundos),
    close_date: registro.close_date || null,
    origem_arquivo: 'agent_history'
  };
  return payload;
}

async function listarTabelaPerformancePaginada(tabela, competenciaMes, camposOrdenacao = ['id']) {
  const tamanhoPagina = 1000;
  const registros = [];
  let inicio = 0;

  while (true) {
    let query = db.from(tabela).select('*');
    if (competenciaMes) query = query.eq('competencia_mes', competenciaMes);
    camposOrdenacao.forEach(campo => {
      query = query.order(campo, { ascending: true });
    });
    const { data, error } = await query.range(inicio, inicio + tamanhoPagina - 1);
    if (error) throw error;
    const pagina = data || [];
    registros.push(...pagina);
    if (pagina.length < tamanhoPagina) return registros;
    inicio += tamanhoPagina;
  }
}

function enriquecerRegistrosPerformance(registros = [], mop = []) {
  const normalizar = valor => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  const porBlip = new Map();
  const porEmail = new Map();
  const nomes = new Map();

  mop.forEach(item => {
    const blip = normalizar(item.usuario_blip);
    const email = normalizar(item.colaborador_email);
    const nome = normalizar(item.colaborador_nome);
    if (blip) porBlip.set(blip, item);
    if (email) porEmail.set(email, item);
    if (nome) nomes.set(nome, nomes.has(nome) ? null : item);
  });

  return registros.map(registro => {
    const encontrado = porBlip.get(normalizar(registro.usuario_blip || registro.agent_identity))
      || porEmail.get(normalizar(registro.colaborador_email || registro.agent_email))
      || nomes.get(normalizar(registro.colaborador_nome || registro.agent_name));
    if (!encontrado) return registro;
    return {
      ...registro,
      colaborador_nome: encontrado.colaborador_nome || registro.colaborador_nome || registro.agent_name,
      colaborador_email: encontrado.colaborador_email || registro.colaborador_email || registro.agent_email,
      usuario_blip: encontrado.usuario_blip || registro.usuario_blip || registro.agent_identity,
      lider: encontrado.lider || registro.lider || ''
    };
  });
}

async function registrarAuditoria(tabela, operacao, registroId, dadosAnteriores, dadosNovos) {
  try {
    const usuarioAtual = window.Permissions?.estado?.user;
    await db.from('auditoria').insert([{
      tabela,
      operacao,
      registro_id: registroId,
      dados_anteriores: dadosAnteriores,
      dados_novos: dadosNovos,
      usuario: usuarioAtual?.email || 'Sistema',
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    console.warn('Auditoria falhou:', e.message);
  }
}

// Exporta globalmente
window.DB = DB;
window.db = db;
