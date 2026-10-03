import { renderModelPage } from "../_lib/model-page.js";

export function onRequestGet(context) {
  return renderModelPage(context, "", context.params.slug);
}
