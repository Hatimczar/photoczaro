import { renderStaticPage } from "../_lib/pages.js";

export async function onRequestGet(context) {
  const res = await renderStaticPage(context, context.params.lang, context.params.page);
  return res || context.next();
}
