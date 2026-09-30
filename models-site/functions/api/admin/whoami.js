import { json } from "../../_lib/http.js";
import { requireAccessIdentity } from "../../_lib/admin-auth.js";

// Lets the admin SPA show who's signed in and offer a real logout link.
// The Access identity isn't readable from page JS (it only ever arrives as
// a request header/JWT, never exposed to the DOM), so this small endpoint
// verifies it server-side and echoes back just the email.
export async function onRequestGet({ request }) {
  const email = await requireAccessIdentity(request);
  if (!email) return json({ error: "Unauthorized" }, 401);
  return json({ email });
}
