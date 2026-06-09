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
