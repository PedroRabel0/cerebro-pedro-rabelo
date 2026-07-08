/**
 * Tipos do formato "O que está rolando" (Atualidades) — compartilhados entre
 * a server action (actions.ts) e a UI (Tabs.tsx). Ficam num arquivo próprio
 * porque o actions.ts é "use server" e só pode exportar funções async.
 */
export interface AtualidadePick {
  manchete: string;
  resumo_fato: string;
  angulo_pedro: string;
  fonte_veiculo: string;
  fonte_url: string;
}
