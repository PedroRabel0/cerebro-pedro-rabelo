"use client";

import { useState, useEffect, useTransition } from "react";
import type { ReferencePost, ReferenceProfile } from "@/lib/supabase/types";
import { getPostsByProfile, createPost, deletePost } from "./actions";

function DnaTag({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-blue/20 bg-blue/5 px-1.5 py-0.5 font-mono text-[10px]">
      <span className="text-ink-muted">{label}:</span>
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
    "w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-blue focus:outline-none";

  return (
    <div className="rounded border border-blue/30 bg-paper-dark p-4">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-soft">
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            name="shares"
            type="number"
            placeholder="Shares"
            className={inputCls}
          />
          <input
            name="saves"
            type="number"
            placeholder="Saves"
            className={inputCls}
          />
        </div>

        <fieldset className="rounded border border-rule/50 p-3">
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

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-ink-soft">
            <input
              name="saved_as_reference"
              type="checkbox"
              className="accent-blue"
            />
            Salvar como referência
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue px-4 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Post"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-rule px-4 py-1.5 font-mono text-xs text-ink-muted transition hover:text-ink-soft"
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
      <p className="py-8 text-center text-sm text-ink-muted">
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
          <span className="font-mono text-[10px] text-ink-muted">
            {isPending ? "carregando..." : `${posts.length} post${posts.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-blue px-3 py-1.5 font-mono text-xs font-semibold text-paper transition hover:opacity-90"
        >
          + Novo Post
        </button>
      </div>

      {!isPending && posts.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          Nenhum post registrado para este perfil. Adicione posts para analisar o
          DNA do conteúdo.
        </p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded border border-blue/20 bg-paper-dark px-4 py-3 transition hover:border-blue/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {post.caption_text && (
                    <p className="mb-1 line-clamp-2 text-sm text-ink">
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
                    <DnaTag label="hook" value={post.hook_type} />
                    <DnaTag label="estrutura" value={post.structure} />
                    <DnaTag label="tom" value={post.tone} />
                    <DnaTag label="tamanho" value={post.length} />
                    <DnaTag label="cta" value={post.cta_type} />
                    <DnaTag label="tema" value={post.main_theme} />
                    <DnaTag label="sub" value={post.sub_theme} />
                    <DnaTag label="tese" value={post.thesis} />
                  </div>

                  {(post.likes || post.comments || post.shares || post.saves) && (
                    <div className="mt-2 flex gap-3 font-mono text-[10px] text-ink-muted">
                      {post.likes != null && <span>{post.likes} likes</span>}
                      {post.comments != null && (
                        <span>{post.comments} comments</span>
                      )}
                      {post.shares != null && <span>{post.shares} shares</span>}
                      {post.saves != null && <span>{post.saves} saves</span>}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(post.id)}
                  className="shrink-0 rounded px-2 py-1 font-mono text-[10px] text-accent transition hover:bg-paper"
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
