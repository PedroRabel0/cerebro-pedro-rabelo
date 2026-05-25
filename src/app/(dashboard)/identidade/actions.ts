"use server";

import { createClient } from "@/lib/supabase/server";
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
