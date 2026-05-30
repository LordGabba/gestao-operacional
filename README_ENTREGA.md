# OpGest - Entrega Performance Operacional

## Resumo

Esta entrega adiciona a aba **Performance Operacional** sem remover fluxos existentes.

Foram incluídos:

- menu lateral, breadcrumb e carregamento da página;
- permissões visuais `visualizar_performance_operacional` e `importar_performance_operacional`;
- filtros por mês, período, líder e colaborador;
- cards, gráficos leves, ranking, busca e pontos de atenção;
- importação CSV/XLSX com prévia, contagem e inconsistências de relacionamento com a MOP;
- média ponderada por tickets finalizados para TM1.R, TME, TMR e TMA;
- CSAT por notas 4 e 5 dividido pelo total de avaliações;
- cinco tabelas Supabase, RLS específico e RPC transacional para substituir somente o mês/tipo importado;
- registro de auditoria funcional em `performance_importacoes`.

## Arquivos para substituir

Substitua no projeto original pelos arquivos completos desta pasta:

1. `index.html`
2. `style.css`
3. `script.js`
4. `supabase.js`
5. `permissions.js`
6. `security.js`
7. `supabase_schema.sql`

Mantenha também `auth.js` na mesma pasta do `index.html`. A entrega inclui uma cópia preservada do arquivo original porque ele é necessário para inicializar o login Google.

O arquivo `performance_operacional.sql` é novo. Ele foi separado para permitir aplicação incremental em uma base Supabase já existente.

## Banco de dados

Para uma base já existente:

1. Abra o SQL Editor do Supabase.
2. Execute todo o conteúdo de `performance_operacional.sql`.
3. Confirme que a execução terminou sem erros.

Para uma instalação nova:

1. Execute `supabase_schema.sql`.
2. Execute `performance_operacional.sql`.

A migration cria:

- `performance_importacoes`
- `performance_mop`
- `performance_atendimento`
- `performance_csat`
- `performance_agent_history`
- função RPC `importar_performance_mes(...)`
- policies RLS de `SELECT`, `INSERT`, `UPDATE` e `DELETE` para cada tabela.

## Regra de segurança

- `ADMIN`: visualiza e importa.
- `GESTOR`: visualiza e importa.
- `CONSULTA`: somente visualiza.
- `AGENTE`: não acessa a aba nem as tabelas.
- `BLOQUEADO` e `INATIVO`: sem acesso.

O front-end oculta menus e bloqueia ações como camada complementar. A proteção definitiva é feita pelas policies RLS e pela RPC no Supabase. Não foi adicionada nenhuma `service_role` ao navegador e nenhuma policy aberta para `anon`.

## Regra de substituição mensal

Cada confirmação chama a RPC transacional por tipo de arquivo:

1. valida perfil `ADMIN` ou `GESTOR`;
2. valida competência no formato `YYYY-MM`;
3. apaga registros antigos somente da tabela correspondente e somente daquela competência;
4. insere os registros novos;
5. grava `performance_importacoes`;
6. confirma tudo na mesma transação.

## Checklist funcional

- [ ] A aba “Performance Operacional” aparece no menu lateral?
- [ ] A navegação funciona?
- [ ] O breadcrumb mostra “Performance Operacional”?
- [ ] O perfil ADMIN acessa?
- [ ] O perfil GESTOR acessa?
- [ ] O perfil CONSULTA visualiza?
- [ ] O perfil AGENTE não acessa?
- [ ] A importação por mês substitui apenas o mês selecionado?
- [ ] Os filtros de líder, colaborador, mês e data funcionam?
- [ ] Os cards recalculam ao filtrar?
- [ ] Os gráficos recalculam ao filtrar?
- [ ] A tabela de ranking recalcula ao filtrar?
- [ ] A média dos tempos usa ponderação por tickets finalizados?
- [ ] CSAT usa notas 4 e 5 dividido pelo total de avaliações?
- [ ] O restante do site continua funcionando?
- [ ] Não houve alteração indevida nas abas existentes?

## Checklist de segurança

- [ ] As novas tabelas estão com RLS habilitado?
- [ ] Existem policies específicas para SELECT, INSERT, UPDATE e DELETE?
- [ ] ADMIN tem acesso total conforme perfil?
- [ ] GESTOR consegue visualizar e importar sem acesso indevido a configurações críticas?
- [ ] CONSULTA consegue apenas visualizar?
- [ ] AGENTE não consegue acessar as métricas?
- [ ] Um usuário sem permissão é bloqueado mesmo tentando acessar pelo console?
- [ ] Nenhuma chave `service_role` foi colocada no front-end?
- [ ] Nenhuma policy aberta para `anon` foi criada?
- [ ] A segurança não depende apenas de esconder botão ou aba no HTML?

## Validação executada nesta entrega

- parsing de `script.js`, `supabase.js`, `permissions.js` e `security.js`;
- busca de duplicidade das 17 funções obrigatórias;
- correspondência dos IDs principais entre HTML e JavaScript;
- teste automatizado de conversão de tempos;
- teste automatizado de média ponderada com preferência por TME total;
- teste automatizado de CSAT;
- teste automatizado da prioridade de relacionamento MOP: Usuário Blip, depois e-mail, depois nome.

O script opcional `verify-performance.js` reproduz os testes automatizados locais.
