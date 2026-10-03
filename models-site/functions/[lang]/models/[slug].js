import { renderModelPage } from "../../_lib/model-page.js";

export function onRequestGet(context) {
  const { lang, slug } = context.params;
  if (!["fr", "ru", "es", "cs", "ar"].includes(lang)) return context.next();
  return renderModelPage(context, lang, slug);
}
