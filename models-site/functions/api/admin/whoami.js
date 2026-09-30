import { json } from "../../_lib/http.js";
import { requireAccessIdentity } from "../../_lib/admin-auth.js";

// Lets the admin SPA show who's signed in and offer a real logout link.
// The Cf-Access-Authenticated-User-Email header itself isn't readable from
// page JS (it's a request header, not exposed to the DOM), so this small
// endpoint just echoes it back.
export async function onRequestGet({ request }) {
  const email = requireAccessIdentity(request);
  if (!email) return json({ error: "Unauthorized" }, 401);
  return json({ email });
}
