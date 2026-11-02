"use client";

// shadcn Input OTP primitives used by ReUI c-input-otp-5, styled with the app's CSS tokens.
import { useContext, type ComponentProps } from "react";
import { OTPInput, OTPInputContext } from "input-otp";

export function InputOTP(props: ComponentProps<typeof OTPInput>) {
  return <OTPInput data-slot="input-otp" containerClassName="otp-container" {...props} />;
}

export function InputOTPGroup(props: ComponentProps<"div">) {
  return <div data-slot="input-otp-group" className="otp-group" {...props} />;
}

export function InputOTPSlot({ index }: { index: number }) {
  const context = useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = context.slots[index];
  return (
    <div data-slot="input-otp-slot" data-active={isActive} className="otp-slot" aria-hidden="true">
      {char}
      {hasFakeCaret && <span className="otp-caret" />}
    </div>
  );
}
