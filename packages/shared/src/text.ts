/**
 * @deprecated Chat now renders markdown natively via react-markdown.
 * Kept as a pass-through for backward compatibility.
 */
export function sanitizeChatPlainText(text: string): string {
  return text;
}
