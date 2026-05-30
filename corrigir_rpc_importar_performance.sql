-- ============================================================
-- OpGest - Reparo isolado da RPC importar_performance_mes
-- Execute este arquivo no SQL Editor do Supabase caso as tabelas
-- de performance existam, mas a Data API não encontre a função.
-- ============================================================

CREATE OR REPLACE FUNCTION public.importar_performance_mes(
  p_competencia_mes TEXT,
  p_tipo_arquivo TEXT,
  p_nome_arquivo TEXT,
  p_registros JSONB,
  p_observacao TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT := JSONB_ARRAY_LENGTH(COALESCE(p_registros, '[]'::JSONB));
BEGIN
  IF NOT app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]) THEN
    RAISE EXCEPTION 'Perfil sem permissao para importar performance';
  END IF;
  IF p_competencia_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competencia invalida. Use YYYY-MM';
  END IF;

  CASE p_tipo_arquivo
    WHEN 'mop' THEN
      DELETE FROM performance_mop WHERE competencia_mes = p_competencia_mes;
      INSERT INTO performance_mop (
        competencia_mes, colaborador_nome, colaborador_email, usuario_blip, lider, status, origem_arquivo
      )
      SELECT p_competencia_mes, x.colaborador_nome, x.colaborador_email, x.usuario_blip, x.lider, x.status, 'mop'
      FROM JSONB_TO_RECORDSET(COALESCE(p_registros, '[]'::JSONB)) AS x(
        colaborador_nome TEXT, colaborador_email TEXT, usuario_blip TEXT, lider TEXT, status TEXT
      );
    WHEN 'metricas' THEN
      DELETE FROM performance_atendimento WHERE competencia_mes = p_competencia_mes;
      INSERT INTO performance_atendimento (
        competencia_mes, data_referencia, colaborador_nome, colaborador_email, usuario_blip, lider,
        tickets_finalizados, tm1r_segundos, tme_segundos, tme_total_segundos, tmr_segundos,
        tma_segundos, tmaxe_segundos, origem_arquivo
      )
      SELECT p_competencia_mes, x.data_referencia, x.colaborador_nome, x.colaborador_email, x.usuario_blip, x.lider,
        COALESCE(x.tickets_finalizados, 0), x.tm1r_segundos, x.tme_segundos, x.tme_total_segundos, x.tmr_segundos,
        x.tma_segundos, x.tmaxe_segundos, 'metricas'
      FROM JSONB_TO_RECORDSET(COALESCE(p_registros, '[]'::JSONB)) AS x(
        data_referencia DATE, colaborador_nome TEXT, colaborador_email TEXT, usuario_blip TEXT, lider TEXT,
        tickets_finalizados INTEGER, tm1r_segundos NUMERIC, tme_segundos NUMERIC, tme_total_segundos NUMERIC,
        tmr_segundos NUMERIC, tma_segundos NUMERIC, tmaxe_segundos NUMERIC
      );
    WHEN 'csat' THEN
      DELETE FROM performance_csat WHERE competencia_mes = p_competencia_mes;
      INSERT INTO performance_csat (
        competencia_mes, data_referencia, colaborador_nome, colaborador_email, usuario_blip, lider,
        nota, avaliacao_id, origem_arquivo
      )
      SELECT p_competencia_mes, x.data_referencia, x.colaborador_nome, x.colaborador_email, x.usuario_blip, x.lider,
        x.nota, x.avaliacao_id, 'csat'
      FROM JSONB_TO_RECORDSET(COALESCE(p_registros, '[]'::JSONB)) AS x(
        data_referencia DATE, colaborador_nome TEXT, colaborador_email TEXT, usuario_blip TEXT, lider TEXT,
        nota NUMERIC, avaliacao_id TEXT
      );
    WHEN 'agent_history' THEN
      DELETE FROM performance_agent_history WHERE competencia_mes = p_competencia_mes;
      INSERT INTO performance_agent_history (
        competencia_mes, data_referencia, sequential_id, agent_name, agent_email, agent_identity,
        colaborador_nome, colaborador_email, usuario_blip, lider, status, queue_time_segundos,
        first_response_time_segundos, average_response_time_segundos, close_date, origem_arquivo
      )
      SELECT p_competencia_mes, x.data_referencia, x.sequential_id, x.agent_name, x.agent_email, x.agent_identity,
        x.colaborador_nome, x.colaborador_email, x.usuario_blip, x.lider, x.status, x.queue_time_segundos,
        x.first_response_time_segundos, x.average_response_time_segundos, x.close_date, 'agent_history'
      FROM JSONB_TO_RECORDSET(COALESCE(p_registros, '[]'::JSONB)) AS x(
        data_referencia DATE, sequential_id TEXT, agent_name TEXT, agent_email TEXT, agent_identity TEXT,
        colaborador_nome TEXT, colaborador_email TEXT, usuario_blip TEXT, lider TEXT, status TEXT,
        queue_time_segundos NUMERIC, first_response_time_segundos NUMERIC, average_response_time_segundos NUMERIC,
        close_date DATE
      );
    ELSE
      RAISE EXCEPTION 'Tipo de arquivo de performance invalido';
  END CASE;

  INSERT INTO performance_importacoes (
    competencia_mes, tipo_arquivo, nome_arquivo, total_registros, importado_por, status, observacao
  ) VALUES (
    p_competencia_mes, p_tipo_arquivo, p_nome_arquivo, v_total, app_user_email(), 'sucesso', p_observacao
  );

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.importar_performance_mes(TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.importar_performance_mes(TEXT, TEXT, TEXT, JSONB, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.importar_performance_mes(TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT
  routine_schema,
  routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'importar_performance_mes';
