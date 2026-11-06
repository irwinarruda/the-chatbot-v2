import { createFileRoute } from "@tanstack/react-router";
import { HomeScreen } from "~/client/modules/home/screens/HomeScreen";
import { getDictionary } from "~/client/shared/i18n/dictionary";

export const Route = createFileRoute("/")({
  component: HomeScreen,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary(match.context.locale).meta.welcomeTitle,
      },
    ],
  }),
});
