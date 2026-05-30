-- ============================================================
-- OpGest - Performance Operacional
-- Migration incremental para executar no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS performance_importacoes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  competencia_mes TEXT NOT NULL CHECK (competencia_mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  tipo_arquivo TEXT NOT NULL CHECK (tipo_arquivo IN ('mop','metricas','agent_history','csat')),
  nome_arquivo TEXT NOT NULL,
  total_registros INTEGER NOT NULL DEFAULT 0,
  importado_por TEXT NOT NULL,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sucesso' CHECK (status IN ('sucesso','erro')),
  observacao TEXT
);

CREATE TABLE IF NOT EXISTS performance_mop (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  competencia_mes TEXT NOT NULL CHECK (competencia_mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  colaborador_nome TEXT,
  colaborador_email TEXT,
  usuario_blip TEXT,
  lider TEXT,
  status TEXT,
  origem_arquivo TEXT NOT NULL DEFAULT 'mop',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_atendimento (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  competencia_mes TEXT NOT NULL CHECK (competencia_mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  data_referencia DATE NOT NULL,
  colaborador_nome TEXT,
  colaborador_email TEXT,
  usuario_blip TEXT,
  lider TEXT,
  tickets_finalizados INTEGER NOT NULL DEFAULT 0,
  tm1r_segundos NUMERIC,
  tme_segundos NUMERIC,
  tme_total_segundos NUMERIC,
  tmr_segundos NUMERIC,
  tma_segundos NUMERIC,
  tmaxe_segundos NUMERIC,
  origem_arquivo TEXT NOT NULL DEFAULT 'metricas',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_csat (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  competencia_mes TEXT NOT NULL CHECK (competencia_mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  data_referencia DATE NOT NULL,
  colaborador_nome TEXT,
  colaborador_email TEXT,
  usuario_blip TEXT,
  lider TEXT,
  nota NUMERIC,
  avaliacao_id TEXT,
  origem_arquivo TEXT NOT NULL DEFAULT 'csat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_agent_history (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  competencia_mes TEXT NOT NULL CHECK (competencia_mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  data_referencia DATE NOT NULL,
  sequential_id TEXT,
  agent_name TEXT,
  agent_email TEXT,
  agent_identity TEXT,
  colaborador_nome TEXT,
  colaborador_email TEXT,
  usuario_blip TEXT,
  lider TEXT,
  status TEXT,
  queue_time_segundos NUMERIC,
  first_response_time_segundos NUMERIC,
  average_response_time_segundos NUMERIC,
  close_date DATE,
  origem_arquivo TEXT NOT NULL DEFAULT 'agent_history',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_importacoes_competencia ON performance_importacoes(competencia_mes);
CREATE INDEX IF NOT EXISTS idx_performance_mop_competencia ON performance_mop(competencia_mes);
CREATE INDEX IF NOT EXISTS idx_performance_mop_email ON performance_mop(LOWER(colaborador_email));
CREATE INDEX IF NOT EXISTS idx_performance_mop_blip ON performance_mop(usuario_blip);
CREATE INDEX IF NOT EXISTS idx_performance_atendimento_competencia_data ON performance_atendimento(competencia_mes, data_referencia);
CREATE INDEX IF NOT EXISTS idx_performance_atendimento_lider ON performance_atendimento(lider);
CREATE INDEX IF NOT EXISTS idx_performance_csat_competencia_data ON performance_csat(competencia_mes, data_referencia);
CREATE INDEX IF NOT EXISTS idx_performance_agent_history_competencia_data ON performance_agent_history(competencia_mes, data_referencia);

ALTER TABLE performance_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_mop ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_atendimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_csat ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_agent_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS performance_importacoes_select ON performance_importacoes;
DROP POLICY IF EXISTS performance_importacoes_insert ON performance_importacoes;
DROP POLICY IF EXISTS performance_importacoes_update ON performance_importacoes;
DROP POLICY IF EXISTS performance_importacoes_delete ON performance_importacoes;
DROP POLICY IF EXISTS performance_mop_select ON performance_mop;
DROP POLICY IF EXISTS performance_mop_insert ON performance_mop;
DROP POLICY IF EXISTS performance_mop_update ON performance_mop;
DROP POLICY IF EXISTS performance_mop_delete ON performance_mop;
DROP POLICY IF EXISTS performance_atendimento_select ON performance_atendimento;
DROP POLICY IF EXISTS performance_atendimento_insert ON performance_atendimento;
DROP POLICY IF EXISTS performance_atendimento_update ON performance_atendimento;
DROP POLICY IF EXISTS performance_atendimento_delete ON performance_atendimento;
DROP POLICY IF EXISTS performance_csat_select ON performance_csat;
DROP POLICY IF EXISTS performance_csat_insert ON performance_csat;
DROP POLICY IF EXISTS performance_csat_update ON performance_csat;
DROP POLICY IF EXISTS performance_csat_delete ON performance_csat;
DROP POLICY IF EXISTS performance_agent_history_select ON performance_agent_history;
DROP POLICY IF EXISTS performance_agent_history_insert ON performance_agent_history;
DROP POLICY IF EXISTS performance_agent_history_update ON performance_agent_history;
DROP POLICY IF EXISTS performance_agent_history_delete ON performance_agent_history;

CREATE POLICY performance_importacoes_select ON performance_importacoes
FOR SELECT TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR','CONSULTA']::TEXT[]));
CREATE POLICY performance_importacoes_insert ON performance_importacoes
FOR INSERT TO authenticated WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));
CREATE POLICY performance_importacoes_update ON performance_importacoes
FOR UPDATE TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));
CREATE POLICY performance_importacoes_delete ON performance_importacoes
FOR DELETE TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY performance_mop_select ON performance_mop
FOR SELECT TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR','CONSULTA']::TEXT[]));
CREATE POLICY performance_mop_insert ON performance_mop
FOR INSERT TO authenticated WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));
CREATE POLICY performance_mop_update ON performance_mop
FOR UPDATE TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));
CREATE POLICY performance_mop_delete ON performance_mop
FOR DELETE TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY performance_atendimento_select ON performance_atendimento
FOR SELECT TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR','CONSULTA']::TEXT[]));
CREATE POLICY performance_atendimento_insert ON performance_atendimento
FOR INSERT TO authenticated WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));
CREATE POLICY performance_atendimento_update ON performance_atendimento
FOR UPDATE TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));
CREATE POLICY performance_atendimento_delete ON performance_atendimento
FOR DELETE TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY performance_csat_select ON performance_csat
FOR SELECT TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR','CONSULTA']::TEXT[]));
CREATE POLICY performance_csat_insert ON performance_csat
FOR INSERT TO authenticated WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));
CREATE POLICY performance_csat_update ON performance_csat
FOR UPDATE TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));
CREATE POLICY performance_csat_delete ON performance_csat
FOR DELETE TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

CREATE POLICY performance_agent_history_select ON performance_agent_history
FOR SELECT TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR','CONSULTA']::TEXT[]));
CREATE POLICY performance_agent_history_insert ON performance_agent_history
FOR INSERT TO authenticated WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));
CREATE POLICY performance_agent_history_update ON performance_agent_history
FOR UPDATE TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]))
WITH CHECK (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));
CREATE POLICY performance_agent_history_delete ON performance_agent_history
FOR DELETE TO authenticated USING (app_has_profile(ARRAY['ADMIN','GESTOR']::TEXT[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON performance_importacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_mop TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_atendimento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_csat TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON performance_agent_history TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

CREATE OR REPLACE FUNCTION importar_performance_mes(
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

REVOKE ALL ON FUNCTION importar_performance_mes(TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION importar_performance_mes(TEXT, TEXT, TEXT, JSONB, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION importar_performance_mes(TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;

-- Atualiza o cache da Data API para expor imediatamente a RPC nova.
NOTIFY pgrst, 'reload schema';
