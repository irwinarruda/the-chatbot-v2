export function ArtifactFrame({
  html,
  title,
}: {
  html: string;
  title: string;
}) {
  return (
    <iframe
      className="block min-h-0 w-full flex-1 border-0 bg-term-bg"
      referrerPolicy="no-referrer"
      sandbox=""
      srcDoc={html}
      title={title}
    />
  );
}
