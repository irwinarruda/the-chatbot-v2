import { createFileRoute } from "@tanstack/react-router";
import { ArtifactViewerScreen } from "~/modules/artifacts/client/screens/ArtifactViewerScreen";

export const Route = createFileRoute("/a/$artifactId")({
  component: ArtifactRoute,
  head: () => ({ meta: [{ title: "Artifact - The Chatbot" }] }),
});

function ArtifactRoute() {
  return <ArtifactViewerScreen artifactId={Route.useParams().artifactId} />;
}
