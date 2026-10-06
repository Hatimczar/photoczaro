import { renderHomePage, LANGS } from "../_lib/pages.js";

export function onRequestGet(context) {
  if (!LANGS.includes(context.params.lang)) return context.next();
  return renderHomePage(context, context.params.lang);
}
