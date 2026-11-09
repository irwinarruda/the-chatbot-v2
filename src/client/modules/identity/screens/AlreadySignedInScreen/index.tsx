import { Link } from "@tanstack/react-router";
import { CircleCheck } from "lucide-react";
import { AuthCard } from "~/client/modules/identity/components/AuthCard";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { Button } from "~/client/shared/components/ui/button";
import { useDictionary } from "~/client/shared/hooks/useDictionary";

export function AlreadySignedInScreen() {
  const dictionary = useDictionary();
  const t = dictionary.alreadySignedInPage;

  return (
    <AppShell
      dictionary={dictionary}
      showNavigation={false}
      title={t.windowTitle}
    >
      <AuthCard
        actions={
          <Button
            className="h-11 w-full"
            nativeButton={false}
            render={<Link to="/chat" />}
          >
            {t.openAction}
          </Button>
        }
        footnote={t.footerPrompt}
        heading={t.heading}
        icon={CircleCheck}
        iconClassName="bg-success-soft text-success"
        subtitle={t.subtitle}
      >
        {t.body}
      </AuthCard>
    </AppShell>
  );
}
