import { linkLetter } from "@/lib/features/letters";
import { handle } from "@/lib/features/route";
import { LettersLinkRequestSchema } from "@/lib/schemas";

export const maxDuration = 120;

export async function POST(request: Request) {
  return handle(request, LettersLinkRequestSchema, linkLetter);
}
