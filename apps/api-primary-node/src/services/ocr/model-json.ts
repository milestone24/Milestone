import type { z } from "zod";

/**
 * Strips optional ```json ... ``` fences from model output.
 */
export function stripMarkdownCodeFence(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m?.[1]) return m[1].trim();
  return s.trim();
}

function extractFirstJsonObjectSlice(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function extractFirstJsonArraySlice(s: string): string | null {
  const start = s.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export function parseJsonObjectWithSchema<T extends z.ZodTypeAny>(
  raw: string,
  schema: T,
  context: string
): z.infer<T> {
  const trimmed = stripMarkdownCodeFence(raw.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const slice = extractFirstJsonObjectSlice(trimmed);
    if (!slice) {
      throw new Error(
        `${context}: could not parse JSON object (prefix=${JSON.stringify(trimmed.slice(0, 120))})`
      );
    }
    parsed = JSON.parse(slice);
  }
  const out = schema.safeParse(parsed);
  if (!out.success) {
    throw new Error(
      `${context}: schema validation failed: ${out.error.message}`
    );
  }
  return out.data;
}

export function parseJsonArrayWithSchema<T extends z.ZodTypeAny>(
  raw: string,
  schema: T,
  context: string
): z.infer<T> {
  const trimmed = stripMarkdownCodeFence(raw.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const slice = extractFirstJsonArraySlice(trimmed);
    if (!slice) {
      throw new Error(
        `${context}: could not parse JSON array (prefix=${JSON.stringify(trimmed.slice(0, 120))})`
      );
    }
    parsed = JSON.parse(slice);
  }
  const out = schema.safeParse(parsed);
  if (!out.success) {
    throw new Error(
      `${context}: schema validation failed: ${out.error.message}`
    );
  }
  return out.data;
}
