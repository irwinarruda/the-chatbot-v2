# Plan 018: Runtime AI Providers and `/model`

## Goal

Make the AI runtime provider-independent. A user can persistently switch between
configured Pi models with `/model`, while credentials live encrypted in PostgreSQL
and are refreshed on demand without a background worker.

The first proven providers are:

- `zai-coding-cn/glm-5.2` using the Z.ai Coding Plan;
- `openai-codex/gpt-5.6-sol` using the ChatGPT Codex plan.

Provider registration stays administrative for now: credentials are inserted by a
safe import/login command, never through chat.

## Context

The current gateway creates one Pi model at startup from `AI_PROVIDER`,
`AI_API_KEY`, and `AI_MODEL`. That makes the model a process-level choice and passes
an explicit API key on every request. Explicit keys bypass Pi's credential store,
so this shape cannot support database credentials or Codex OAuth refresh.

The new model is user-scoped:

- credentials belong to a user and provider;
- one provider/model preference belongs to a user and applies across their chats;
- `/effort` remains chat-scoped;
- every AI turn resolves one immutable runtime selection and reuses it for context
  budgeting, compaction, tool rounds, summaries, and the final generation;
- existing generation rows keep their original provider/model, so mixed-provider
  history remains replayable.

`AI_PROVIDER`, `AI_MODEL`, and optional `AI_API_KEY` remain the bootstrap default
when the user has no database preference or credential. A broken stored credential
is an error, never a reason to silently fall back to another billing source.

Pi already implements Codex OAuth refresh. The application only needs a durable
Pi `CredentialStore.modify()` implementation with a cross-process database lock;
no worker, timer, MacBook process, or separate refresh thread is required.

## Steps

1. **Persist runtime configuration**
   - Add `ai_provider_credentials`, keyed by user and provider, with an encrypted
     Pi credential envelope and credential type metadata.
   - Add `ai_model_preferences`, keyed by user, with provider/model and timestamps.
   - Keep the migration additive and preserve every existing user, chat, message,
     generation, and Google credential row.

2. **Implement the Pi credential boundary**
   - Encrypt the complete validated Pi credential with AES-256-GCM.
   - Bind ciphertext to user/provider using associated data.
   - Implement `read`, `list`, `modify`, and `delete` against PostgreSQL.
   - Serialize `modify` with a transaction-scoped PostgreSQL advisory lock so two
     serverless requests cannot refresh the same OAuth credential concurrently.
   - Remove explicit `apiKey` arguments from Pi requests.

3. **Implement model selection**
   - Add a service that resolves the user's stored preference or environment
     default, validates the provider/model against Pi's installed catalog, and
     lists only providers backed by an available credential.
   - Resolve the selection once per user turn and pass it explicitly through every
     chat gateway operation.
   - Make supported reasoning effort and context limits selection-specific.

4. **Add `/model` as a server command**
   - `/model` reports the active model and configured choices.
   - `/model <provider>/<model>` validates and persists a new user preference.
   - Command messages and replies are durable channel-only messages and never enter
     model context or create an AI generation.
   - If the current chat effort is unsupported by the new model, reset it to `off`
     in the same transaction and say so in the confirmation.
   - Add English and Brazilian Portuguese status, success, and invalid templates.

5. **Add safe administration and environment migration**
   - Add an administrative credential import/login script that reads canonical
     Pi/Codex files directly, validates their shape, and writes only encrypted data
     to PostgreSQL without printing tokens.
   - Import `zai-coding-cn` from `~/.pi` and map current `~/.codex` OAuth fields to
     Pi's `openai-codex` credential shape for local proof.
   - Add one idempotent environment migration script covering `.env`,
     `.env.development`, `.env.test`, `.env.preview`, and `.env.production`. It must
     transform only an explicit key allowlist, preserve values byte-for-byte,
     preserve permissions, support `--check`, and never print secret values.

6. **Verify the system**
   - Unit-test command parsing, selection, catalog validation, and error semantics.
   - Integration-test migration round trips, encryption, preference persistence,
     controlled environment fallback, and concurrent OAuth `modify` locking.
   - Run format/lint, typecheck, focused tests, then the full suite.
   - With the local PostgreSQL database and in-app Codex browser, import both real
     credentials, switch to Z.ai, complete a turn, switch to Codex, recall context
     from the Z.ai turn, switch back, reload, and verify persistence.
   - Verify `ai_generations.provider/model` and credential metadata only; never
     select, log, screenshot, or print encrypted/token fields.

## Risks

- **Refresh-token ownership:** copying the same Codex refresh token into two stores
  can make one stale after rotation. Local proof may use the current access token;
  durable production setup should perform a dedicated Pi OAuth login whose refresh
  token is owned by this application.
- **Concurrent refresh:** row locks do not protect an absent row. Use a stable
  advisory-lock key before the read/refresh/write cycle and hold it until commit.
- **Provider drift inside a turn:** resolving the preference repeatedly could mix
  providers across tool rounds. Carry one immutable runtime selection for the
  entire turn.
- **Silent billing fallback:** never fall back after a stored credential is chosen
  but fails to decrypt, validate, or refresh.
- **Secret exposure:** scripts may use credential and environment files but must not
  print, interpolate into shell arguments, or expose their values in test output.
- **OAuth error leakage:** translate provider errors to application-safe messages;
  do not log raw token endpoint response bodies.

## Validation

Completion means all of the following are observed, not inferred:

- old data survives migration up/down round-trip checks;
- `/model` itself produces no provider request or generation row;
- invalid/unconfigured choices do not change the preference;
- selection persists across reloads and chats for the user;
- effort choices and resets match the selected model;
- Z.ai and OpenAI Codex each complete a real local turn using their coding-plan
  credentials;
- history from one provider is understood after switching to the other;
- a credential can be inserted while the server runs and appears without restart;
- concurrent refresh is serialized and persists the winner once;
- the browser shows no failed requests, console errors, layout overflow, or stuck
  streaming state;
- no secret value appears in commands, logs, diffs, screenshots, or the final
  report.
