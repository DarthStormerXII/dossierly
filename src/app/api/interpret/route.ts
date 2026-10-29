import { interpret } from "@/lib/features/interpret";
import { handle } from "@/lib/features/route";
import { InterpretRequestSchema } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handle(request, InterpretRequestSchema, interpret);
}
