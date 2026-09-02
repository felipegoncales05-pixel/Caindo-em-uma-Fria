window.OPH = window.OPH || {};
window.OPH_BUILD = "DCX-OS-A2.2-AUTH-ISOLATION";
OPH.DEFAULT_STATE = {
  version: 12,
  focusStage: 0,
  visible: {
    government: true,
    h01: true,
    approaches: true,
    preps: true,
    n02: true,
    protocol: true,
    emergencySim: true,
    comms: false
  },
  approaches: {
    assault: true,
    stealth: true,
    con: true,
    selected: "con"
  },
  preps: {
    assault: { equip:false, breach:false, cryo:false, evac:false },
    stealth: { routes:false, tranq:false, passes:false, cryo:false },
    con: { consult:false, intel:false, yumiya:false, cabinet:false, docs:false, creds:false, vehicle:false, route:false, cryo:false, split:false }
  },
  n02: {
    clues: { c1:false, c2:false, c3:false, c4:false, c5:false },
    imageMode: "auto",
  },
  emergency: { level:0, active:false },
  comms: {
    // `timeline` é a fonte canônica FINAL-11. `messages` permanece apenas para compatibilidade com builds antigas.
    messages: [],
    timeline: [],
    sequence: 0,
    clearVersion: 0,
    clearedAt: 0,
    processing: { active:false, targetUid:"all", targetPlayerId:"", label:"PROCESSANDO SOLICITAÇÃO...", until:0 },
    affect: { anger:12, tension:18, euphoria:10, portrait:"normal" },
    operatorProfiles: {},
    // Reaction Sync: estes snapshots representam somente reações que já foram entregues junto de uma fala da Yumiya.
    deliveredAffect: { anger:12, tension:18, euphoria:10, portrait:"normal", preset:"standard", tone:"professional", exclusive:false, updatedAt:0 },
    deliveredOperatorProfiles: {}
  },
  event: null,
  updatedAt: Date.now()
};

OPH.cloneDefault = () => JSON.parse(JSON.stringify(OPH.DEFAULT_STATE));

OPH.PREP_DEFS = {
  assault:[
    ["equip","Kit incapacitante","Armas não letais, contenção pesada e protocolos de imobilização."],
    ["breach","Veículo e inserção","Entrada robusta, ponto de ruptura e retirada preparada."],
    ["cryo","Suporte criogênico","Energia e refrigeração móvel para remover H-01 dormindo."],
    ["evac","Plano de evacuação","Rotas civis mapeadas e zonas que não podem virar combate."]
  ],
  stealth:[
    ["routes","Rotas de patrulha","Turnos, câmeras, pontos cegos e corredores de baixa circulação."],
    ["tranq","Tranquilizantes","Dose, aplicação e recuperação para neutralização silenciosa."],
    ["passes","Acessos técnicos","Credenciais limitadas, portas úteis, dutos e leitura do prédio."],
    ["cryo","Suporte criogênico","Extração silenciosa sem comprometer a cápsula do H-01."]
  ],
  con:[
    ["consult","Consulta da Reina","Reina entra legalmente com Kang e Nadeko; Grace conduz os exames e a equipe coleta inteligência sem invasão."],
    ["intel","Relatório pós-consulta","A DCX consolida acessos, setores, logística, autoridade da Grace e irregularidades encontradas."],
    ["yumiya","Pedido formal de Yumiya","Yumiya apresenta o caso ao gabinete e pede cobertura jurídica para recuperar o ativo."],
    ["cabinet","Autorização do gabinete","O governo valida escopo, proteção civil, uso de força e custódia temporária do H-01."],
    ["docs","Documentos de transferência","Ordem real de movimentação, cadeia de custódia e justificativa de segurança nacional."],
    ["creds","Credenciais e uniformes","Identificação legítima para os agentes envolvidos na transferência."],
    ["vehicle","Veículo governamental","Transporte refrigerado e compatível com a documentação oficial."],
    ["route","Rota de saída","Portões, elevador de carga e trajeto externo tratados como logística normal."],
    ["cryo","Suporte criogênico","Fonte independente de energia e refrigeração para manter H-01 dormindo."],
    ["split","Divisão de equipes","Grupo H remove a cápsula; Reina/Kang/Nadeko respondem ao N-02 se necessário."]
  ]
};

OPH.APPROACHES = {
  assault:{name:"OFENSIVO", proposal:"DIVISÃO 5", color:"#ff6177", risk:[64,84,76],
    desc:"Entrada direta com foco em incapacitação e superioridade tática."},
  stealth:{name:"FURTIVO", proposal:"DIVISÃO 7", color:"#6592ff", risk:[80,48,86],
    desc:"Infiltração silenciosa com tranquilizantes e margem de erro curta."},
  con:{name:"TRAPAÇA", proposal:"YUMIYA + GABINETE", color:"#ffcf66", risk:[34,20,46],
    desc:"Consulta legítima + inteligência da Reina + autorização, documentos, credenciais e veículos reais."}
};

OPH.N02_PUBLIC = [
  {id:"c1", code:"FRAGMENT 01", title:"A fonte não é exclusiva",
   locked:"Registro relacionado ao H-01. Conteúdo ainda criptografado.",
   body:"O N-02 recebeu material biológico e dados derivados do H-01. A RAIN não estava apenas armazenando o ativo: estava usando o ativo como fonte de pesquisa."},
  {id:"c2", code:"FRAGMENT 02", title:"Material Kurose",
   locked:"Amostra de origem civil. Código de referência bloqueado.",
   body:"KSR-24 corresponde a material associado à linhagem Kurose. O projeto incorporou mecanismos de estabilidade híbrida e leitura sensorial relacionados à Reina."},
  {id:"c3", code:"FRAGMENT 03", title:"Eventos de forrageamento",
   locked:"Arquivo comportamental. Classificação administrativa incomum.",
   body:"O diretor catalogou ocorrências como AUTONOMOUS FORAGING EVENTS. N-02 sai por vontade própria, caça em horários de baixa circulação e retorna antes dos turnos principais."},
  {id:"c4", code:"FRAGMENT 04", title:"Matriz de integração",
   locked:"Protocolo genético de compatibilidade. Autor parcialmente oculto.",
   body:"O organismo usa uma matriz de integração heteróloga derivada de trabalhos de Grace Newman. A evidência aponta participação técnica compartimentalizada, não controle do projeto inteiro."},
  {id:"c5", code:"FRAGMENT 05", title:"A contenção era uma encenação",
   locked:"Registro de segurança da madrugada. Acesso diretor.",
   body:"Logs e gravações confirmam que N-02 aprendeu a sair, caçar e voltar. Ele evita movimento intenso e alvos cuja ausência chamaria atenção cedo demais."}
];

OPH.N02_ABILITIES = [
  ["c1","◈","RESILIÊNCIA HÍBRIDA","Tolerância física muito acima do humano; trauma bruto não garante neutralização."],
  ["c2","≋","IMITAÇÃO VIBRACIONAL","Produz sinais falsos pela estrutura e pode enganar especificamente a percepção da Reina."],
  ["c3","⌁","INTELIGÊNCIA PREDATÓRIA","Escolhe alvos, horários e rotas. Ele entende quando não deve atacar."],
  ["c4","✦","ADAPTAÇÃO TECIDUAL","Integra múltiplos materiais biológicos sem falha sistêmica imediata."],
  ["c4","⟳","REGENERAÇÃO LIMITADA","Feridas fecham mais rápido que o normal, mas não instantaneamente."],
  ["c5","⌃","CAÇA ESTRUTURAL","Teto, paredes, dutos e corredores técnicos fazem parte do território de caça."],
  ["c5","⊘","DISCIPLINA DE OCULTAÇÃO","Mantém a própria existência plausivelmente escondida para preservar o complexo como território."]
];

OPH.EMERGENCY_STATES = [
  {status:"ATIVIDADE ANORMAL",title:"A cápsula ainda pode ser salva.",meter:18,
   text:"Reduza estímulos, preserve refrigeração e suspenda ações agressivas perto da cápsula."},
  {status:"H-01 CONSCIENTE",title:"Ele deixou de ser carga.",meter:42,
   text:"Abrir espaço para comunicação/recontenção vale mais que tentar nocautear no susto."},
  {status:"KABOOM // CARGA",title:"A operação acabou. Agora é contenção.",meter:72,
   text:"Evacuar civis e afastar usuários de energia anômala da zona provável."},
  {status:"DESCARGA IMINENTE",title:"SOBREVIVER AO PLANO H.",meter:100,
   text:"Distância, cobertura e evacuação. Mais um ataque não vale uma baixa em massa."}
];
