import { LogIn } from "lucide-react";
import { AuthCard } from "~/client/modules/identity/components/AuthCard";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { Button } from "~/client/shared/components/ui/button";
import { useDictionary } from "~/client/shared/hooks/useDictionary";
import { GoogleIcon } from "./GoogleIcon";

export function LoginScreen({ redirectTo }: { redirectTo: string }) {
  const dictionary = useDictionary();
  const t = dictionary.loginPage;
  const loginHref = `/api/v1/web/auth/login?redirect=${encodeURIComponent(redirectTo)}`;

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
            render={<a href={loginHref} />}
          >
            <GoogleIcon className="size-4" />
            {t.loginButton}
          </Button>
        }
        footnote={t.footerPrompt}
        heading={t.heading}
        icon={LogIn}
        subtitle={t.subtitle}
      >
        {t.body}
      </AuthCard>
    </AppShell>
  );
}
