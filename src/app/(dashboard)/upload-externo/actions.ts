"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { log } from "@/lib/logger";

export async function uploadExternalContent(formData: FormData) {
  const supabase = await createClient();

  const title = (formData.get("title") as string) || "Post externo";
  const caption = (formData.get("caption") as string) || "";
  const contentType = (formData.get("content_type") as string) || "instagram_static";
  const platform = (formData.get("platform") as string) || "instagram";
  const file = formData.get("image") as File | null;

  let imageUrl: string | null = null;

  // Upload image to Supabase Storage if provided
  if (file && file.size > 0) {
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "png";
    const filePath = `external-uploads/${timestamp}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(filePath, buffer, {
        contentType: file.type || "image/png",
        upsert: false,
      });

    if (uploadError) {
      log.error("[Upload Externo] Storage upload failed: " + uploadError.message);
      throw new Error("Falha ao fazer upload da imagem: " + uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("generated-images").getPublicUrl(filePath);

    imageUrl = publicUrl;
    log.info(`[Upload Externo] Image uploaded: ${filePath}`);
  }

  // Save to generated_contents table
  const { data, error } = await supabase
    .from("generated_contents")
    .insert({
      source_type: "free_text",
      free_text_input: "Upload externo (Claude Design)",
      content_type: contentType,
      content_text: caption || null,
      image_url: imageUrl,
      image_model: "external",
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    log.error("[Upload Externo] DB insert failed: " + error.message);
    throw new Error("Falha ao salvar conteúdo: " + error.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    actor: "henrique",
    action: "upload_externo",
    entity_type: "generated_content",
    entity_id: data.id,
    entity_title: title,
  });

  log.info(`[Upload Externo] Content saved: ${data.id}`);

  revalidatePath("/upload-externo");
  revalidatePath("/calendario");
  revalidatePath("/gerar-conteudo");

  return { id: data.id, imageUrl };
}

export async function getExternalUploads() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("generated_contents")
    .select("id, content_type, content_text, image_url, status, created_at")
    .eq("image_model", "external")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export interface LinkableContent {
  id: string;
  content_type: string;
  caption: string | null;
  image_url: string | null;
  created_at: string;
  hasSlides: boolean;
}

/**
 * Lista conteúdos já gerados na plataforma para o usuário VINCULAR um upload
 * de design (carrossel em PDF/imagens) e herdar a legenda automaticamente.
 */
export async function getLinkableContents(): Promise<LinkableContent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("generated_contents")
    .select("id, content_type, content_text, image_url, created_at, generation_params")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    log.error("[Upload Design] getLinkableContents failed: " + error.message);
    return [];
  }

  return (data || []).map((c) => {
    const params = (c.generation_params as Record<string, unknown> | null) || {};
    const slides = params.external_slides as unknown[] | undefined;
    return {
      id: c.id,
      content_type: c.content_type,
      caption: c.content_text,
      image_url: c.image_url,
      created_at: c.created_at,
      hasSlides: Array.isArray(slides) && slides.length > 0,
    };
  });
}

/**
 * Sobe UM slide para o Storage e devolve a URL pública.
 * Chamado uma vez por slide (do navegador) para nunca estourar o limite de
 * 4.5MB de body dos server actions do Vercel.
 */
export async function uploadSingleSlide(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const file = formData.get("slide") as File | null;
  if (!file || file.size === 0) return { error: "Arquivo vazio." };

  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const filePath = `external-uploads/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("generated-images")
    .upload(filePath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    log.error("[Upload Design] slide upload failed: " + uploadError.message);
    return { error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("generated-images").getPublicUrl(filePath);

  return { url: publicUrl };
}

/**
 * Grava um upload de design (slides já hospedados) em generated_contents.
 * Se linkedContentId for passado, ANEXA os slides ao conteúdo gerado existente
 * (mantendo a legenda já gerada). Senão, cria um novo registro.
 */
export async function saveDesignUpload(input: {
  slideUrls: string[];
  caption: string;
  contentType: string;
  title?: string;
  linkedContentId?: string | null;
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { slideUrls, caption, contentType, title, linkedContentId } = input;

  if (!slideUrls || slideUrls.length === 0) {
    return { error: "Nenhum slide para salvar." };
  }

  const firstUrl = slideUrls[0];
  // Convencao unica: image_url guarda TODOS os slides como JSON array (igual ao
  // uploadImageToContent), para que parseImageUrls() exiba o carrossel inteiro.
  const imageUrlValue =
    slideUrls.length > 1 ? JSON.stringify(slideUrls) : firstUrl;
  let contentId: string;

  if (linkedContentId) {
    const { data: existing } = await supabase
      .from("generated_contents")
      .select("generation_params, content_text")
      .eq("id", linkedContentId)
      .single();

    const params =
      (existing?.generation_params as Record<string, unknown> | null) || {};

    const { error } = await supabase
      .from("generated_contents")
      .update({
        image_url: imageUrlValue,
        image_model: "external",
        content_text: caption || existing?.content_text || null,
        generation_params: { ...params, external_slides: slideUrls },
        updated_at: new Date().toISOString(),
      })
      .eq("id", linkedContentId);

    if (error) {
      log.error("[Upload Design] link update failed: " + error.message);
      return { error: error.message };
    }
    contentId = linkedContentId;
  } else {
    const { data, error } = await supabase
      .from("generated_contents")
      .insert({
        source_type: "free_text",
        free_text_input: "Upload de design (carrossel)",
        content_type: contentType,
        content_text: caption || null,
        image_url: imageUrlValue,
        image_model: "external",
        generation_params: { external_slides: slideUrls },
        status: "draft",
      })
      .select("id")
      .single();

    if (error) {
      log.error("[Upload Design] insert failed: " + error.message);
      return { error: error.message };
    }
    contentId = data.id;
  }

  await supabase.from("activity_log").insert({
    actor: "henrique",
    action: linkedContentId ? "upload_design_linked" : "upload_design_new",
    entity_type: "generated_content",
    entity_id: contentId,
    entity_title: title || caption.slice(0, 60) || "Upload de design",
  });

  revalidatePath("/upload-externo");
  revalidatePath("/calendario");
  revalidatePath("/gerar-conteudo");

  return { id: contentId };
}
