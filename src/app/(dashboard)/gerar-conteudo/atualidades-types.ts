/**
 * Tipos do formato "O que está rolando" (Atualidades) — compartilhados entre
 * as server actions (actions.ts) e a UI (Tabs.tsx). Ficam num arquivo próprio
 * porque o actions.ts é "use server" e só pode exportar funções async.
 */

export type TemaNoticia = "startups" | "ia" | "brasil" | "negocios";

export interface Noticia {
  id: string;
  manchete: string;
  resumo: string;
  tema: TemaNoticia;
  fonte_veiculo: string;
  fonte_url: string;
}
