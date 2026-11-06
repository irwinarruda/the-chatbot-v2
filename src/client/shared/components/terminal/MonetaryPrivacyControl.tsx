import { Eye, EyeOff } from "lucide-react";
import { useApp } from "~/client/shared/stores/app";
import { TerminalChromeButton } from "./TerminalChromeButton";

export function MonetaryPrivacyControl({
  hideLabel,
  showLabel,
}: {
  hideLabel: string;
  showLabel: string;
}) {
  const isMoneyHidden = useApp((state) => state.isMoneyHidden);
  const isMoneyPrivacyHydrated = useApp(
    (state) => state.isMoneyPrivacyHydrated,
  );
  const toggleMoneyVisibility = useApp((state) => state.toggleMoneyVisibility);
  const isMoneyMasked = !isMoneyPrivacyHydrated || isMoneyHidden;
  let title = hideLabel;
  if (isMoneyMasked) title = showLabel;

  return (
    <TerminalChromeButton
      className="aria-pressed:border-brand/30 aria-pressed:bg-brand/12 aria-pressed:text-primary"
      onClick={toggleMoneyVisibility}
      pressed={isMoneyMasked}
      title={title}
    >
      {isMoneyMasked ? <EyeOff /> : <Eye />}
    </TerminalChromeButton>
  );
}
