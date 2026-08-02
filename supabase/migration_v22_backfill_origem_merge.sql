-- Migração v22 — corrige a etiqueta "Indicado pela loja" perdida no merge de duplicados
-- Rode isso no SQL Editor do Supabase
--
-- Contexto: muita gente da lista de "quitou o carnê" já era cliente cadastrado (comprou antes).
-- Ao importar como prospect e depois mesclar o duplicado (prospect + cliente com mesmo telefone),
-- o prospect era apagado e o campo "origem" não era copiado pro cliente que sobrou — perdendo a
-- etiqueta. Esse update recupera a etiqueta nesses clientes, usando a lista original de telefones
-- importada. Só marca quem ainda está sem origem (não sobrescreve nada já preenchido).

update public.clientes
set origem = 'Indicado pela loja'
where origem is null
  and regexp_replace(coalesce(telefone, ''), '\D', '', 'g') in (
    '17991884085','16997245108','17996086891','17991987638','17997188853',
    '17991709050','14997161998','17996031030','17996165169','17991195258',
    '17997640451','17997794837','17981483001','17982008288','17981739147',
    '17996552234','17996216656','16997624835','17991905037','17992004313',
    '17997075189','17997176181','17991337169','17997753067','17996445045',
    '17996080079','17991626170','16996049691','11982080791','17992603985',
    '17997449469','1791224304','17992504243','17997142599','17996643428',
    '1735432502','16996418620','17991583159','17997139443','17991966127',
    '17997877324','17981942496','17996313649','17997266923','16997052042',
    '17996072923','17991781560','17997355632','17992127458','17988040939',
    '11988773329','17992784424','17997151172'
  );
