import { OAUTH_APPROVE_PATH, type OAuthAuthorizationRequestDTO } from "./oauth";

export interface OAuthConsentPageDTO {
  clientName: string;
  redirectHost: string;
  userEmail: string;
  request: OAuthAuthorizationRequestDTO;
}

export function toOAuthConsentPage(page: OAuthConsentPageDTO): string {
  const hiddenFields = Object.entries(page.request)
    .filter(([, value]) => value !== undefined)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(String(value))}">`,
    )
    .join("");
  return renderPage(
    "Conectar ao The Chatbot",
    [
      "<h1>Conectar ao The Chatbot</h1>",
      `<p><strong>${escapeHtml(page.clientName)}</strong> quer acessar suas finanças, contas do mês, notas, tarefas e artefatos em nome de <strong>${escapeHtml(page.userEmail)}</strong>.</p>`,
      `<p class="muted">Depois de aprovar, você volta para ${escapeHtml(page.redirectHost)}.</p>`,
      `<form method="post" action="${OAUTH_APPROVE_PATH}">${hiddenFields}`,
      '<button type="submit" name="decision" value="approve">Permitir acesso</button>',
      '<button type="submit" name="decision" value="deny">Cancelar</button>',
      "</form>",
    ].join(""),
  );
}

export function toOAuthRedirectPage(url: string): string {
  return renderPage(
    "Voltando ao aplicativo",
    [
      "<h1>Pronto</h1>",
      `<p><a href="${escapeHtml(url)}">Continuar</a></p>`,
      `<script>location.replace(${JSON.stringify(url).replaceAll("<", "\\u003c")})</script>`,
    ].join(""),
  );
}

export function toOAuthErrorPage(message: string): string {
  return renderPage(
    "Não foi possível conectar",
    `<h1>Não foi possível conectar</h1><p>${escapeHtml(message)}</p>`,
  );
}

function renderPage(title: string, body: string): string {
  return [
    "<!doctype html>",
    '<html lang="pt-BR"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    ":root{color-scheme:light dark;font-family:system-ui,sans-serif}",
    "body{margin:0;min-height:100vh;display:grid;place-items:center;background:Canvas;color:CanvasText}",
    "main{max-width:28rem;padding:2rem 1rem;line-height:1.5}",
    "h1{font-size:1.4rem}.muted{opacity:.7}",
    "button{font:inherit;padding:.6rem 1rem;margin:.5rem .5rem 0 0;border-radius:.5rem;border:1px solid ButtonBorder;background:ButtonFace;color:ButtonText;cursor:pointer}",
    "button[value=approve]{font-weight:600}",
    "</style></head><body><main>",
    body,
    "</main></body></html>",
  ].join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
