import { renderModelsPage, LANGS } from "../../_lib/pages.js";

export function onRequestGet(context) {
  if (!LANGS.includes(context.params.lang)) return context.next();
  return renderModelsPage(context, context.params.lang);
}
