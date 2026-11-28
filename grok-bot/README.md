# The Chatbot no Grok Bot

O Grok Bot funciona como um chat sem interface própria (headless) do The Chatbot. A conversa e o histórico ficam no Grok. Só as ações (ler e mudar finanças, contas do mês, notas, to-dos e artefatos) passam por um servidor MCP remoto do The Chatbot, em `/api/v1/mcp`. Nada da conversa é gravado no banco do The Chatbot.

Esta pasta tem duas peças:

- `skills/the-chatbot/SKILL.md`: a skill para colar no Grok Bot. Ela explica o app, as funções, as convenções e como usar as 4 ferramentas do MCP.
- Este passo a passo, para ligar o conector e testar.

## Como o conector funciona

O MCP expõe 4 ferramentas: `chatbot_guide`, `chatbot_read`, `chatbot_write` e `chatbot_destructive`. O modelo chama o guia de um tópico, aprende as operações e depois chama a ferramenta do risco certo com `{ operation, input }`. Separar leitura, escrita e destruição em ferramentas diferentes deixa você dar aprovações diferentes no Grok para cada uma.

O login usa OAuth 2.1 com PKCE e registro dinâmico de cliente. Ao adicionar o conector, o Grok se registra sozinho, abre a página de consentimento do The Chatbot, você entra com o Google (a mesma conta do app web) e aprova. O Grok recebe um token de acesso de 1 hora e um refresh token de 30 dias, que ele renova sozinho. Cada refresh token vale uma vez só: a renovação troca o par inteiro, e se um refresh token já usado aparecer de novo, o The Chatbot revoga todos os tokens daquela conexão. O banco guarda só o hash SHA-256 de cada código e token.

Endpoints, para depuração:

| URL | Papel |
| --- | --- |
| `/.well-known/oauth-protected-resource/api/v1/mcp` | Diz ao cliente qual servidor de autorização protege o MCP |
| `/.well-known/oauth-authorization-server` | Metadados do servidor de autorização |
| `/api/v1/oauth/register` | Registro dinâmico de clientes públicos |
| `/api/v1/oauth/authorize` | Redireciona para a página de consentimento (`/oauth/authorize`) |
| `/api/v1/oauth/token` | Troca do código e renovação do token |
| `/api/v1/mcp` | O servidor MCP (Streamable HTTP, só POST, respostas JSON, sem sessão) |

## Testar localmente

O Grok só fala com servidores remotos, então o app local precisa de um endereço público. O projeto já usa um domínio fixo do ngrok, que também é o retorno do login Google em desenvolvimento.

1. Suba banco, migrations e app com o túnel:

   ```sh
   bun run dev:local
   ```

   Isso roda `services:ready` (inclui `migrate:up`, que cria as tabelas `mcp_oauth_*`), o `vite dev` na porta 3000 e o ngrok em `https://parrot-fun-nicely.ngrok-free.app`.

2. Confira a descoberta e o 401 sem token:

   ```sh
   B=https://parrot-fun-nicely.ngrok-free.app
   curl -s $B/.well-known/oauth-protected-resource/api/v1/mcp
   curl -s $B/.well-known/oauth-authorization-server
   curl -si -X POST $B/api/v1/mcp -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' | grep -i www-authenticate
   ```

   O primeiro precisa mostrar `"resource":"https://parrot-fun-nicely.ngrok-free.app/api/v1/mcp"`. O último precisa mostrar `WWW-Authenticate: Bearer resource_metadata="…"`.

3. No Grok Bot, adicione um conector MCP personalizado (remoto):
   - URL: `https://parrot-fun-nicely.ngrok-free.app/api/v1/mcp`
   - Autenticação: OAuth. Não há client ID nem secret para preencher: o Grok se registra sozinho.

   O nome exato do menu muda com as versões do Grok; procure por conectores, MCP ou integrações personalizadas. Lembre que conectores valem para a conta inteira do Grok.

4. O Grok abre a página de consentimento. Se o ngrok mostrar a tela de aviso dele, clique em "Visit Site". Entre com o Google se pedir, confira o nome do aplicativo e clique em **Permitir acesso**. A página volta sozinha para o Grok.

5. Crie a skill no Grok Bot: nome `the-chatbot`, a descrição do frontmatter e o corpo de `skills/the-chatbot/SKILL.md` (tudo depois do segundo `---`).

6. Teste numa conversa:
   - "Que dia é hoje?" deve chamar `chatbot_guide` (general) e `chatbot_read` com `get_current_datetime`.
   - "Cria um to-do: comprar café" deve chamar o guia de `todos` e `chatbot_write` com `create_todos`.
   - "Apaga esse to-do" deve pedir confirmação antes de `chatbot_destructive`.
   - "Gastei 40 no mercado no Nubank" deve registrar com `add_transaction` e terminar com o saldo da conta.
   - "Publica uma página com o resumo das minhas contas do mês" deve devolver um link `/a/<id>`.

### Testar sem o Grok

Com o servidor rodando, o MCP Inspector faz o mesmo fluxo OAuth no navegador:

```sh
bunx @modelcontextprotocol/inspector
```

Escolha o transporte Streamable HTTP, informe `https://parrot-fun-nicely.ngrok-free.app/api/v1/mcp` e use o fluxo de OAuth do próprio Inspector. Use o endereço do ngrok, não `localhost`: o login Google de desenvolvimento volta para o domínio do ngrok, então a sessão só existe lá.

Os testes automatizados cobrem o mesmo caminho sem rede: `tests/integration/mcp/` (OAuth e MCP) e `tests/contracts/mcp/`.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| A página diz que o aplicativo não está registrado | O banco foi recriado depois que o Grok se registrou. Remova o conector e adicione de novo. |
| A página diz que o endereço de retorno não está registrado | O Grok mudou o `redirect_uri`. Remova e adicione o conector de novo. |
| Depois do login Google você cai no `/chat` em vez do consentimento | O login foi feito em outro domínio (por exemplo `localhost` em vez do ngrok). Abra o fluxo pelo mesmo endereço que o conector usa. |
| As ferramentas respondem `UnauthorizedException` ou o Grok pede login de novo | O refresh token expirou (30 dias), foi reutilizado (o The Chatbot revoga a conexão inteira) ou o banco foi limpo. Reconecte o conector. |
| `add_transaction` falha com telefone ausente | As ferramentas da planilha precisam do telefone do usuário cadastrado no app. |

## Fora deste escopo

Ficaram para depois: sincronizar o histórico do Grok com o The Chatbot; WhatsApp assíncrono e templates; webhooks do The Chatbot para o Grok; as operações do bot dedicado de chats (`chat_history`, `chat_search`, `chat_status`, `chat_ask`, `chat_set_model`, `chat_set_effort`, `chat_compact`, `chat_notify_whatsapp`, `chat_reset`, coluna `origin` e selo); migrar o token de artefatos (`tca_`) para o OAuth; empacotar como plugin; CIMD, escopos por domínio, tela de conexões com revogação, rate limit, limpeza de códigos e tokens expirados, chave de idempotência, `update_monthly_expense`, `archive_monthly_expense` e o dashboard.
