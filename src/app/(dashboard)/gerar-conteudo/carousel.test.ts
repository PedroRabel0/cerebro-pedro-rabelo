import { describe, it, expect } from "vitest";
import { parseCarouselSlides } from "./carousel";

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
