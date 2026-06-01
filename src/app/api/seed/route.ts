import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Security: block in production unless correct secret is provided
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.ADMIN_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const force = url.searchParams.get("force") === "true";

    // Check if data already exists
    const { data: existingPlaybooks, error: checkError } = await supabase
      .from("playbooks")
      .select("id")
      .limit(1);

    if (checkError) {
      return NextResponse.json(
        { error: "Erro ao verificar dados existentes", details: checkError.message },
        { status: 500 }
      );
    }

    if (existingPlaybooks && existingPlaybooks.length > 0 && !force) {
      return NextResponse.json({
        message: "Data already seeded. Use ?force=true para recriar.",
        seeded: false,
      });
    }

    // If force=true, clean existing demo data first
    if (force) {
      await supabase.from("generated_contents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("proposals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("captures").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("playbooks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("stories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("themes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const summary: Record<string, number> = {};

    // ---------------------------------------------------------------
    // 1. Identity (upsert row id=1)
    // ---------------------------------------------------------------
    const { error: identityError } = await supabase.from("identity").upsert(
      {
        id: 1,
        colors: { primary: "#000000", accent: "#c9412b" },
        fonts: { display: "Fraunces", body: "Inter", mono: "JetBrains Mono" },
        voice_uses: [
          "Frameworks praticos",
          "Experiencia real de operacao",
          "Honestidade radical",
          "Pensamento critico",
          "Simplicidade",
          "Exemplos concretos",
          "Linguagem direta",
        ],
        voice_avoids: [
          "Ostentacao",
          "Teoria vazia",
          "Jargao corporativo",
          "Conteudo de lifestyle",
          "Vida pessoal",
          "Guru de palco",
          "Promessas exageradas",
        ],
        tone_descriptors:
          "Direto, pratico, contrario ao senso comum. Fala como quem ja operou, errou e fez exit. Sem firula, sem enrolacao. Tom de conversa entre socios, nao de professor.",
        opening_style:
          "Comeca com uma verdade incomoda ou framework contraintuitivo. Nunca com 'Ola pessoal' ou 'Nesse video vou falar sobre'. Abre com impacto.",
        closing_style:
          "Fecha com uma provocacao ou pergunta que forca reflexao. Nunca com 'Se gostou, curta e compartilhe'. Termina com peso.",
        positioning:
          "Empreendedores com negocios rodando que querem escalar deveriam tomar decisoes com base em frameworks reais e experiencia de quem ja operou, errou e fez exit — nao em teoria de guru de palco.",
        reference_creators:
          "Alex Hormozi, Leila Hormozi, Naval Ravikant, Charlie Munger",
        brandbook_url: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (identityError) {
      return NextResponse.json(
        { error: "Erro ao inserir identity", details: identityError.message },
        { status: 500 }
      );
    }
    summary.identity = 1;

    // ---------------------------------------------------------------
    // 2. Themes
    // ---------------------------------------------------------------
    const themesPayload = [
      { name: "Lideranca", description: "Principios e praticas de lideranca para empreendedores" },
      { name: "Vendas e Persuasao", description: "Tecnicas de vendas, negociacao e influencia" },
      { name: "Marketing Digital", description: "Estrategias de conteudo, trafego e conversao online" },
      { name: "Mentalidade Empreendedora", description: "Mindset, disciplina e tomada de decisao" },
      { name: "Gestao e Processos", description: "Sistemas, processos e operacao de negocios" },
    ];

    const { data: themes, error: themesError } = await supabase
      .from("themes")
      .insert(themesPayload)
      .select("id, name");

    if (themesError) {
      return NextResponse.json(
        { error: "Erro ao inserir themes", details: themesError.message },
        { status: 500 }
      );
    }
    summary.themes = themes.length;

    // Build lookup
    const themeMap: Record<string, string> = {};
    for (const t of themes) {
      themeMap[t.name] = t.id;
    }

    // ---------------------------------------------------------------
    // 3. Playbooks
    // ---------------------------------------------------------------
    const playbooksPayload = [
      {
        theme_id: themeMap["Lideranca"],
        title: "Lideranca Contextual",
        subtitle: "Lideranca nao e um estilo fixo — e uma resposta ao contexto",
        body_markdown: `## O que e Lideranca Contextual

A maioria das pessoas acha que lideranca e sobre ter um estilo definido: ou voce e o lider firme, ou o lider humano, ou o lider visionario. Errado. Lideranca de verdade e sobre ler o contexto e adaptar.

## Os 3 contextos que mudam tudo

- **Crise**: Aqui voce precisa ser diretivo. Nao e hora de democratizar decisao. Alguem tem que decidir rapido e assumir o risco.
- **Crescimento**: Aqui voce precisa ser o lider que delega e confia. Se voce centraliza, vira gargalo e mata o crescimento.
- **Estabilidade**: Aqui voce precisa ser o lider que desenvolve pessoas. E hora de investir em cultura e processos.

## Exemplo pratico

Quando minha empresa passou de 15 para 50 funcionarios em 8 meses, eu tentei manter o estilo de lideranca da fase de crise — decidindo tudo, controlando cada detalhe. Resultado: perdi 3 lideres bons em 60 dias. Eles nao queriam um chefe, queriam autonomia.

## Como aplicar

1. Identifique em qual fase seu negocio esta agora
2. Pergunte: "O que meu time precisa de mim neste momento?"
3. Ajuste seu estilo a cada 90 dias — no minimo
4. Peca feedback honesto: "O que voce precisa de mim que nao esta recebendo?"

## A licao

Lider que so tem um estilo e como medico que so receita um remedio. Funciona as vezes, mas mata o paciente nas outras.`,
        completeness_score: 75,
        has_example: true,
        has_story: true,
        has_origin: false,
        has_counterexample: false,
      },
      {
        theme_id: themeMap["Vendas e Persuasao"],
        title: "Vendas sem Ser Vendedor",
        subtitle: "Venda e transferencia de confianca, nao pressao",
        body_markdown: `## O problema com "tecnicas de vendas"

A maioria dos cursos de vendas ensina truques: gatilhos mentais, escassez artificial, frases de fechamento. Isso funciona uma vez. Na segunda, o cliente percebe e voce perde credibilidade para sempre.

## O framework: Diagnostico antes de Prescricao

Nenhum medico bom receita antes de examinar. Entao por que vendedores ja chegam com a solucao antes de entender o problema?

- **Passo 1**: Faca perguntas que o cliente nunca ouviu. Nao "qual seu orcamento?" — mas sim "o que acontece se voce nao resolver isso nos proximos 6 meses?"
- **Passo 2**: Repita o problema nas palavras do cliente. Isso cria conexao real.
- **Passo 3**: So apresente a solucao depois que o cliente concordar com o diagnostico.

## Exemplo real

Um dos meus mentorados vendia software de gestao. Ele fazia demos lindas, mas fechava 8% dos leads. Mudamos a abordagem: antes de qualquer demo, ele passava 30 minutos fazendo diagnostico. Taxa de fechamento subiu para 23% em 60 dias.

## O que muda

Voce para de convencer e comeca a ajudar. E ironicamente, quando voce para de tentar vender, vende mais.`,
        completeness_score: 60,
        has_example: true,
        has_story: false,
        has_origin: false,
        has_counterexample: false,
      },
      {
        theme_id: themeMap["Marketing Digital"],
        title: "Conteudo que Converte",
        subtitle: "Framework para criar conteudo que gera resultado, nao so curtida",
        body_markdown: `## Por que 99% do conteudo nao converte

Empreendedores criam conteudo para impressionar outros empreendedores. Ficam disputando quem tem mais seguidores, mais likes. Mas seguidores nao pagam boleto.

## A origem deste framework

Eu gastei R$ 200 mil em anuncios antes de entender que conteudo organico bem feito converte mais que qualquer campanha paga. Foram 18 meses testando formatos ate chegar neste modelo.

## O Framework C.A.R. (Conflito, Aplicacao, Resultado)

- **Conflito**: Comece com uma tensao. Algo que o publico sente mas nao sabe articular. "Voce posta todo dia e nao vende nada."
- **Aplicacao**: De um passo pratico que a pessoa pode usar hoje. Nao teoria — acao.
- **Resultado**: Mostre o que acontece quando aplica. Use numeros reais.

## Exemplo aplicado

Post que bombou: "Postei 300 conteudos em 2024. So 12 geraram vendas diretas. Aqui esta o que esses 12 tinham em comum." Esse post gerou 47 leads qualificados em 48 horas.

## Regras de ouro

1. Todo conteudo precisa ter UM unico ponto. Se tem dois, faca dois conteudos.
2. Escreva como fala. Se voce nao falaria assim numa mesa de bar, reescreva.
3. CTA e consequencia natural, nao pedido desesperado.
4. Teste o hook com 3 pessoas antes de publicar. Se nao prendem atencao em 3 segundos, jogue fora.`,
        completeness_score: 85,
        has_example: true,
        has_story: true,
        has_origin: true,
        has_counterexample: false,
      },
      {
        theme_id: themeMap["Mentalidade Empreendedora"],
        title: "A Regra dos 90 Dias",
        subtitle: "Os primeiros 90 dias definem se vai dar certo ou nao",
        body_markdown: `## A janela de 90 dias

Quando voce comeca algo novo — um negocio, um cargo, um projeto — existe uma janela de 90 dias onde tudo se define. Depois disso, os habitos ja se cristalizaram e mudar fica 10x mais dificil.

## Por que 90 dias

Nao e um numero magico. E o tempo medio que leva para:
- Habitos se formarem (66 dias segundo pesquisas)
- Primeiros resultados aparecerem
- A motivacao inicial acabar e a disciplina ser testada

## Os 3 erros fatais nos primeiros 90 dias

1. **Tentar fazer tudo perfeito**: Feito e melhor que perfeito. Nos primeiros 90 dias, volume supera qualidade.
2. **Nao medir nada**: Se voce nao mede, nao sabe se esta avancando ou girando em circulos.
3. **Mudar de estrategia cedo demais**: A maioria desiste na semana 6, exatamente quando os resultados comecam a aparecer.

## O que fazer

Defina 1 meta clara para 90 dias. Uma so. Mexa nela todo santo dia. Meca semanalmente. Ajuste a rota, nunca o destino.`,
        completeness_score: 50,
        has_example: false,
        has_story: false,
        has_origin: false,
        has_counterexample: false,
      },
      {
        theme_id: themeMap["Gestao e Processos"],
        title: "Processos Matam Desculpas",
        subtitle: "Sistemas funcionam. Forca de vontade, nao.",
        body_markdown: `## A verdade sobre "falta de disciplina"

Quando alguem da sua equipe nao entrega, o problema raramente e a pessoa. O problema e que nao existe um processo claro. Sem processo, voce depende de heroismo — e heroismo nao escala.

## De onde veio isso

Eu gerenciei times por 8 anos antes de entender isso. Ficava frustrado com "falta de comprometimento" ate perceber que o problema era meu: eu nunca tinha documentado como as coisas deviam ser feitas.

## O framework: Documente, Delegue, Audite

- **Documente**: Se algo precisa ser feito mais de 2 vezes, crie um processo escrito. Nao precisa ser bonito — precisa ser claro.
- **Delegue**: Atribua um dono para cada processo. Sem dono, ninguem cuida.
- **Audite**: Revise os processos a cada 30 dias. Processo desatualizado e pior que nao ter processo.

## Exemplo pratico

Minha equipe de vendas errava 30% das propostas comerciais. Criamos um checklist de 8 itens e um template padrao. Em 45 dias, o erro caiu para 4%. Ninguem ficou "mais disciplinado" — o processo eliminou a possibilidade de erro.

## A provocacao

Se voce precisa cobrar a mesma coisa mais de 3 vezes, o problema nao e a equipe. E voce que nao criou o processo.`,
        completeness_score: 70,
        has_example: true,
        has_story: false,
        has_origin: true,
        has_counterexample: false,
      },
    ];

    const { data: playbooks, error: playbooksError } = await supabase
      .from("playbooks")
      .insert(playbooksPayload)
      .select("id, title");

    if (playbooksError) {
      return NextResponse.json(
        { error: "Erro ao inserir playbooks", details: playbooksError.message },
        { status: 500 }
      );
    }
    summary.playbooks = playbooks.length;

    const playbookMap: Record<string, string> = {};
    for (const p of playbooks) {
      playbookMap[p.title] = p.id;
    }

    // ---------------------------------------------------------------
    // 4. Stories
    // ---------------------------------------------------------------
    const storiesPayload = [
      {
        title: "O dia que perdi meu maior cliente",
        summary: "Como perder um cliente que representava 40% do faturamento me ensinou a nunca depender de um so.",
        body_markdown: `## O contexto

Era 2018 e minha empresa tinha um cliente que representava 40% do faturamento. Todo mes eu agradecia por ter aquele contrato. Ate o dia que recebi um e-mail de 3 linhas: "Decidimos internalizar a operacao. Obrigado pelos servicos."

## O que aconteceu

Nos primeiros 15 dias, entrei em panico. Tive que demitir 4 pessoas. Passei noites sem dormir calculando quanto tempo o caixa aguentava. Foi o momento mais tenso da minha carreira como empreendedor.

## A licao

Nunca mais deixei um unico cliente representar mais de 15% do faturamento. Criei uma regra interna: se qualquer cliente passa de 20%, a prioridade numero 1 e diversificar. Parece obvio agora, mas so aprendi depois de quase quebrar.`,
        period: null,
        tags: ["vendas", "resiliencia"],
        lesson: "Nunca dependa de um unico cliente para mais de 15% do faturamento.",
      },
      {
        title: "Como demiti meu primeiro funcionario",
        summary: "A demissao mais dificil da minha vida e o que ela me ensinou sobre lideranca.",
        body_markdown: `## O contexto

Ele era meu primeiro funcionario. Tinha entrado quando a empresa era so eu e ele numa sala de 20m2. Crescemos juntos por 3 anos. Mas a empresa cresceu e ele nao acompanhou. Eu sabia ha meses, mas nao tinha coragem de agir.

## O que aconteceu

Adiei por 6 meses. Nesse periodo, o time inteiro sofreu. Quem era bom comecou a questionar por que ele continuava. A produtividade caiu. Quando finalmente tive a conversa, ele me disse: "Eu ja sabia. So queria que voce tivesse falado antes."

## A licao

Adiar uma demissao necessaria nao e bondade — e covardia. Voce prejudica a pessoa (que poderia estar em outro lugar crescendo), o time (que carrega o peso) e a empresa. Liderar e tomar decisoes dificeis no timing certo.`,
        period: null,
        tags: ["lideranca", "gestao"],
        lesson: "Adiar decisoes dificeis de pessoas prejudica todo mundo, inclusive a pessoa.",
      },
      {
        title: "De vendedor porta a porta a empresario",
        summary: "Minha historia de origem: como vender enciclopedias me preparou para empreender.",
        body_markdown: `## O contexto

Aos 19 anos eu vendia enciclopedias porta a porta em Belo Horizonte. Ganhava por comissao, sem salario fixo. Batia em 40 portas por dia. Ouvia "nao" 38 vezes. Nos dias bons, vendia 2.

## O que aconteceu

Naqueles 14 meses aprendi mais sobre vendas, rejeicao e resiliencia do que em qualquer MBA. Aprendi que vender nao e convencer — e entender o que a pessoa precisa e mostrar que voce tem. Aprendi que disciplina e mais importante que talento. E aprendi que o "nao" nao e pessoal.

## A licao

Toda vez que alguem me pergunta qual o melhor curso de empreendedorismo, eu respondo: va vender algo porta a porta por 6 meses. Voce vai aprender mais sobre negocios, pessoas e sobre voce mesmo do que em qualquer sala de aula.`,
        period: null,
        tags: ["mentalidade", "vendas"],
        lesson: "Experiencia pratica em vendas e o melhor MBA que existe.",
      },
      {
        title: "A reuniao que mudou minha empresa",
        summary: "Uma reuniao de 45 minutos com um mentor mudou completamente a forma como eu gerenciava.",
        body_markdown: `## O contexto

Em 2020, minha empresa faturava R$ 3 milhoes por ano mas eu trabalhava 14 horas por dia. Estava exausto, irritado e comecando a odiar o negocio que tinha construido. Um amigo me apresentou a um empresario que gerenciava uma empresa de R$ 50 milhoes trabalhando 6 horas por dia.

## O que aconteceu

Na reuniao, ele me fez uma unica pergunta: "Quantas decisoes voce toma por dia que so voce pode tomar?" Eu pensei e respondi "umas 30." Ele riu e disse: "Se voce nao reduzir para 3, vai continuar sendo escravo do seu proprio negocio." Naqueles 45 minutos, ele me mostrou que eu nao tinha uma empresa — eu tinha um emprego que eu mesmo criei.

## A licao

Gestao nao e sobre tomar mais decisoes — e sobre criar sistemas que eliminam a necessidade de decisoes. Nos 6 meses seguintes, documentei processos, deleguei e reduzi minha carga para 8 horas. O faturamento subiu 40%.`,
        period: null,
        tags: ["gestao", "lideranca"],
        lesson: "Gestao de verdade e criar sistemas que eliminam a necessidade de voce decidir tudo.",
      },
    ];

    const { data: stories, error: storiesError } = await supabase
      .from("stories")
      .insert(storiesPayload)
      .select("id, title");

    if (storiesError) {
      return NextResponse.json(
        { error: "Erro ao inserir stories", details: storiesError.message },
        { status: 500 }
      );
    }
    summary.stories = stories.length;

    // ---------------------------------------------------------------
    // 5. Captures
    // ---------------------------------------------------------------
    const capturesPayload = [
      {
        title: "Como vender sem parecer desesperado",
        source_type: "youtube" as const,
        source_url: "https://www.youtube.com/watch?v=exemplo123",
        raw_content:
          "Transcricao do video sobre tecnicas de vendas consultivas. Aborda como criar autoridade antes de vender, usar perguntas estrategicas e deixar o cliente conduzir a conversa. Menciona case de mentorado que triplicou vendas em 90 dias.",
        status: "processed" as const,
        processed_at: new Date().toISOString(),
        speaker_verified: true,
        context: "Video gravado para o canal do YouTube sobre vendas consultivas",
      },
      {
        title: "Anotacoes da reuniao de equipe - Q2 2026",
        source_type: "manual" as const,
        source_url: null,
        raw_content:
          "Pontos discutidos: 1) Meta de faturamento Q2: R$ 1.2M. 2) Novo processo de onboarding de clientes. 3) Contratacao de 2 SDRs. 4) Lancamento do curso online em julho. 5) Revisao dos KPIs de marketing — CAC subiu 15%, precisamos otimizar.",
        status: "processed" as const,
        processed_at: new Date().toISOString(),
        speaker_verified: true,
        context: "Reuniao semanal de alinhamento da equipe",
      },
      {
        title: "Ideia: serie sobre erros de empreendedores",
        source_type: "manual" as const,
        source_url: null,
        raw_content:
          "Criar uma serie de conteudos sobre os maiores erros que empreendedores cometem nos primeiros 3 anos. Cada conteudo foca em 1 erro especifico com historia real e solucao pratica. Formato: carrossel no Instagram + post longo no LinkedIn. Estimativa: 10 conteudos, 1 por semana.",
        status: "pending" as const,
        processed_at: null,
        speaker_verified: false,
        context: "Ideia anotada durante caminhada matinal",
      },
    ];

    const { data: captures, error: capturesError } = await supabase
      .from("captures")
      .insert(capturesPayload)
      .select("id, title");

    if (capturesError) {
      return NextResponse.json(
        { error: "Erro ao inserir captures", details: capturesError.message },
        { status: 500 }
      );
    }
    summary.captures = captures.length;

    const captureMap: Record<string, string> = {};
    for (const c of captures) {
      captureMap[c.title] = c.id;
    }

    // ---------------------------------------------------------------
    // 6. Proposals
    // ---------------------------------------------------------------
    const proposalsPayload = [
      {
        capture_id: captureMap["Como vender sem parecer desesperado"],
        type: "playbook" as const,
        title: "Venda Consultiva: O Anti-Vendedor",
        content_markdown:
          "Playbook sobre como conduzir vendas sem pressao, usando perguntas estrategicas e autoridade de conteudo. Baseado no video sobre vendas consultivas.",
        suggested_theme_id: themeMap["Vendas e Persuasao"],
        suggested_tags: ["vendas", "consultiva", "autoridade"],
        status: "pending" as const,
      },
      {
        capture_id: captureMap["Como vender sem parecer desesperado"],
        type: "story" as const,
        title: "O mentorado que triplicou vendas sem mudar o produto",
        content_markdown:
          "Historia do mentorado mencionado no video que triplicou as vendas em 90 dias apenas mudando a abordagem comercial. Foco na transicao de vendas agressivas para vendas consultivas.",
        suggested_theme_id: themeMap["Vendas e Persuasao"],
        suggested_tags: ["vendas", "case", "mentorado"],
        status: "pending" as const,
      },
      {
        capture_id: captureMap["Anotacoes da reuniao de equipe - Q2 2026"],
        type: "playbook" as const,
        title: "Onboarding de Clientes: Os Primeiros 7 Dias",
        content_markdown:
          "Playbook sobre o novo processo de onboarding discutido na reuniao. Foco nos primeiros 7 dias do cliente, pontos de contato e metricas de sucesso.",
        suggested_theme_id: themeMap["Gestao e Processos"],
        suggested_tags: ["gestao", "onboarding", "processos"],
        status: "approved" as const,
        reviewed_at: new Date().toISOString(),
      },
      {
        capture_id: captureMap["Anotacoes da reuniao de equipe - Q2 2026"],
        type: "question" as const,
        title: "Como reduzir CAC sem perder qualidade de leads?",
        content_markdown:
          "Questao levantada na reuniao: o CAC subiu 15% no ultimo trimestre. Explorar estrategias para otimizar aquisicao mantendo a qualidade dos leads.",
        suggested_theme_id: themeMap["Marketing Digital"],
        suggested_tags: ["marketing", "cac", "otimizacao"],
        status: "approved" as const,
        reviewed_at: new Date().toISOString(),
      },
    ];

    const { data: proposals, error: proposalsError } = await supabase
      .from("proposals")
      .insert(proposalsPayload)
      .select("id, title");

    if (proposalsError) {
      return NextResponse.json(
        { error: "Erro ao inserir proposals", details: proposalsError.message },
        { status: 500 }
      );
    }
    summary.proposals = proposals.length;

    // ---------------------------------------------------------------
    // 7. Generated Contents
    // ---------------------------------------------------------------
    const generatedContentsPayload = [
      {
        playbook_id: playbookMap["Conteudo que Converte"],
        story_id: null,
        reference_knowledge_ids: [],
        source_type: "base_only" as const,
        free_text_input: null,
        content_type: "instagram_carousel" as const,
        format_id: null,
        content_text: `Voce posta todo dia e nao vende nada?

O problema nao e frequencia. E estrategia.

---

99% dos empreendedores criam conteudo pra impressionar outros empreendedores.

Likes nao pagam boleto.

---

Usa o Framework C.A.R.:

CONFLITO — Comece com uma tensao real
APLICACAO — De um passo pratico pra hoje
RESULTADO — Mostre numeros reais

---

Exemplo real:

"Postei 300 conteudos em 2024. So 12 geraram vendas diretas."

Esse post gerou 47 leads qualificados em 48h.

---

4 regras de conteudo que converte:

1. UM unico ponto por conteudo
2. Escreva como fala
3. CTA e consequencia, nao pedido
4. Teste o hook com 3 pessoas

---

Se seu conteudo nao esta gerando leads, nao e problema de algoritmo.

E problema de estrategia.

Salva esse post e aplica no proximo conteudo.`,
        status: "draft" as const,
        published_url: null,
      },
      {
        playbook_id: playbookMap["Lideranca Contextual"],
        story_id: null,
        reference_knowledge_ids: [],
        source_type: "base_only" as const,
        free_text_input: null,
        content_type: "linkedin_post" as const,
        format_id: null,
        content_text: `Voce nao precisa de um "estilo de lideranca."

Voce precisa ler o contexto.

Quando minha empresa passou de 15 para 50 pessoas em 8 meses, eu mantive o estilo da fase de crise: decidindo tudo, controlando cada detalhe.

Resultado: perdi 3 lideres bons em 60 dias.

A verdade e que lideranca muda com o contexto:

Em CRISE → seja diretivo. Decida rapido.
Em CRESCIMENTO → delegue. Se centralizar, vira gargalo.
Em ESTABILIDADE → desenvolva pessoas. Invista em cultura.

Lider que so tem um estilo e como medico que so receita um remedio.

Funciona as vezes. Mata o paciente nas outras.

Pergunta pra reflexao: em qual fase seu negocio esta agora? E voce esta liderando pro contexto certo?

#lideranca #empreendedorismo #gestao`,
        status: "published" as const,
        published_url: "https://www.linkedin.com/posts/pedrorabelo_lideranca-contextual",
      },
    ];

    const { data: generatedContents, error: generatedError } = await supabase
      .from("generated_contents")
      .insert(generatedContentsPayload)
      .select("id, content_type");

    if (generatedError) {
      return NextResponse.json(
        { error: "Erro ao inserir generated_contents", details: generatedError.message },
        { status: 500 }
      );
    }
    summary.generated_contents = generatedContents.length;

    return NextResponse.json({
      message: "Seed concluido com sucesso!",
      seeded: true,
      summary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Erro inesperado durante seed", details: message },
      { status: 500 }
    );
  }
}
