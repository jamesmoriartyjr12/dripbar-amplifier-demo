import { handleAnalyze } from "@/lib/amplifier/routes";

export async function POST(request: Request) {
  return handleAnalyze(request);
}
