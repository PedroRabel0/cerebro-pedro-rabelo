"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-guards";
import { revalidatePath } from "next/cache";

export interface Identity {
  id: number;
  colors: Record<string, string> | null;
  fonts: Record<string, string> | null;
  voice_uses: string[] | null;
  voice_avoids: string[] | null;
  tone_descriptors: string | null;
  opening_style: string | null;
  closing_style: string | null;
  positioning: string | null;
  reference_creators: string | null;
  brandbook_url: string | null;
  updated_at: string | null;
}

export async function getIdentity(): Promise<Identity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("identity")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertIdentity(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const colorsRaw = formData.get("colors") as string;
  const fontsRaw = formData.get("fonts") as string;
  const voiceUsesRaw = formData.get("voice_uses") as string;
  const voiceAvoidsRaw = formData.get("voice_avoids") as string;

  let colors: Record<string, string> | null = null;
  try {
    colors = colorsRaw ? JSON.parse(colorsRaw) : null;
  } catch {
    throw new Error("Cores: JSON inválido");
  }

  let fonts: Record<string, string> | null = null;
  try {
    fonts = fontsRaw ? JSON.parse(fontsRaw) : null;
  } catch {
    throw new Error("Fontes: JSON inválido");
  }

  const voice_uses: string[] = voiceUsesRaw
    ? JSON.parse(voiceUsesRaw)
    : [];
  const voice_avoids: string[] = voiceAvoidsRaw
    ? JSON.parse(voiceAvoidsRaw)
    : [];

  const payload = {
    id: 1,
    colors,
    fonts,
    voice_uses,
    voice_avoids,
    tone_descriptors: (formData.get("tone_descriptors") as string) || null,
    opening_style: (formData.get("opening_style") as string) || null,
    closing_style: (formData.get("closing_style") as string) || null,
    positioning: (formData.get("positioning") as string) || null,
    reference_creators: (formData.get("reference_creators") as string) || null,
    brandbook_url: (formData.get("brandbook_url") as string) || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("identity").upsert(payload, {
    onConflict: "id",
  });
  if (error) throw error;
  revalidatePath("/identidade");
}

const PEDRO_BRAND_DEFAULTS = {
  id: 1,
  colors: { primary: "#000000", accent: "#c9412b" },
  fonts: { display: "Fraunces", body: "Inter", mono: "JetBrains Mono" },
  voice_uses: [
    "Frameworks práticos",
    "Experiência real de operação",
    "Honestidade radical",
    "Pensamento crítico",
    "Simplicidade",
    "Exemplos concretos",
    "Linguagem direta",
  ],
  voice_avoids: [
    "Ostentação",
    "Teoria vazia",
    "Jargão corporativo",
    "Conteúdo de lifestyle",
    "Vida pessoal",
    "Guru de palco",
    "Promessas exageradas",
  ],
  tone_descriptors:
    "Direto, prático, contrário ao senso comum. Fala como quem já operou, errou e fez exit. Sem firula, sem enrolação. Tom de conversa entre sócios, não de professor.",
  opening_style:
    "Começa com uma verdade incômoda ou framework contraintuitivo. Nunca com 'Olá pessoal' ou 'Nesse vídeo vou falar sobre'. Abre com impacto.",
  closing_style:
    "Fecha com uma provocação ou pergunta que força reflexão. Nunca com 'Se gostou, curta e compartilhe'. Termina com peso.",
  positioning:
    "Empreendedores com negócios rodando que querem escalar deveriam tomar decisões com base em frameworks reais e experiência de quem já operou, errou e fez exit — não em teoria de guru de palco.",
  reference_creators: "Alex Hormozi, Leila Hormozi, Naval Ravikant, Charlie Munger",
  brandbook_url: null,
  updated_at: new Date().toISOString(),
} as const;

export async function autoFillIdentity(): Promise<Identity> {
  await requireAdmin();
  const existing = await getIdentity();

  const isEmpty =
    !existing ||
    (
      !existing.colors &&
      !existing.fonts &&
      (!existing.voice_uses || existing.voice_uses.length === 0) &&
      (!existing.voice_avoids || existing.voice_avoids.length === 0) &&
      !existing.tone_descriptors &&
      !existing.opening_style &&
      !existing.closing_style &&
      !existing.positioning &&
      !existing.reference_creators
    );

  if (isEmpty) {
    const supabase = await createClient();
    const payload = {
      ...PEDRO_BRAND_DEFAULTS,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("identity")
      .upsert(payload, { onConflict: "id" });
    if (error) throw error;
    revalidatePath("/identidade");
    return { ...payload, id: 1 } as unknown as Identity;
  }

  return existing;
}

export async function resetToPedroDefaults(): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const payload = {
    ...PEDRO_BRAND_DEFAULTS,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("identity")
    .upsert(payload, { onConflict: "id" });
  if (error) throw error;
  revalidatePath("/identidade");
}
