import { call, friendlyError } from "./api";
import type { OnboardingRequest, OnboardingState } from "@/lib/onboarding/schema";
export const onboardingApi = {
  get: () => call<OnboardingState>("/api/onboarding"),
  save: (body: OnboardingRequest) => call<OnboardingState>("/api/onboarding", { method: "POST", body: JSON.stringify(body) }),
};
export const operationError = (error: unknown): string => error instanceof Error ? error.message : "That request could not finish. Your draft has been kept.";
export function requireResult<T>(result: Awaited<ReturnType<typeof call<T>>>): T {
  if (!result.ok) throw new Error(result.code === "model_unavailable" ? "Reading is temporarily unavailable. Please try again shortly." : friendlyError(result));
  return result.data;
}
