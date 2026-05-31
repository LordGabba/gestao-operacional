// ============================================================
// supabase.js - Módulo de conexão e operações com Supabase
// ============================================================
// Versao de entrega: performance-20260531-08

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

const performancePainelCache = new Map();

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
      const painelAgregado = await listarPainelPerformanceAgregado(competencia);
      if (painelAgregado) {
        const mop = painelAgregado.mop || [];
        const agentHistory = filtros.incluir_agent_history === false
          ? []
          : await this.listarAgentHistory({ competencia_mes: competencia }, mop);
        return {
          mop,
          atendimento: enriquecerRegistrosPerformance(painelAgregado.atendimento || [], mop),
          csat: enriquecerRegistrosPerformance(painelAgregado.csat || [], mop),
          agentHistory
        };
      }
      const [mop, atendimento, csat] = await Promise.all([
        listarTabelaPerformancePaginada(
          'performance_mop',
          competencia,
          ['colaborador_nome', 'id'],
          'id,competencia_mes,chave_colaborador,matricula,colaborador_nome,colaborador_email,usuario_blip,user_jira,lider,reporte,supervisor,status,celula,grupo,cargo'
        ),
        listarTabelaPerformancePaginada(
          'performance_atendimento',
          competencia,
          ['data_referencia', 'id'],
          'id,competencia_mes,chave_colaborador,data_referencia,colaborador_nome,colaborador_email,usuario_blip,lider,total_tickets,tickets_finalizados,tm1r_segundos,tme_segundos,tme_total_segundos,tmr_segundos,tma_segundos,tmaxe_segundos'
        ),
        listarTabelaPerformancePaginada(
          'performance_csat',
          competencia,
          ['data_referencia', 'id'],
          'id,competencia_mes,chave_colaborador,data_referencia,colaborador_nome,colaborador_email,usuario_blip,lider,nota'
        )
      ]);
      const agentHistory = filtros.incluir_agent_history === false
        ? []
        : await this.listarAgentHistory({ competencia_mes: competencia }, mop);
      return {
        mop,
        atendimento: enriquecerRegistrosPerformance(atendimento, mop),
        csat: enriquecerRegistrosPerformance(csat, mop),
        agentHistory
      };
    },
    async listarAgentHistory(filtros = {}, mop = []) {
      if (!permissaoLiberada('visualizar_performance_operacional')) return [];
      const agentHistory = await listarTabelaPerformancePaginada(
        'performance_agent_history',
        filtros.competencia_mes,
        ['data_referencia', 'id'],
        'id,competencia_mes,data_referencia,sequential_id,agent_name,agent_email,agent_identity,status,queue_time_segundos,first_response_time_segundos,average_response_time_segundos,close_date'
      );
      return enriquecerRegistrosPerformance(agentHistory, mop);
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
    async contarRegistrosSubstituidos(tipo_arquivo, competencia_mes, competencia_data = '', tipo_importacao = 'DIARIA') {
      if (!permissaoLiberada('visualizar_performance_operacional')) return 0;
      const tabelas = {
        mop: 'performance_mop',
        metricas: 'performance_atendimento',
        csat: 'performance_csat',
        agent_history: 'performance_agent_history'
      };
      const tabela = tabelas[tipo_arquivo];
      if (!tabela) return 0;
      let query = db.from(tabela).select('id', { count: 'exact', head: true }).eq('competencia_mes', competencia_mes);
      if (tipo_arquivo !== 'mop' && tipo_importacao === 'DIARIA' && competencia_data) query = query.eq('data_referencia', competencia_data);
      const { count, error } = await query;
      if (error) throw error;
      return Number(count) || 0;
    },
    async importarMes({ competencia_mes, competencia_data, tipo_importacao = 'DIARIA', tipo_arquivo, nome_arquivo, registros, observacao = '' }) {
      if (!permissaoLiberada('importar_performance_operacional')) return null;
      const tipoImportacao = tipo_importacao === 'MENSAL' || tipo_arquivo === 'mop' ? 'MENSAL' : 'DIARIA';
      const competenciaData = tipoImportacao === 'DIARIA' ? normalizarCompetenciaDataPerformance(competencia_data, competencia_mes, registros) : '';
      const competenciaMes = tipoImportacao === 'MENSAL' ? String(competencia_mes || '').slice(0, 7) : competenciaData.slice(0, 7);
      if (!competenciaMes) throw new Error('Selecione uma data válida para importar a performance.');
      if (tipo_arquivo === 'mop') {
        return this.importarMopDireto({ competencia_mes: competenciaMes, competencia_data: competenciaData, nome_arquivo, registros, observacao });
      }
      if (tipo_arquivo === 'agent_history') {
        return this.importarAgentHistoryDireto({ competencia_mes: competenciaMes, competencia_data: competenciaData, tipo_importacao: tipoImportacao, nome_arquivo, registros, observacao });
      }
      const rpc = tipoImportacao === 'MENSAL' ? 'importar_performance_mes' : 'importar_performance_dia';
      const parametros = tipoImportacao === 'MENSAL'
        ? { p_competencia_mes: competenciaMes, p_tipo_arquivo: tipo_arquivo, p_nome_arquivo: nome_arquivo, p_registros: registros || [], p_observacao: observacao }
        : { p_competencia_data: competenciaData, p_tipo_arquivo: tipo_arquivo, p_nome_arquivo: nome_arquivo, p_registros: registros || [], p_observacao: observacao };
      const { data, error } = await db.rpc(rpc, parametros);
      if (error?.code === 'PGRST202' || error?.message?.includes(rpc)) {
        throw new Error(`A RPC ${rpc} ainda não está disponível no Supabase. Execute o SQL de reparo indicado e recarregue a página.`);
      }
      if (error) throw error;
      invalidarCachePerformance(competenciaMes);
      return data;
    },
    async importarMopDireto({ competencia_mes, competencia_data, nome_arquivo, registros, observacao = '' }) {
      if (!permissaoLiberada('importar_performance_operacional')) return null;
      const payload = (registros || []).map(registro => ({
        competencia_mes,
        chave_colaborador: chaveColaboradorPerformance(registro),
        colaborador_nome: registro.colaborador_nome || '',
        colaborador_email: registro.colaborador_email || '',
        usuario_blip: registro.usuario_blip || '',
        matricula: registro.matricula || '',
        user_jira: registro.user_jira || '',
        lider: registro.lider || '',
        reporte: registro.reporte || '',
        supervisor: registro.supervisor || '',
        celula: registro.celula || '',
        grupo: registro.grupo || '',
        cargo: registro.cargo || '',
        status: registro.status || 'Ativo',
        origem_arquivo: 'mop'
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
          competencia_data: null,
          tipo_importacao: 'MENSAL',
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
      invalidarCachePerformance(competencia_mes);
      return payload.length;
    },
    async importarAgentHistoryDireto({ competencia_mes, competencia_data, tipo_importacao = 'DIARIA', nome_arquivo, registros, observacao = '' }) {
      if (!permissaoLiberada('importar_performance_operacional')) return null;
      const mensal = tipo_importacao === 'MENSAL';
      const competenciaData = mensal ? '' : normalizarCompetenciaDataPerformance(competencia_data, competencia_mes, registros);
      if (!mensal && !competenciaData) throw new Error('Selecione uma data válida para importar o AgentHistory.');
      const payload = (registros || [])
        .map(registro => sanitizarAgentHistoryPerformance(registro, competencia_mes))
        .filter(registro => (mensal ? registro.data_referencia?.slice(0, 7) === competencia_mes : registro.data_referencia === competenciaData)
          && (registro.agent_identity || registro.agent_email || registro.agent_name));
      if (!payload.length) throw new Error(`Nenhum registro válido de AgentHistory para ${mensal ? 'o mês' : 'o dia'} selecionado.`);

      const anteriores = await listarTabelaPerformancePaginada(
        'performance_agent_history',
        competencia_mes,
        ['data_referencia', 'id'],
        '*',
        mensal ? {} : { data_referencia: competenciaData }
      );

      let deleteQuery = db
        .from('performance_agent_history')
        .delete()
        .eq('competencia_mes', competencia_mes);
      if (!mensal) deleteQuery = deleteQuery.eq('data_referencia', competenciaData);
      const { error: deleteError } = await deleteQuery;
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
        let limparQuery = db
          .from('performance_agent_history')
          .delete()
          .eq('competencia_mes', competencia_mes);
        if (!mensal) limparQuery = limparQuery.eq('data_referencia', competenciaData);
        const { error: limparError } = await limparQuery;
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
          competencia_data: mensal ? null : competenciaData,
          tipo_importacao: mensal ? 'MENSAL' : 'DIARIA',
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
      invalidarCachePerformance(competencia_mes);
      return totalInseridos;
    },
    async apagarMes(competencia_mes, tipo_arquivo, competencia_data = '') {
      if (!permissaoLiberada('importar_performance_operacional')) return null;
      const tabelas = {
        mop: 'performance_mop',
        metricas: 'performance_atendimento',
        csat: 'performance_csat',
        agent_history: 'performance_agent_history'
      };
      const tabela = tabelas[tipo_arquivo];
      if (!tabela) throw new Error('Tipo de arquivo de performance inválido.');
      let query = db.from(tabela).delete().eq('competencia_mes', competencia_mes);
      if (tipo_arquivo !== 'mop' && competencia_data) query = query.eq('data_referencia', competencia_data);
      const { error } = await query;
      if (error) throw error;
      invalidarCachePerformance(competencia_mes);
      return true;
    },
    async registrarImportacao(dados) {
      if (!permissaoLiberada('importar_performance_operacional')) return null;
      const payload = {
        ...dados,
        importado_por: dados.importado_por || emailLogado(),
        importado_em: dados.importado_em || new Date().toISOString()
      };
      let { data, error } = await db.from('performance_importacoes').insert([payload]).select().single();
      const registroDuplicado = error?.code === '23505' || error?.message?.includes('duplicate key');
      if (registroDuplicado) {
        let query = db
          .from('performance_importacoes')
          .update(payload)
          .eq('tipo_arquivo', payload.tipo_arquivo);
        query = payload.competencia_data
          ? query.eq('competencia_data', payload.competencia_data)
          : query.eq('competencia_mes', payload.competencia_mes);
        ({ data, error } = await query.select().single());
      }
      if (error) throw error;
      return data;
    },
    async listarMesesImportados() {
      if (!permissaoLiberada('visualizar_performance_operacional')) return [];
      const { data, error } = await aguardarConsultaPerformance(
        db
          .from('performance_importacoes')
          .select('competencia_mes,status')
          .order('competencia_mes', { ascending: false }),
        'competências importadas'
      );
      if (error) throw error;
      const statusValidos = new Set(['sucesso', 'concluido', 'concluído', 'processado', 'finalizado']);
      return [...new Set((data || [])
        .filter(item => statusValidos.has(String(item.status || '').trim().toLowerCase()))
        .map(item => item.competencia_mes)
        .filter(Boolean))];
    },
    async listarImportacoes(limite = 20) {
      if (!permissaoLiberada('visualizar_performance_operacional')) return [];
      const { data, error } = await aguardarConsultaPerformance(
        db
          .from('performance_importacoes')
          .select('competencia_mes,competencia_data,tipo_importacao,tipo_arquivo,nome_arquivo,total_registros,status,importado_em')
          .order('importado_em', { ascending: false })
          .limit(limite),
        'histÃ³rico de importaÃ§Ãµes'
      );
      if (error) throw error;
      return data || [];
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
  const limpar = valor => String(valor || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const usuarioBlip = limpar(registro.usuario_blip || registro.agent_identity);
  const email = limpar(registro.colaborador_email || registro.agent_email);
  const nome = limpar(registro.colaborador_nome || registro.agent_name);
  const matricula = limpar(registro.matricula);
  if (usuarioBlip) return `blip:${usuarioBlip}`;
  if (email) return `email:${email}`;
  if (nome) return `nome:${nome}`;
  if (matricula) return `matricula:${matricula}`;
  return '';
}

function normalizarCompetenciaDataPerformance(competenciaData, competenciaMes = '', registros = []) {
  const dataInformada = String(competenciaData || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataInformada)) return dataInformada;
  const dataRegistro = (registros || []).map(item => String(item.data_referencia || '').slice(0, 10))
    .find(data => /^\d{4}-\d{2}-\d{2}$/.test(data));
  if (dataRegistro) return dataRegistro;
  return /^\d{4}-\d{2}$/.test(String(competenciaMes || '')) ? `${competenciaMes}-01` : '';
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
    atendimento_segundos: numeroOuNulo(registro.atendimento_segundos),
    storage_date: registro.storage_date || null,
    close_date: registro.close_date || null,
    linha_origem: registro.linha_origem || null,
    origem_arquivo: 'agent_history'
  };
  return payload;
}

async function listarTabelaPerformancePaginada(tabela, competenciaMes, camposOrdenacao = ['id'], campos = '*', filtrosExtras = {}) {
  const tamanhoPagina = 1000;
  const limitePaginas = 500;
  const registros = [];
  const assinaturas = new Set();
  let inicio = 0;

  for (let paginaNumero = 0; paginaNumero < limitePaginas; paginaNumero += 1) {
    let query = db.from(tabela).select(campos);
    if (competenciaMes) query = query.eq('competencia_mes', competenciaMes);
    Object.entries(filtrosExtras).forEach(([campo, valor]) => {
      if (valor !== null && valor !== undefined && valor !== '') query = query.eq(campo, valor);
    });
    camposOrdenacao.forEach(campo => {
      query = query.order(campo, { ascending: true });
    });
    const { data, error } = await aguardarConsultaPerformance(
      query.range(inicio, inicio + tamanhoPagina - 1),
      tabela
    );
    if (error) throw error;
    const pagina = data || [];
    if (!pagina.length) return registros;
    const primeiro = pagina[0];
    const ultimo = pagina[pagina.length - 1];
    const assinatura = JSON.stringify([
      pagina.length,
      primeiro?.id ?? primeiro,
      ultimo?.id ?? ultimo
    ]);
    if (assinaturas.has(assinatura)) {
      throw new Error(`A paginação de ${tabela} repetiu dados. Recarregue a página e tente novamente.`);
    }
    assinaturas.add(assinatura);
    registros.push(...pagina);
    inicio += pagina.length;
  }
  throw new Error(`A consulta de ${tabela} excedeu o limite de segurança de paginação.`);
}

async function listarPainelPerformanceAgregado(competenciaMes) {
  if (!competenciaMes || typeof db.rpc !== 'function') return null;
  if (performancePainelCache.has(competenciaMes)) return performancePainelCache.get(competenciaMes);
  const { data, error } = await aguardarConsultaPerformance(
    db.rpc('listar_performance_painel', { p_competencia_mes: competenciaMes }),
    'painel agregado de performance'
  );
  if (error?.code === 'PGRST202' || error?.message?.includes('listar_performance_painel')) return null;
  if (error) throw error;
  if (!data) return null;
  const painel = typeof data === 'string' ? JSON.parse(data) : data;
  performancePainelCache.set(competenciaMes, painel);
  return painel;
}

function invalidarCachePerformance(competenciaMes = '') {
  if (competenciaMes) performancePainelCache.delete(competenciaMes);
  else performancePainelCache.clear();
}

async function aguardarConsultaPerformance(consulta, tabela) {
  let timeoutId;
  const timeout = new Promise((_, rejeitar) => {
    timeoutId = setTimeout(() => rejeitar(new Error(`Tempo limite excedido ao carregar ${tabela}.`)), 30000);
  });
  try {
    return await Promise.race([consulta, timeout]);
  } finally {
    clearTimeout(timeoutId);
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
      chave_colaborador: encontrado.chave_colaborador || chaveColaboradorPerformance(encontrado) || chaveColaboradorPerformance(registro),
      colaborador_nome: encontrado.colaborador_nome || registro.colaborador_nome || registro.agent_name,
      colaborador_email: encontrado.colaborador_email || registro.colaborador_email || registro.agent_email,
      usuario_blip: encontrado.usuario_blip || registro.usuario_blip || registro.agent_identity,
      lider: encontrado.lider || registro.lider || '',
      status: encontrado.status || registro.status || '',
      celula: encontrado.celula || registro.celula || '',
      grupo: encontrado.grupo || registro.grupo || ''
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
