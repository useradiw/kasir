import { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";

export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [],
};
