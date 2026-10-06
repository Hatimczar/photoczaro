import { renderHomePage } from "./_lib/pages.js";

export function onRequestGet(context) {
  return renderHomePage(context, "");
}
