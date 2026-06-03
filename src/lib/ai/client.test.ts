import { describe, it, expect } from 'vitest';
import { parseJSON } from './client';

describe('parseJSON', () => {
  it('parses clean JSON object', () => {
    const result = parseJSON<{ name: string }>('{"name": "Pedro"}');
    expect(result).toEqual({ name: 'Pedro' });
  });

  it('parses JSON wrapped in markdown code block', () => {
    const input = '```json\n{"title": "Test", "value": 123}\n```';
    const result = parseJSON<{ title: string; value: number }>(input);
    expect(result).toEqual({ title: 'Test', value: 123 });
  });

  it('parses JSON with text before and after', () => {
    const input = 'Here is the result:\n\n{"detected_type": "free_text", "title": "Teste"}\n\nDone.';
    const result = parseJSON<{ detected_type: string; title: string }>(input);
    expect(result).toEqual({ detected_type: 'free_text', title: 'Teste' });
  });

  it('parses JSON array', () => {
    const input = '[{"type": "playbook"}, {"type": "story"}]';
    const result = parseJSON<{ type: string }[]>(input);
    expect(result).toHaveLength(2);
    expect(result?.[0].type).toBe('playbook');
  });

  it('parses large nested JSON from markdown block', () => {
    const input = '```json\n{"proposals": [{"type": "playbook", "title": "Framework de Decisao", "content_markdown": "## Conceito\\n\\nTexto longo aqui com muitas linhas e secoes..."}], "extracted_themes": ["decisao", "gestao"]}\n```';
    const result = parseJSON<{ proposals: { type: string }[]; extracted_themes: string[] }>(input);
    expect(result?.proposals).toHaveLength(1);
    expect(result?.extracted_themes).toContain('decisao');
  });

  it('returns null for invalid JSON', () => {
    const result = parseJSON('This is not JSON at all');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseJSON('');
    expect(result).toBeNull();
  });

  it('handles JSON with escaped quotes', () => {
    const input = '{"title": "Pedro disse \\"isso funciona\\""}';
    const result = parseJSON<{ title: string }>(input);
    expect(result?.title).toContain('isso funciona');
  });

  it('handles markdown block without json label', () => {
    const input = '```\n{"type": "test"}\n```';
    const result = parseJSON<{ type: string }>(input);
    expect(result?.type).toBe('test');
  });

  it('extracts JSON from AI response with explanation text', () => {
    const input = `Aqui esta o resultado da analise:

{"detected_type": "youtube", "title": "Video sobre IA", "summary": "Um video sobre inteligencia artificial", "proposals": [{"type": "playbook", "title": "Como usar IA", "content_markdown": "## Framework\\n\\nPasso 1...", "suggested_tags": ["ia", "tecnologia"]}], "extracted_themes": ["ia"], "speaker_verified": true}

Espero que isso ajude!`;
    const result = parseJSON<{ detected_type: string; proposals: unknown[] }>(input);
    expect(result?.detected_type).toBe('youtube');
    expect(result?.proposals).toHaveLength(1);
  });
});
