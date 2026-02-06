"use client";

type Props = { html: string };

export function MailPreviewClient({ html }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text/70">
        Vorschau des E-Mail-Templates (nur in Dev sichtbar):
      </p>
      <iframe
        title="E-Mail-Template Vorschau"
        srcDoc={html}
        className="w-full min-h-[800px] rounded-xl border border-ring bg-panel"
        sandbox="allow-same-origin"
      />
    </div>
  );
}
