import { auth, json } from "@/lib/api-v1";

export async function GET(req: Request) {
  const a = await auth(req); if (a instanceof Response) return a;
  const { data } = await a.db.from("merchants").select("merchant_code, name, status, channel").eq("id", a.merchantId).single();
  return json({ data: { merchant_code: data?.merchant_code, name: data?.name, status: data?.status, channel: data?.channel } });
}
