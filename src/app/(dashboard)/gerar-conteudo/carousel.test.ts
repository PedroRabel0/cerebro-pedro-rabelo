import { describe, it, expect } from "vitest";
import {
  parseCarouselSlides,
  extractCaption,
  extractLegacyDesignPrompt,
} from "./carousel";

describe("extractCaption — area de legenda mostra SO a legenda", () => {
  it("carrossel/case: devolve so o que vem depois de ---LEGENDA---", () => {
    const t = `SLIDE 1:\nCapa\n\nSLIDE 2:\nMeio\n\n---LEGENDA---\nA legenda de verdade. #tag`;
    expect(extractCaption(t)).toBe("A legenda de verdade. #tag");
  });

  it("registro antigo com prompt grudado: corta o bloco de design", () => {
    const t = `Legenda salva antes da correcao.\n\n---PROMPT DE DESIGN---\nCrie um carrossel preto e vermelho...`;
    expect(extractCaption(t)).toBe("Legenda salva antes da correcao.");
    expect(extractCaption(t)).not.toContain("PROMPT");
  });

  it("texto simples (post normal) volta inteiro", () => {
    expect(extractCaption("So a legenda mesmo.")).toBe("So a legenda mesmo.");
    expect(extractCaption(null)).toBe("");
  });
});

describe("extractLegacyDesignPrompt — prompt colado no content_text antigo", () => {
  it("devolve o bloco depois de ---PROMPT DE DESIGN---", () => {
    const t = `Legenda.\n\n---PROMPT DE DESIGN---\nCrie um post 1080x1080...`;
    expect(extractLegacyDesignPrompt(t)).toBe("Crie um post 1080x1080...");
  });

  it("sem marcador devolve null", () => {
    expect(extractLegacyDesignPrompt("Legenda normal")).toBeNull();
    expect(extractLegacyDesignPrompt(null)).toBeNull();
  });
});

// Resposta no formato que o prompt do wizard exige (SLIDE N: + ---LEGENDA---)
const RESPOSTA_CANONICA = `SLIDE 1:
O que ninguém te conta sobre escalar um e-commerce

SLIDE 2:
1. Margem não é lucro. Quem escala olhando só faturamento quebra com caixa cheio de estoque.

SLIDE 3:
2. Tráfego pago sem LTV é aluguel de cliente. Você paga de novo a cada venda.

SLIDE 4:
Salva esse post pra consultar antes de escalar. E me segue @pedrorabelo pra mais.

---LEGENDA---
Escalar não é apertar o botão do gerenciador de anúncios.

Eu já vi loja faturando 7 dígitos quebrar em 6 meses.

Comenta ESCALA que eu te mando o checklist. #ecommerce #gestao`;

describe("parseCarouselSlides", () => {
  it("parseia o formato canonico do prompt (SLIDE N: + ---LEGENDA---)", () => {
    const r = parseCarouselSlides(RESPOSTA_CANONICA);
    expect(r.hook).toContain("O que ninguém te conta");
    // A capa NAO pode conter os outros slides concatenados (bug antigo)
    expect(r.hook).not.toContain("Margem não é lucro");
    expect(r.slides).toHaveLength(2);
    expect(r.slides[0]).toContain("Margem não é lucro");
    expect(r.slides[1]).toContain("Tráfego pago sem LTV");
    expect(r.cta).toContain("Salva esse post");
    // A legenda NAO vira slide nem CTA (bug antigo: cta = legenda)
    expect(r.cta).not.toContain("gerenciador de anúncios");
    expect(r.slides.join(" ")).not.toContain("LEGENDA");
  });

  it("aceita variacoes de marcador: **SLIDE 1 - CAPA:** e [SLIDE 2]", () => {
    const r = parseCarouselSlides(
      `**SLIDE 1 - CAPA:**\nTitulo forte\n\n[SLIDE 2]\nConteudo do meio\n\nSLIDE 3:\nCTA final`
    );
    expect(r.hook).toBe("Titulo forte");
    expect(r.slides).toEqual(["Conteudo do meio"]);
    expect(r.cta).toBe("CTA final");
  });

  it("fallback legado: separadores --- sem marcador SLIDE", () => {
    const r = parseCarouselSlides(`Capa aqui\n---\nSlide do meio\n---\nCTA aqui`);
    expect(r.hook).toBe("Capa aqui");
    expect(r.slides).toEqual(["Slide do meio"]);
    expect(r.cta).toBe("CTA aqui");
  });

  it("fallback final: paragrafos separados por linha em branco", () => {
    const r = parseCarouselSlides(`Capa\n\nMeio\n\nFim`);
    expect(r.hook).toBe("Capa");
    expect(r.slides).toEqual(["Meio"]);
    expect(r.cta).toBe("Fim");
  });
});

describe("parseCarouselSlides — fotos reais ([FOTO: ...], tipo case_empresa)", () => {
  it("extrai os hints e limpa o texto dos slides", () => {
    const r = parseCarouselSlides(
      `SLIDE 1:
A loja que dobrou o faturamento sem gastar mais em trafego
[FOTO: fachada da loja]

SLIDE 2:
O contexto
Loja de moda, 2 anos de operacao, faturamento travado.
[FOTO: print do faturamento antes]

SLIDE 3:
O insight
Eles pararam de comprar trafego e arrumaram a esteira de LTV primeiro.

SLIDE 4:
Salva esse case. E me diz: qual etapa da SUA esteira esta vazando?

---LEGENDA---
Case real que eu analisei essa semana. #ecommerce`
    );
    // hints alinhados com [capa, ...slides, cta]
    expect(r.photoHints).toEqual([
      "fachada da loja",
      "print do faturamento antes",
      null,
      null,
    ]);
    // texto limpo, sem o marcador
    expect(r.hook).not.toContain("[FOTO");
    expect(r.slides[0]).not.toContain("[FOTO");
    expect(r.hook).toContain("dobrou o faturamento");
    expect(r.slides[0]).toContain("faturamento travado");
  });

  it("formatos sem marcador retornam hints todos null (retrocompatibilidade)", () => {
    const r = parseCarouselSlides(`Capa\n\nMeio\n\nFim`);
    expect(r.photoHints).toEqual([null, null, null]);
  });
});

describe("parseCarouselSlides — papeis dos slides ([TIPO: ...], dossie do case)", () => {
  it("extrai origem/virada/insight e limpa os marcadores do texto", () => {
    const r = parseCarouselSlides(
      `SLIDE 1:
O banco que venceu REMOVENDO
[FOTO: o cartao roxo sobre a mesa]

SLIDE 2:
O ano em que ninguem queria ser banco
2013. Quatro meses pra abrir uma conta.
[TIPO: origem]
[FOTO: os fundadores em 2013 na primeira casa alugada]

SLIDE 3:
Todo mundo adicionava. Eles removeram.
[TIPO: virada]

SLIDE 4:
Na minha visao, eles mudaram o campo.
[TIPO: insight]

SLIDE 5:
Salva esse dossie e me diz o que voce cortaria.

---LEGENDA---
Legenda aqui`
    );
    // papeis alinhados com [capa, ...slides, cta]
    expect(r.slideRoles).toEqual(["capa", "origem", "virada", "insight", "licao"]);
    // hints seguem alinhados mesmo com [TIPO:] presente
    expect(r.photoHints).toEqual([
      "o cartao roxo sobre a mesa",
      "os fundadores em 2013 na primeira casa alugada",
      null,
      null,
      null,
    ]);
    // texto limpo, sem marcador vazando pro design
    for (const s of [r.hook, ...r.slides, r.cta]) {
      expect(s).not.toContain("[TIPO");
      expect(s).not.toContain("[FOTO");
    }
    expect(r.slides[0]).toContain("Quatro meses");
  });
});

describe("parseCarouselSlides — linha FONTE das Atualidades", () => {
  it("remove a linha FONTE do topo (nao vira capa) e mantem os slides", () => {
    const r = parseCarouselSlides(
      `FONTE: The Verge — https://theverge.com/x\n\nSLIDE 1:\nA capa de verdade\n\nSLIDE 2:\nMeio\n\nSLIDE 3:\nCTA\n\n---LEGENDA---\nLegenda aqui`
    );
    expect(r.hook).toBe("A capa de verdade");
    expect(r.hook).not.toContain("FONTE");
    expect(r.slides).toEqual(["Meio"]);
  });
});

describe("parseCarouselSlides — papeis v3 do card editorial (historia/analise/ponte)", () => {
  it("extrai os papeis novos e mantem hints alinhados", () => {
    const r = parseCarouselSlides(
      `SLIDE 1:
Nubank: sem agencia, sem gerente, sem PowerPoint.
Isso muda mais coisa do que parece. Te explico.
[FOTO: o cartao roxo sobre a mesa]

SLIDE 2:
O ano em que ninguem queria ser banco
[TIPO: historia]
[FOTO: os fundadores em 2013]

SLIDE 3:
Na minha visao, eles mudaram o campo.
[TIPO: analise]

SLIDE 4:
E o que isso ensina pra sua empresa?
[TIPO: ponte]

SLIDE 5:
A licao: coragem de nao fazer.

---LEGENDA---
Legenda aqui`
    );
    expect(r.slideRoles).toEqual(["capa", "historia", "analise", "ponte", "licao"]);
    expect(r.photoHints).toEqual([
      "o cartao roxo sobre a mesa",
      "os fundadores em 2013",
      null,
      null,
      null,
    ]);
    for (const s of [r.hook, ...r.slides, r.cta]) {
      expect(s).not.toContain("[TIPO");
      expect(s).not.toContain("[FOTO");
    }
  });
});

describe("parseCarouselSlides — identidade da empresa ([MARCA: ...])", () => {
  it("extrai nome, cor e dominio e limpa o marcador do texto", () => {
    const r = parseCarouselSlides(
      `[MARCA: Nubank | #820AD1 | nubank.com.br]
SLIDE 1:
O banco que venceu sem agencia
[FOTO: cartao roxo do Nubank]

SLIDE 2:
Miolo

SLIDE 3:
CTA final

---LEGENDA---
Legenda aqui`
    );
    expect(r.companyBrand).toEqual({
      name: "Nubank",
      color: "#820AD1",
      domain: "nubank.com.br",
    });
    expect(r.hook).toContain("banco que venceu");
    expect(r.hook).not.toContain("MARCA");
  });

  it("sem marcador retorna companyBrand null", () => {
    const r = parseCarouselSlides(`Capa\n\nMeio\n\nFim`);
    expect(r.companyBrand).toBeNull();
  });
});
