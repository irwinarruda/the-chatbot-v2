import { Eye, EyeOff } from "lucide-react";
import { TerminalChromeButton } from "~/shared/client/components/terminal/TerminalChromeButton";
import { useApp } from "~/shared/client/stores";

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
      className="aria-pressed:border-term-amber/30 aria-pressed:bg-term-amber/10 aria-pressed:text-term-amber"
      onClick={toggleMoneyVisibility}
      pressed={isMoneyMasked}
      title={title}
    >
      {isMoneyMasked ? (
        <EyeOff className="size-3" />
      ) : (
        <Eye className="size-3" />
      )}
    </TerminalChromeButton>
  );
}
