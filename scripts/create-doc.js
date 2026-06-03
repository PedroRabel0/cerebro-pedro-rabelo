const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, LevelFormat } = require("docx");

const accent = "D4783C";
const violet = "8B5CF6";
const gray = "666666";
const dark = "1A1A28";

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, font: "Arial", color: accent })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 28, font: "Arial", color: "333333" })] });
}
function h3(text) {
  return new Paragraph({ spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Arial", color: violet })] });
}
function p(text) {
  return new Paragraph({ spacing: { after: 120 },
    children: [new TextRun({ text, size: 22, font: "Arial" })] });
}
function pb() { return new Paragraph({ children: [new PageBreak()] }); }
function bullet(text) {
  return new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial" })] });
}

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cm = { top: 60, bottom: 60, left: 100, right: 100 };

function tc(text, w, hdr) {
  return new TableCell({ borders, width: { size: w, type: WidthType.DXA }, margins: cm,
    shading: hdr ? { fill: dark, type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: "Arial", bold: !!hdr, color: hdr ? "FFFFFF" : "333333" })] })] });
}
function tbl(hdrs, rows, ws) {
  const tw = ws.reduce((a,b) => a+b, 0);
  return new Table({ width: { size: tw, type: WidthType.DXA }, columnWidths: ws,
    rows: [
      new TableRow({ children: hdrs.map((h,i) => tc(h, ws[i], true)) }),
      ...rows.map(r => new TableRow({ children: r.map((c,i) => tc(c, ws[i])) }))
    ] });
}

const doc = new Document({
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
  styles: { default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, font: "Arial", color: accent }, paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, font: "Arial" }, paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
    ] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Segundo Cerebro - Documentacao Tecnica", size: 16, font: "Arial", color: gray, italics: true })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Pagina ", size: 16, font: "Arial", color: gray }), new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: gray })] })] }) },
    children: [
      // COVER
      new Paragraph({ spacing: { before: 3000 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "SEGUNDO CEREBRO DO PEDRO", size: 52, bold: true, font: "Arial", color: accent })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: "Documentacao Tecnica Completa", size: 30, font: "Arial", color: gray })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Como a plataforma foi construida, onde tudo fica, e como funciona", size: 22, font: "Arial", color: gray, italics: true })] }),
      new Paragraph({ spacing: { before: 2000 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Junho 2026 | Versao 1.0", size: 22, font: "Arial", color: gray })] }),
      pb(),

      // 1
      h1("1. Visao Geral da Plataforma"),
      p("O Segundo Cerebro do Pedro e uma plataforma web que funciona como uma extensao da mente do Pedro Rabelo. Ela captura conhecimento de reunioes, transcricoes e materiais, organiza em playbooks e historias, e transforma tudo em conteudo publicavel para redes sociais."),
      h2("Usuarios"),
      bullet("Pedro Rabelo (admin) - fonte do conhecimento, revisor final, gerador de conteudo. Acesso total."),
      bullet("Henrique (operador) - alimenta a base, aprova propostas, opera o dia a dia. Sem acesso a Referencias, Identidade e Config."),
      h2("O que faz"),
      bullet("Captura: Henrique alimenta com transcricoes, links, PDFs, arquivos"),
      bullet("Organiza: IA estrutura em Playbooks e Historias"),
      bullet("Gera: Pedro escolhe tema + rede + formato, sistema produz conteudo + imagem"),
      bullet("Aprende: Feedback melhora a geracao ao longo do tempo"),
      pb(),

      // 2
      h1("2. Arquitetura Tecnica"),
      h3("Vercel (Hospedagem)"),
      p("Onde o site roda na internet. URL: segundo-cerebro-weld.vercel.app. Plano Hobby (gratis). CDN global, HTTPS, Brotli."),
      h3("GitHub (Codigo-fonte)"),
      p("Backup seguro do codigo. Repo: github.com/PedroRabel0/cerebro-pedro-rabelo. Branch: main."),
      h3("Supabase (Banco de Dados)"),
      p("PostgreSQL managed. Todos os dados: playbooks, historias, conteudos, metricas, autenticacao. Plano Free."),
      h3("Next.js + React + Tailwind (Frontend + Backend)"),
      p("Next.js 16 (App Router). React 19. Tailwind CSS v4. Design system Midnight Ember (dark + cobre + violeta)."),
      h3("IAs (Claude, GPT-image-1, Gemini, Apify)"),
      bullet("Claude (Anthropic): geracao de texto, chat, analise, hooks, newsletter"),
      bullet("GPT-image-1 (OpenAI): geracao de imagens dos posts"),
      bullet("Gemini (Google): prompts de imagem (fallback)"),
      bullet("Apify: scraping do Instagram (perfis, posts, metricas)"),
      pb(),

      // NOVA SECAO: Por que escolhemos cada tecnologia
      h1("3. Por Que Escolhemos Cada Tecnologia"),
      p("Para cada ferramenta, explicamos de forma simples: o que ela faz, por que foi a melhor opcao, e o que mais existia no mercado."),

      h2("Onde o site fica no ar: Vercel"),
      h3("Por que escolhemos"),
      p("O Vercel e como um terreno gratis na internet feito sob medida para o tipo de site que construimos. Ele foi criado pela mesma empresa que fez a ferramenta principal do nosso codigo (Next.js), entao tudo funciona junto sem dor de cabeca. O site fica rapido porque o Vercel espalha copias dele pelo mundo inteiro, e o endereco ja vem com cadeado de seguranca (HTTPS) sem pagar nada."),
      h3("O que mais existia e por que nao usamos"),
      tbl(["Opcao","Por que descartamos"], [
        ["Amazon (AWS)","E como alugar um terreno vazio e construir tudo do zero: encanamento, eletrica, portao. Funciona, mas da muito trabalho e custa no minimo R$100/mes."],
        ["Google Cloud","Parecido com a Amazon. Precisa de conhecimento tecnico avancado pra configurar. Esforco demais pro nosso tamanho."],
        ["Railway / Render","Bons e baratos, mas nao falam a mesma lingua que nosso codigo. Como comprar um carro bom mas que so aceita gasolina importada."],
        ["Netlify","Concorrente direto do Vercel, mas tem problemas com as funcoes mais novas do nosso codigo. Como um carro que parece bom mas engasga na subida."],
        ["Servidor proprio","Custo fixo todo mes, precisa de alguem cuidando 24h. Como ter uma loja fisica em vez de vender online."],
      ], [2500,6860]),

      h2("Onde os dados ficam guardados: Supabase"),
      h3("Por que escolhemos"),
      p("O Supabase e como um deposito inteligente que guarda todos os dados da plataforma (playbooks, historias, conteudos, metricas) E ainda cuida do login dos usuarios. Tudo num lugar so, de graca. Tem um painel visual onde voce pode ver e editar os dados direto, sem precisar de codigo."),
      h3("O que mais existia e por que nao usamos"),
      tbl(["Opcao","Por que descartamos"], [
        ["Firebase (Google)","Guarda dados de um jeito diferente (como pastas soltas em vez de planilhas organizadas). Pra nosso caso, onde playbooks se conectam com temas, historias se conectam com capturas, etc., planilhas organizadas funcionam muito melhor."],
        ["PlanetScale","Bom deposito, mas nao cuida do login. Teriamos que contratar outro servico so pra isso. E tiraram o plano gratis."],
        ["MongoDB","Outro estilo de deposito (pastas soltas). Funciona pra apps simples, mas nossos dados sao muito conectados entre si."],
        ["Banco no computador","Nao funciona quando o site esta na internet. E como guardar o estoque da loja na sua casa em vez de na loja."],
      ], [2500,6860]),

      h2("A ferramenta que constroi o site: Next.js"),
      h3("Por que escolhemos"),
      p("Next.js e a ferramenta mais completa pra construir sites modernos. Ela faz o trabalho de 3-4 ferramentas separadas: monta as paginas, cuida do backend (a logica que roda no servidor), organiza as rotas (cada pagina do site), e deixa tudo rapido com cache inteligente. E a ferramenta mais popular do mercado, com milhares de exemplos e solucoes prontas."),
      h3("O que mais existia e por que nao usamos"),
      tbl(["Opcao","Por que descartamos"], [
        ["React puro","E como ter so o motor de um carro. Funciona, mas voce precisa construir o volante, os pedais, e a carroceria separadamente. Precisariamos de mais 2-3 ferramentas."],
        ["Remix","Bom carro, mas menos conhecido. Menos oficinas (comunidade menor), menos pecas (plugins). Se der problema, e mais dificil achar solucao."],
        ["Vue / Nuxt","Outra marca de carro. Boa, mas nossa experiencia e com React. Trocar de marca no meio do projeto seria como trocar de idioma no meio de um livro."],
        ["Laravel (PHP)","Ferramenta classica e robusta, mas precisa de um servidor dedicado rodando 24h. Nao tem a velocidade e praticidade do Vercel."],
      ], [2500,6860]),

      h2("A IA que escreve os textos: Claude (Anthropic)"),
      h3("Por que escolhemos"),
      p("Claude e a IA que melhor escreve em portugues brasileiro com qualidade profissional. Quando voce pede pra ela gerar um post no tom do Pedro com 15 detalhes especificos (objetivo, duracao, gancho, CTA, etc.), ela segue tudo direitinho. Alem disso, ela tem um recurso chamado cache que faz a identidade do Pedro ser lembrada sem cobrar de novo, economizando ate 90% do custo em chamadas repetidas."),
      h3("O que mais existia e por que nao usamos"),
      tbl(["Opcao","Por que descartamos"], [
        ["ChatGPT (GPT-4o)","Muito bom, mas mais caro pra mesma quantidade de texto. E menos preciso quando voce pede um formato especifico (tipo JSON). Usamos ele so pra gerar imagens."],
        ["ChatGPT Mini","Mais barato, mas a qualidade cai em textos longos. Perde o tom do Pedro e simplifica demais."],
        ["Gemini (Google)","Gratis, mas trava muito (rate limit). Funciona de vez em quando. Usamos so como backup pra prompts de imagem."],
        ["Llama (Meta)","IA gratis e aberta, mas precisa alugar um computador potente pra rodar (~R$250-1000/mes). Qualidade inferior em portugues."],
      ], [2500,6860]),

      h2("A IA que cria as imagens: GPT-image-1 (OpenAI)"),
      h3("Por que escolhemos"),
      p("E o mesmo modelo que o Genspark usa por baixo. Cria imagens de alta qualidade com texto legivel (nomes, titulos, numeros), que e o que mais importa pra posts de Instagram. Custa so R$0.20 por imagem e se integra com um unico comando."),
      h3("O que mais existia e por que nao usamos"),
      tbl(["Opcao","Por que descartamos"], [
        ["Midjourney","Faz as imagens mais bonitas do mercado, mas so funciona pelo Discord (um app de chat). Impossivel conectar com a plataforma automaticamente."],
        ["DALL-E 3","Versao mais antiga do mesmo modelo. Texto nas imagens saia torto e ilegivel. Substituido pelo GPT-image-1."],
        ["Stable Diffusion","Gratis e aberto, mas precisa de computador com placa de video cara. Texto em imagens e pessimo."],
        ["Genspark","Usa o GPT-image-1 por baixo. Nao tem como conectar direto. Integramos o modelo original em vez de depender do intermediario."],
      ], [2500,6860]),

      h2("O robo que coleta dados do Instagram: Apify"),
      h3("Por que escolhemos"),
      p("Apify e um servico que tem robos prontos pra coletar dados do Instagram. Voce da o nome do perfil, e ele traz os ultimos posts com likes, comentarios, legendas, tudo organizado. O plano gratis cobre nosso uso tranquilamente."),
      h3("O que mais existia e por que nao usamos"),
      tbl(["Opcao","Por que descartamos"], [
        ["Fazer scraping manual","Funciona, mas toda vez que o Instagram muda o site (a cada 2-3 semanas), o codigo quebra e precisa ser consertado. Muito trabalho de manutencao."],
        ["API oficial do Instagram","O Instagram so deixa voce ver dados do seu proprio perfil. Nao permite espiar posts de concorrentes ou referencias."],
        ["Bright Data","Mais robusto, mas custa no minimo R$500/mes. Overkill pro nosso volume."],
      ], [2500,6860]),

      h2("O que deixa o site bonito: Tailwind CSS"),
      h3("Por que escolhemos"),
      p("Tailwind e como um kit de LEGO para design. Em vez de escrever CSS do zero, voce monta o visual combinando pecas prontas (bg-red, rounded-xl, p-4). O resultado final e limpo porque ele automaticamente remove todas as pecas que voce nao usou."),
      h3("O que mais existia e por que nao usamos"),
      tbl(["Opcao","Por que descartamos"], [
        ["CSS puro","Maximo controle, mas e como construir uma casa tijolo por tijolo. Com 93 arquivos no projeto, seria lento demais."],
        ["Chakra UI / Mantine","Componentes prontos (botoes, modais, etc.). Rapido pra comecar, mas dificil de customizar quando voce quer um visual unico como o Midnight Ember."],
        ["Bootstrap","Muito popular mas datado. Todos os sites ficam parecidos. Dificil personalizar profundamente."],
      ], [2500,6860]),

      h2("O sistema de login: Supabase Auth"),
      h3("Por que escolhemos"),
      p("Ja vinha junto com o banco de dados (Supabase), entao foi de graca. Cuida de tudo: login com email/senha, permissoes diferentes pra Pedro (admin) e Henrique (operador), protecao das paginas. Zero custo extra."),
      h3("O que mais existia e por que nao usamos"),
      tbl(["Opcao","Por que descartamos"], [
        ["Clerk","Muito bonito e facil, mas cobra R$125/mes depois do plano gratis. Pra 2 usuarios e desperdicio."],
        ["Auth0","Feito pra empresas grandes com milhares de usuarios. Complexo demais pra nosso caso."],
        ["Firebase Auth","Bom, mas ia nos prender ao ecossistema do Google. Ja tinhamos escolhido Supabase pro banco."],
      ], [2500,6860]),

      h2("O sistema de registros internos: Pino"),
      h3("Por que escolhemos"),
      p("Pino e como uma camera de seguranca digital. Registra tudo que acontece na plataforma (quem logou, que conteudo foi gerado, se deu erro) de forma organizada. Em producao, gera registros que o Vercel consegue ler e filtrar automaticamente."),
      h3("O que antes tinhamos"),
      p("Antes usavamos console.log (o basico do basico). Era como anotar tudo num caderno sem indice. Impossivel encontrar algo quando precisava. Pino organiza tudo por nivel: info, aviso, erro."),

      h2("O sistema de testes: Vitest"),
      h3("Por que escolhemos"),
      p("Vitest e como um inspetor de qualidade que verifica se as pecas-chave da plataforma estao funcionando. Roda em 1.5 segundos e avisa imediatamente se algo quebrou. Comecamos com 10 testes na funcao mais critica (a que interpreta as respostas da IA)."),
      h3("O que mais existia"),
      p("Jest era a opcao mais conhecida, mas e 10x mais lento e precisa de mais configuracao. Como Vitest fala a mesma lingua que nosso projeto, foi plug-and-play."),

      pb(),

      // 3 (renumerado para 4)
      h1("4. Onde Cada Coisa Fica"),
      tbl(["Local","O que fica","Endereco"], [
        ["Computador","Codigo-fonte","C:\\Users\\henri\\segundo-cerebro"],
        ["GitHub","Backup do codigo","github.com/PedroRabel0/cerebro-pedro-rabelo"],
        ["Vercel","Site no ar","segundo-cerebro-weld.vercel.app"],
        ["Supabase","Dados + auth","ilredrdimvcfqimyfaqc.supabase.co"],
      ], [2500,3500,3360]),
      pb(),

      // 4
      h1("5. Paginas e Funcionalidades"),
      tbl(["Pagina","Rota","O que faz"], [
        ["Cerebro","/","Chat com IA usando a base"],
        ["Conhecimento","/base-de-conhecimento","Pedro/Outros/Alimentar + upload"],
        ["Geracao","/gerar-conteudo","Wizard + Hooks + Repurpose + Imagem"],
        ["Insights","/insights-pedro","Capturas e aprovacao de propostas"],
        ["Tendencias","/tendencias","Radar de referencias"],
        ["Analytics","/analytics","Import Instagram + insights IA"],
        ["Pedro Clone","/respostas","Respostas na voz do Pedro"],
        ["Newsletter","/newsletter","Newsletters semanais"],
        ["Calendario","/calendario","Agendar publicacoes"],
        ["Voz","/evolucao-voz","Snapshots de identidade"],
        ["Referencias","/referencias","Perfis Instagram (Pedro only)"],
        ["Identidade","/identidade","Tom, voz, cores (Pedro only)"],
        ["Config","/configuracoes","Custos de API (Pedro only)"],
      ], [2000,3000,4360]),
      pb(),

      // 5
      h1("6. Plataformas e Custos"),
      tbl(["Plataforma","Para que","Custo"], [
        ["Vercel","Hospedagem","Gratis"],
        ["GitHub","Codigo","Gratis"],
        ["Supabase","Banco + auth","Gratis"],
        ["Anthropic (Claude)","Texto/analise","~$15-50/mes"],
        ["OpenAI (GPT-image-1)","Imagens","~$5-20/mes"],
        ["Google (Gemini)","Prompts imagem","Gratis (rate limit)"],
        ["Apify","Scraping IG","Gratis ate $5/mes"],
      ], [3120,3120,3120]),
      pb(),

      // 6
      h1("7. Logins e Acessos"),
      tbl(["Usuario","Email","Papel"], [
        ["Pedro","pedro@cerebro.app","Admin (acesso total)"],
        ["Henrique","henrique@cerebro.app","Operador (sem Ref/Ident/Config)"],
      ], [2000,3680,3680]),
      p("Senhas: via variaveis de ambiente. Vercel: login GitHub. Supabase: conta do projeto."),
      pb(),

      // 7
      h1("8. Variaveis de Ambiente"),
      tbl(["Variavel","Servico"], [
        ["ANTHROPIC_API_KEY","Claude AI"],
        ["OPENAI_API_KEY","GPT-image-1 / GPT-4o"],
        ["GOOGLE_GEMINI_API_KEY","Gemini"],
        ["APIFY_TOKEN","Scraping Instagram"],
        ["GNEWS_API_KEY","GNews"],
        ["SUPABASE_SERVICE_ROLE_KEY","Banco (server)"],
        ["NEXT_PUBLIC_SUPABASE_URL","Supabase URL"],
        ["NEXT_PUBLIC_SUPABASE_ANON_KEY","Supabase (client)"],
        ["ADMIN_SECRET","Protecao APIs admin"],
      ], [5000,4360]),
      p("Todas configuradas em .env.local (local) e Vercel Dashboard > Settings > Environment Variables (producao)."),
      pb(),

      // 8
      h1("9. Banco de Dados"),
      tbl(["Tabela","O que guarda"], [
        ["identity","Voz, tom, cores (1 registro)"],
        ["playbooks","Frameworks e metodologias"],
        ["stories","Historias pessoais"],
        ["captures","Inputs processados"],
        ["proposals","Propostas da IA"],
        ["generated_contents","Conteudos gerados"],
        ["reference_profiles","Perfis Instagram"],
        ["reference_posts","Posts scrapeados"],
        ["hooks","Banco de ganchos"],
        ["calendar_entries","Publicacoes agendadas"],
        ["content_metrics","Metricas de performance"],
        ["newsletters","Newsletters geradas"],
        ["voice_snapshots","Evolucao de voz"],
        ["faq_responses","Pedro Clone"],
        ["activity_log","Timeline de atividade"],
        ["api_cost_log","Custos de API"],
      ], [4000,5360]),
      pb(),

      // 9
      h1("10. Fluxos Principais"),
      h2("Alimentar a Base"),
      bullet("1. Cola texto/link ou sobe arquivo em Conhecimento > Alimentar"),
      bullet("2. Seleciona origem: Do Pedro ou De outros"),
      bullet("3. IA processa e gera propostas"),
      bullet("4. Vai em Insights, le o conteudo, aprova como Pedro ou Outros"),
      bullet("5. Conteudo aparece em Conhecimento na tab correta"),
      h2("Gerar Conteudo"),
      bullet("1. Abre Geracao > Novo, escolhe fonte e tema"),
      bullet("2. Seleciona tipos (Reels, Carrossel, LinkedIn, etc.)"),
      bullet("3. Preenche detalhes, clica Gerar"),
      bullet("4. IA produz texto, clica Gerar Imagem para o visual"),
      bullet("5. Baixa e publica"),
      pb(),

      // 10
      h1("11. Seguranca"),
      bullet("Headers: X-Frame-Options, CSP, HSTS, X-Content-Type-Options"),
      bullet("Auth: Supabase Auth com roles (pedro/henrique)"),
      bullet("APIs admin: ADMIN_SECRET obrigatorio"),
      bullet("Senhas: variaveis de ambiente (nunca no codigo)"),
      bullet("robots.txt: Disallow all (app privada)"),
      bullet("Logger: Pino (JSON em producao, legivel em dev)"),
      bullet("Testes: Vitest com 10 testes para parseJSON"),

      // 11
      h1("12. Deploy"),
      p("Comando para deploy: npx vercel --prod"),
      p("Auto-deploy do GitHub nao esta funcionando (precisa manual)."),
      h2("Cron Jobs"),
      tbl(["Job","Frequencia","O que faz"], [
        ["Antena","Segunda 2h UTC","Scrape perfis + DNA"],
        ["Tendencias","Diario 6h UTC","Radar de trends"],
      ], [2500,2500,4360]),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:/Users/henri/segundo-cerebro/docs/documentacao-tecnica-v2.docx", buffer);
  console.log("Documento criado com sucesso!");
});
