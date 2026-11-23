import { connection } from "next/server";
import { readAmplifierConfig } from "@/lib/amplifier/adapter";
import { checkPresenterAccess } from "@/lib/amplifier/access";

export async function GET(request: Request) {
  await connection();
  const access = checkPresenterAccess(request);
  return Response.json({
    configured: readAmplifierConfig() !== null,
    presenterAccess: access.ok,
    presenterKeyRequired: Boolean(process.env.DEMO_PRESENTER_KEY?.trim()),
  });
}
