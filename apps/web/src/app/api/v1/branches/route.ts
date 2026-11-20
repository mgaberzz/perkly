import { auth, json } from "@/lib/api-v1";

/** GET /api/v1/branches */
export async function GET(req: Request) {
  const a = await auth(req); if (a instanceof Response) return a;
  const { data } = await a.db.from("merchant_branches").select("id, name, address, city, lat, lng, is_active").eq("merchant_id", a.merchantId).order("name");
  return json({ data: data ?? [] });
}
