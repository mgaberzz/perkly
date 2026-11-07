import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { LANG_COOKIE, makeT, type Lang } from "./index";

export const getLang = cache(async (): Promise<Lang> => ((await cookies()).get(LANG_COOKIE)?.value === "ar" ? "ar" : "en"));
export async function getT() {
  return makeT(await getLang());
}
