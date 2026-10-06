import { renderModelsPage } from "../_lib/pages.js";

export function onRequestGet(context) {
  return renderModelsPage(context, "");
}
