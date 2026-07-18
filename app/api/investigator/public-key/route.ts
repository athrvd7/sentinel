import { investigatorKeyStore } from "@/lib/investigator-keys";

export function GET() {
  return Response.json({ publicKey: investigatorKeyStore().publicJwk() });
}
