"use client";

import { useState, useEffect, useTransition } from "react";
import type { ReferencePost, ReferenceProfile } from "@/lib/supabase/types";
import { getPostsByProfile, createPost, deletePost } from "./actions";

function DnaTag({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-blue/20 bg-blue/5 px-1.5 py-0.5 font-mono text-[10px]">
      <span className="text-text-muted">{label}:</span>
      <span className="text-blue">{value}</span>
    </span>
  );
}

function PostForm({
  profile,
  onClose,
}: {
  profile: ReferenceProfile;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    await createPost(new FormData(e.currentTarget));
    setSaving(false);
    onClose();
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-blue focus:outline-none";

  return (
    <div className="rounded-xl border border-blue/30 bg-card p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-text-secondary">
        Novo Post de Referência
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="hidden" name="profile_id" value={profile.id} />
        <input type="hidden" name="platform" value={profile.platform} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="url" placeholder="URL do post" className={inputCls} />
          <input
            name="thumbnail_url"
            placeholder="URL da thumbnail"
            className={inputCls}
          />
        </div>

        <textarea
          name="caption_text"
          placeholder="Texto / legenda do post..."
          rows={3}
          className={inputCls}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <input
            name="likes"
            type="number"
            placeholder="Likes"
            className={inputCls}
          />
          <input
            name="comments"
            type="number"
            placeholder="Comentários"
            className={inputCls}
          />
          <input
            name="engagement_rate"
            type="number"
            step="0.01"
            placeholder="Engajamento %"
            className={inputCls}
          />
        </div>

        <fieldset className="rounded-lg border border-border/50 p-3">
          <legend className="px-1 font-mono text-[10px] uppercase tracking-wider text-blue">
            DNA do Conteúdo
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              name="hook_type"
              placeholder="Tipo de hook"
              className={inputCls}
            />
            <input
              name="structure"
              placeholder="Estrutura"
              className={inputCls}
            />
            <input
              name="length"
              placeholder="Duração / tamanho"
              className={inputCls}
            />
            <input name="tone" placeholder="Tom" className={inputCls} />
            <input
              name="cta_type"
              placeholder="Tipo de CTA"
              className={inputCls}
            />
            <input
              name="main_theme"
              placeholder="Tema principal"
              className={inputCls}
            />
            <input
              name="sub_theme"
              placeholder="Sub-tema"
              className={inputCls}
            />
            <input name="thesis" placeholder="Tese" className={inputCls} />
          </div>
        </fieldset>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue px-4 py-1.5 font-mono text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Post"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-1.5 font-mono text-xs text-text-muted transition hover:text-text hover:border-border-light"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PostList({
  profile,
}: {
  profile: ReferenceProfile | null;
}) {
  const [posts, setPosts] = useState<ReferencePost[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!profile) {
      setPosts([]);
      return;
    }
    startTransition(async () => {
      const data = await getPostsByProfile(profile.id);
      setPosts(data);
    });
  }, [profile]);

  if (!profile) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">
        Selecione um perfil na barra lateral para ver seus posts.
      </p>
    );
  }

  if (showForm) {
    return (
      <PostForm
        profile={profile}
        onClose={() => {
          setShowForm(false);
          startTransition(async () => {
            const data = await getPostsByProfile(profile.id);
            setPosts(data);
          });
        }}
      />
    );
  }

  async function handleDelete(id: string) {
    if (!confirm("Apagar este post de referência?")) return;
    await deletePost(id);
    if (profile) {
      startTransition(async () => {
        const data = await getPostsByProfile(profile.id);
        setPosts(data);
      });
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-blue">
            {profile.display_name}
          </span>
          <span className="font-mono text-[10px] text-text-muted">
            {isPending ? "carregando..." : `${posts.length} post${posts.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-blue px-3 py-1.5 font-mono text-xs font-bold text-white transition hover:opacity-90"
        >
          + Novo Post
        </button>
      </div>

      {!isPending && posts.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          Nenhum post registrado para este perfil. Adicione posts para analisar o
          DNA do conteúdo.
        </p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-xl border border-blue/20 bg-card px-4 py-3 transition hover:border-blue/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-purple/15 px-2 py-0.5 text-[11px] font-medium text-purple">
                      Terceiros
                    </span>
                  </div>
                  {post.caption_text && (
                    <p className="mb-1 line-clamp-2 text-sm text-text">
                      {post.caption_text}
                    </p>
                  )}
                  {post.url && (
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 inline-block truncate font-mono text-[10px] text-blue underline"
                    >
                      {post.url}
                    </a>
                  )}

                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <DnaTag label="hook" value={post.dna_hook_type} />
                    <DnaTag label="estrutura" value={post.dna_structure} />
                    <DnaTag label="tom" value={post.dna_tone} />
                    <DnaTag label="tamanho" value={post.dna_length} />
                    <DnaTag label="cta" value={post.dna_cta_type} />
                    <DnaTag label="tema" value={post.dna_main_theme} />
                    <DnaTag label="sub" value={post.dna_sub_theme} />
                    <DnaTag label="tese" value={post.dna_thesis} />
                  </div>

                  {(post.likes || post.comments || post.engagement_rate) && (
                    <div className="mt-2 flex gap-3 font-mono text-[10px] text-text-muted">
                      {post.likes != null && <span>{post.likes} likes</span>}
                      {post.comments != null && (
                        <span>{post.comments} comments</span>
                      )}
                      {post.engagement_rate != null && (
                        <span>{post.engagement_rate}% engajamento</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(post.id)}
                  className="shrink-0 rounded-lg px-2 py-1 font-mono text-[10px] text-red transition hover:bg-card"
                >
                  Apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
