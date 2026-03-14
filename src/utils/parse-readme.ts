// src/utils/parse-readme.ts

/**
 * Fetches a HuggingFace model README and extracts the first meaningful paragraph.
 */
export async function fetchReadmeDescription(
  modelId: string,
  timeoutMs = 5000,
): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(
        `https://huggingface.co/${modelId}/raw/main/README.md`,
        { signal: controller.signal },
      );
      if (!res.ok) return undefined;
      const text = await res.text();
      return parseReadmeDescription(text);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return undefined;
  }
}

/**
 * Parses README markdown and extracts the first meaningful paragraph.
 */
export function parseReadmeDescription(readme: string): string | undefined {
  const withoutFrontmatter = readme.replace(/^---[\s\S]*?---\s*/, '');
  const lines = withoutFrontmatter.split('\n');
  let paragraph = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { if (paragraph) break; continue; }
    if (trimmed.startsWith('#')) { if (paragraph) break; continue; }
    if (/^\[?!\[/.test(trimmed) || /^</.test(trimmed)) continue;
    if (/^\[.*\]\(.*\)$/.test(trimmed)) continue;
    paragraph += (paragraph ? ' ' : '') + trimmed;
  }
  if (!paragraph) return undefined;
  paragraph = paragraph
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
  if (!paragraph) return undefined;
  if (paragraph.length > 300) paragraph = paragraph.slice(0, 297) + '...';
  return paragraph;
}
