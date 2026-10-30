import { PlanBody } from "@/components/app/PlanBody";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ plan?: string; reason?: string }> }) {
  const { plan, reason } = await searchParams;
  return <PlanBody suggest={plan === "plus" ? "plus" : undefined} reason={reason} />;
}
