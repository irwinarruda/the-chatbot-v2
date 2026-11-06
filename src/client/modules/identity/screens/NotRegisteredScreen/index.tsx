import { Link } from "@tanstack/react-router";
import { UserX } from "lucide-react";
import { AuthCard } from "~/client/modules/identity/components/AuthCard";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { Button } from "~/client/shared/components/ui/button";
import { useDictionary } from "~/client/shared/hooks/useDictionary";

export function NotRegisteredScreen({ redirectTo }: { redirectTo: string }) {
  const dictionary = useDictionary();
  const t = dictionary.notRegisteredPage;

  return (
    <AppShell
      dictionary={dictionary}
      showNavigation={false}
      title={t.windowTitle}
    >
      <AuthCard
        actions={
          <>
            <Button
              className="h-11 w-full"
              nativeButton={false}
              render={<Link to="/login" search={{ redirect: redirectTo }} />}
            >
              {t.retryAction}
            </Button>
            <Button
              className="h-11 w-full"
              nativeButton={false}
              render={<Link to="/" />}
              variant="ghost"
            >
              {t.backLink}
            </Button>
          </>
        }
        heading={t.heading}
        icon={UserX}
        iconClassName="bg-warning/10 text-warning"
        subtitle={t.subtitle}
      >
        {t.body}
      </AuthCard>
    </AppShell>
  );
}
