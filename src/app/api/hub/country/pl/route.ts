import { NextResponse } from "next/server";
import { LANGUAGES } from "@/lib/schemas";
import { COUNTRY, coverage, sources } from "@/lib/hub/data";

export const dynamic = "force-static";

/** Public: what Dossierly covers in Poland, straight from hub/poland/coverage.json. */
export function GET() {
  return NextResponse.json({
    country: COUNTRY,
    name: coverage.name ?? "Poland",
    scope: coverage.scope,
    languages: LANGUAGES,
    offices: coverage.offices,
    letterTypes: coverage.letterTypes,
    fees: coverage.fees,
    notices: coverage.notices,
    sources: sources.map((s) => ({ id: s.id, url: s.url, title: s.title, kind: s.kind, verified: s.verified })),
    disclaimer: coverage.disclaimer,
  });
}
