// TEMPORARY diagnostic endpoint - not linked from any UI, delete after use.
// Sits behind the same Access-protected /api/admin/* path so it only proves
// what headers actually reach the Function once Access has let a request
// through, without depending on our own requireAccessIdentity() check.
import { json } from "../../_lib/http.js";

export async function onRequestGet({ request }) {
  const relevant = {};
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase().startsWith("cf-") || key.toLowerCase() === "cookie") {
      relevant[key] = key.toLowerCase() === "cookie" ? `(present, ${value.length} chars)` : value;
    }
  }
  return json(relevant);
}
