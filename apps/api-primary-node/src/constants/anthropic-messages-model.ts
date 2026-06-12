/**
 * Model ID for `anthropic.messages.create` (text, vision, PDF documents).
 * Snapshot IDs retire over time; use the Models API or docs to rotate.
 * @see https://platform.claude.com/docs/en/about-claude/models/overview
 *
 * Override: `ANTHROPIC_OCR_MODEL` or `ANTHROPIC_MODEL` (first wins).
 */
export const ANTHROPIC_MESSAGES_MODEL =
  process.env.ANTHROPIC_OCR_MODEL?.trim() ||
  process.env.ANTHROPIC_MODEL?.trim() ||
  "claude-sonnet-4-6";
