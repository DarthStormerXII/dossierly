import { prepare } from "@/lib/features/prepare";
import { handle } from "@/lib/features/route";
import { PrepareRequestSchema } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handle(request, PrepareRequestSchema, prepare);
}
