import { connection } from "next/server";
import { handleJob } from "@/lib/amplifier/routes";

export async function GET(request: Request, ctx: RouteContext<"/api/amplifier/jobs/[jobId]">) {
  await connection();
  const { jobId } = await ctx.params;
  return handleJob(request, jobId);
}
