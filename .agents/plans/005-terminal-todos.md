# Plan 005: Terminal Todos

## Problem

The web chat already has Google-authenticated access and supports text/audio
messages through the same conversation pipeline as WhatsApp. Users can ask the
assistant to manage financial data, but there is no first-class todo domain, no
todo CRUD API, and no authenticated web page where users can review or manage
tasks extracted from chat.

The desired feature is an authenticated terminal-style todo page with search,
due date, and status filtering. The assistant must also be able to create one
or many todos from natural-language messages, including audio transcriptions,
while binding the created todos back to the source user message when applicable.

## Goal

Add a Todo domain to the server and expose it on the web client.

The system should:

1. Restrict the Todo page and Todo APIs to users authenticated by the existing
   Google web chat flow.
2. Persist todos with:
   - `id`
   - `name`
   - `description`
   - nullable `dueDate`
   - `status`
   - optional source user message relationship
   - ownership by authenticated user
3. Support todo statuses as a programming enum:
   - `Pending`
   - `Completed`
4. Expose basic CRUD APIs for the authenticated user's todos.
5. Build a beautiful terminal-vibe web page at `/todo`.
6. Make it easy to navigate between `/chat` and `/todo`.
7. Support search, due-date, no-due-date, and status filters.
8. Open a todo detail modal when the user clicks a todo.
9. Deep-link directly to the modal with `/todo/{id}`.
10. Let the LLM create one or multiple todos from one message or recent chat
   context.
11. Let the LLM decide whether a todo needs a description or whether the name is
    enough.
12. Bind audio-created todos to the source `Message` so the frontend can render
    that message's audio box and transcription for review.

## Non-Goals

- No frontend audio upload/editing for todos in the first version.
- No custom reminder notifications.
- No recurring todos.
- No todo sharing between users.
- No route/controller tests in the default Vitest suite, per repository rules.
- No new Google authentication mechanism. Reuse the existing web chat auth
  cookie.

## Current Architecture Findings

The repo follows the Controller -> Service -> Entity pattern:

- Entities live in `src/shared/entities/`.
- Services live in `src/server/services/` and own direct SQL persistence.
- TanStack API controllers live in `src/server/tanstack/controllers/`.
- Production DI lives in `infra/bootstrap.ts`.
- Route registration lives in `src/server/tanstack/index.ts`.
- Client route components live in `src/client/routes/`.
- Client state is one Zustand store composed from slices in
  `src/client/stores/`.
- Client data access is service-based, following `webChatService`.

The existing web Google authentication flow is already the correct access
boundary:

```
GET /api/v1/web/auth/login
  -> Google OAuth web redirect
  -> AuthService.handleWebGoogleRedirect()
  -> JWT signed with { userId, email, phoneNumber }
  -> HttpOnly cookie web_auth_token
```

Authenticated API routes receive `context.webAuth` from
`src/server/tanstack/middleware/auth.ts`. Authenticated pages should use the
renamed `requireWebAccess()` helper in `beforeLoad`.

The LLM tool architecture is centralized in:

- `src/server/resources/ai-chat-tools.ts`
- `src/server/resources/AiChatGateway.ts`

Audio transcription is already handled before the main LLM response continues:

```
Audio message
  -> download media
  -> upload permanent URL
  -> transcribe
  -> message.addAudioTranscriptAndUrl(transcript, permanentUrl)
  -> saveMessage(message)
  -> parseMessagesToAi() uses transcript as user text
```

That means todo creation from audio can use the existing LLM flow if the tool is
given the right source metadata.

## Architecture Overview

```
Authenticated browser
  -> /todo
    -> beforeLoad requireWebAccess()
    -> todoSlice.bootstrapTodos()
    -> GET /api/v1/web/todos
      -> authMiddleware injects context.webAuth
      -> TodoService.listTodos(context.webAuth.userId, filters)

Click todo row
  -> navigate /todo/{id}
    -> parent Todo page remains visible
    -> Todo detail modal opens
    -> GET /api/v1/web/todos/{id}

Chat message: "add buy milk and call Ana tomorrow"
  -> MessagingService.respondToMessage()
  -> AiChatGateway.getResponse()
  -> create_todos tool call
  -> TodoService.createTodos({ idUser, todos, idSourceMessage? })
```

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Ownership | Store `id_user` on `todos` | API access should be scoped by authenticated user, not phone number from the client |
| Auth | Reuse `web_auth_token` and rename `requireChatAccess` to `requireWebAccess` | The helper validates generic web access, not chat-specific access |
| API namespace | `/api/v1/web/todos` | Matches existing `/api/v1/web/messages` and protected web API style |
| Page URL | `/todo` and `/todo/{todoId}` | Matches requested deep-link behavior |
| Status enum | `TodoStatus.Pending = "Pending"`, `TodoStatus.Completed = "Completed"` | Enum values must be PascalCase too, matching their keys |
| Frontend CRUD audio | Exclude source-message selection from create/update forms for now | User explicitly said frontend CRUD should not have audio for now |
| Backend audio fields | Do not duplicate `audio_url` or `transcript` on `todos`; store `id_source_message` | Message already owns audio media/transcript; duplicating it would create drift |
| Source binding | Nullable `todos.id_source_message -> messages.id` | Lets any todo point to the user message that produced it, including audio messages |
| LLM creation tool | Prefer `create_todos` with an array payload | Lets the model create multiple todos in one tool call instead of forcing repeated calls |
| Tool-call count | Allow both repeated calls and multi-item call | The model may call the tool once with many todos or multiple times if context demands it |
| Modal primitive | Add one small reusable `Dialog` UI primitive | No existing modal pattern exists; todo details need a focused overlay |
| Chat/Todo navigation | Add clear first-class links between `/chat` and `/todo` | Todos are part of the chat workflow; users need a fast way to move between conversational task capture and visual task review |
| Filtering | URL search params `q`, `dueDate`, `due`, `status` plus server-side filtering | Enables shareable filtered views and clearly separates dated and undated todos |
| Tests | Entity/service tests only | Repo rules disallow route/controller/gateway tests in default suite |

## Data Model

### Todo Status Enum

Add `src/shared/entities/enums/TodoStatus.ts`:

```typescript
import type { ValueOf } from "~/shared/entities/Status";

export const TodoStatus = {
  Pending: "Pending",
  Completed: "Completed",
} as const;
export type TodoStatus = ValueOf<typeof TodoStatus>;
```

Use a validation helper in the entity or service to reject unsupported status
values from API/tool input. Do not serialize Todo enum values as lowercase
strings; database, API, tool, and client values should use `Pending` and
`Completed`.

### Todo Entity

Add `src/shared/entities/Todo.ts`:

```typescript
export interface TodoConfig {
  id?: string;
  idUser: string;
  idSourceMessage?: string;
  name: string;
  description?: string;
  dueDate?: Date;
  status?: TodoStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Todo {
  id: string;
  idUser: string;
  idSourceMessage?: string;
  name: string;
  description: string;
  dueDate?: Date;
  status: TodoStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

Recommended entity behavior:

- Constructor validates:
  - `idUser` is present.
  - `name.trim()` is present and <= 160 chars.
  - `description` is normalized to `""` when absent.
  - `dueDate` is either absent or a valid date.
  - `status` is one of `TodoStatus`.
- Methods:
  - `rename(name: string)`
  - `updateDescription(description: string)`
  - `reschedule(dueDate?: Date)`
  - `updateStatus(status: TodoStatus)`
  - `bindSourceMessage(idSourceMessage: string)`
  - `toJSON()` returning snake_case-compatible shared web shape if existing
    client wire style is preferred.

Keep helper extraction minimal. Inline one-off validation in the class unless
the same logic is reused more than once.

### Migration

Create with the repo command:

```bash
bun run migrate:create -- create-todos
```

Expected migration shape:

```sql
CREATE TABLE todos (
  id UUID PRIMARY KEY,
  id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id_source_message UUID REFERENCES messages(id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX todos_id_user_idx ON todos (id_user);
CREATE INDEX todos_id_source_message_idx ON todos (id_source_message);
CREATE INDEX todos_id_user_due_date_idx ON todos (id_user, due_date);
CREATE INDEX todos_id_user_status_idx ON todos (id_user, status);
```

Do not rely on database defaults for entity-created fields if existing service
patterns insert explicit IDs/timestamps.

## Backend Design

### TodoService

Add `src/server/services/TodoService.ts`.

DTOs:

```typescript
export interface TodoFiltersDTO {
  search?: string;
  dueDate?: Date;
  due?: "all" | "with_due_date" | "without_due_date";
  status?: TodoStatus;
}

export interface CreateTodoDTO {
  idUser: string;
  idSourceMessage?: string;
  name: string;
  description?: string;
  dueDate?: Date;
  status?: TodoStatus;
}

export interface UpdateTodoDTO {
  idUser: string;
  id: string;
  name?: string;
  description?: string;
  dueDate?: Date | null;
  status?: TodoStatus;
}
```

Methods:

```typescript
async listTodos(idUser: string, filters: TodoFiltersDTO): Promise<Todo[]>
async getTodoById(idUser: string, id: string): Promise<Todo>
async createTodo(dto: CreateTodoDTO): Promise<Todo>
async createTodos(dtos: CreateTodoDTO[]): Promise<Todo[]>
async updateTodo(dto: UpdateTodoDTO): Promise<Todo>
async deleteTodo(idUser: string, id: string): Promise<void>
```

Persistence rules:

- Every query filters by `id_user`.
- `getTodoById`, `updateTodo`, and `deleteTodo` throw `NotFoundException` when
  the todo is not owned by the authenticated user.
- When a todo has `id_source_message`, list/read responses should include a
  minimal source message projection so the frontend can render audio/transcript
  without duplicating media fields on `Todo`.
- The `Todo` entity can keep only `idSourceMessage`; API response composition
  can return `Todo` plus `sourceMessage` view data.
- `createTodos` should insert todos one-by-one or with a single SQL statement.
  One-by-one is acceptable for the first version because it keeps validation and
  entity creation straightforward.
- `updateTodo` loads the existing todo first, applies only present fields, and
  saves the updated row.
- `deleteTodo` is a hard delete.

Filtering rules:

- `search` matches `name` and `description`, case-insensitive.
- `dueDate` filters todos due on the user's selected local day. The first
  implementation can use server date boundaries for the supplied ISO date; if
  exact user timezone filtering matters later, add a timezone field to the
  request.
- `due = "with_due_date"` returns only todos that have `due_date`.
- `due = "without_due_date"` returns only todos with no due date.
- `due = "all"` or omitted returns both groups.
- `status` filters exact enum values.
- Default list ordering: incomplete first, then todos with due dates ordered by
  earliest due date, then undated todos ordered by created time.

### DI

Update `infra/bootstrap.ts`:

```typescript
container.register(
  "TodoService",
  () => new TodoService(database),
  "singleton",
);
```

Then update `AiChatGateway` registration to receive `TodoService`.

Tests may require matching test DI updates in `tests/orquestrator.ts`.

### Web API Controllers

Add:

- `src/server/tanstack/controllers/web-todos.ts`
- `src/server/tanstack/controllers/web-todo.ts`

Recommended routes:

- `GET /api/v1/web/todos`
- `POST /api/v1/web/todos`
- `GET /api/v1/web/todos/{todoId}`
- `PATCH /api/v1/web/todos/{todoId}`
- `DELETE /api/v1/web/todos/{todoId}`

Controller responsibilities:

- Read `context.webAuth.userId`.
- Parse request body or search params.
- Convert `dueDate` strings to `Date` and preserve missing due dates as
  `undefined` or `null` depending on create/update semantics.
- Delegate to `TodoService`.
- Return `Http.json(...)` or `Http.ok()`.

Do not put filtering, ownership rules, or persistence details in controllers.

Update `src/server/tanstack/middleware/auth.ts`:

```typescript
const PROTECTED_WEB_API_PATHS = new Set([
  ...
  "/api/v1/web/todos",
]);
```

Because item routes include dynamic IDs, the current exact-match Set is not
enough for `/api/v1/web/todos/{todoId}`. Replace the exact check with a helper:

```typescript
function isProtectedWebApiPath(pathname: string): boolean {
  return (
    PROTECTED_WEB_API_PATHS.has(pathname) ||
    pathname.startsWith("/api/v1/web/todos/")
  );
}
```

Then use that helper in the middleware.

Update `src/server/tanstack/index.ts` to register:

```typescript
route("/todo", [
  index("client/routes/todo/index.tsx"),
  route("/$todoId", "client/routes/todo/$todoId.tsx"),
]),
route("/api/v1/web/todos", "server/tanstack/controllers/web-todos.ts"),
route(
  "/api/v1/web/todos/$todoId",
  "server/tanstack/controllers/web-todo.ts",
),
```

If TanStack route path parameters require a different filename convention in
this virtual route setup, mirror the existing generator's expected syntax.

## LLM Tool Design

### AiChatGateway Constructor

Update `src/server/resources/AiChatGateway.ts` to accept `TodoService`:

```typescript
constructor(
  private config: AiConfig,
  private cashFlowService: CashFlowService,
  private authService: AuthService,
  private todoService: TodoService,
) {}
```

Pass it into `executeTool(...)` for both OpenAI and Anthropic branches.

### ToolDefinition Type

The current `ToolDefinition` type only supports shallow property metadata. A
todo array requires richer JSON Schema. Broaden it in
`src/server/resources/ai-chat-tools.ts`:

```typescript
type ToolParameterSchema = {
  type: string;
  description?: string;
  nullable?: boolean;
  enum?: string[];
  items?: ToolParameterSchema;
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
};
```

Then set:

```typescript
properties: Record<string, ToolParameterSchema>;
```

This keeps existing tool definitions valid while allowing arrays of objects.

### create_todos Tool

Add to `toolDefinitions`:

```typescript
{
  name: "create_todos",
  description:
    "Create one or more todos for the authenticated user. Use this when the user asks to remember, note, add a task, create todos, or when an audio transcript contains tasks. Decide whether each todo needs a description based on the amount of detail. If the title is enough, keep description empty. Returns { message, todos }. " + genericError,
  parameters: {
    type: "object",
    properties: {
      phone_number: {
        type: "string",
        description: "User phone number in E.164 format",
      },
      todos: {
        type: "array",
        description: "Todos extracted from the user message or recent context",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Short actionable todo title",
            },
            description: {
              type: "string",
              description:
                "Optional detail. Leave empty when the title captures the whole request",
            },
            dueDate: {
              type: "string",
              nullable: true,
              description:
                "Optional ISO-8601 due date. Use null/omit when the user does not provide a due date",
            },
            status: {
              type: "string",
              enum: ["Pending", "Completed"],
              description: "Initial todo status, normally Pending",
            },
          },
          required: ["name", "status"],
        },
      },
    },
    required: ["phone_number", "todos"],
  },
}
```

Add an `executeTool` case:

1. Resolve the user by `phone_number` through `AuthService.getUserByPhoneNumber`.
2. Reject if user is missing.
3. If `context.sourceMessageId` was passed into the tool executor, set
   `idSourceMessage` on each created todo.
4. Create all todos through `TodoService.createTodos`.
5. Return the created todos.

### Gateway Context and Source Message Binding

The current tool path does not pass request-specific metadata into
`executeTool`; it only passes tool args plus services. Avoid adding a
single-purpose `sourceMessage?: Message` parameter to `getResponse`. Instead,
add a generic context object that can carry any execution metadata needed by
current or future LLM tools.

For this feature, the LLM does **not** need the full source `Message` in
context. The message content is already present in `AiChatMessage[]`, including
audio transcript text after transcription. The context should carry only the
stable metadata the LLM/tool flow cannot infer safely: `sourceMessageId`.

Preferred path:

1. Add a generic optional context type near `IAiChatGateway`:

   ```typescript
   export type AiChatContext = Record<string, unknown>;
   ```

   This intentionally does not model every possible field. Tool implementations
   should narrow the fields they care about at runtime.

2. Add optional context to `IAiChatGateway.getResponse`:

   ```typescript
   getResponse(
     phoneNumber: string,
     messages: AiChatMessage[],
     allowTools?: boolean,
     context?: AiChatContext,
   ): Promise<AiChatResponse>
   ```

3. In `MessagingService.respondToMessage`, call:

   ```typescript
   this.aiChatGateway.getResponse(
     chat.phoneNumber,
     aiMessages,
     true,
     { sourceMessageId: message.id },
   );
   ```

4. Pass the same `context` into `executeTool` from both OpenAI and Anthropic
   tool loops.
5. In the `create_todos` case, safely narrow `context.sourceMessageId` before
   using it:

   ```typescript
   const sourceMessageId =
     typeof context?.sourceMessageId === "string"
       ? context.sourceMessageId
       : undefined;
   ```

   If `sourceMessageId` exists, bind it to each created todo as
   `idSourceMessage`. The todo detail API can later resolve the message's
   `mediaUrl`, `mimeType`, and `transcript` when rendering review context.

Alternative path:

- Let the model pass `source_message_id`. This is more brittle because the LLM
  needs to know and preserve internal message IDs in context.

Use the preferred path. It keeps audio binding deterministic, avoids passing
full domain entities through the gateway, and gives future tools a generic
place for additional execution metadata without changing the gateway method
signature again.

### Prompt Updates

Update:

- `templates/prompts/ai-chat-gateway.pt-BR.md`
- `templates/prompts/ai-chat-gateway.en.md`

Add instructions:

- When the user asks to create reminders, tasks, notes to do later, or says
  things like "anota", "lembra", "cria uma tarefa", use `create_todos`.
- A single message may contain multiple todos. Extract each actionable item.
- Prefer one `create_todos` call with multiple todo objects, but multiple tool
  calls are acceptable when context is clearer that way.
- Use a short imperative `name`.
- Add `description` only when extra details would be lost from the name.
- Set `dueDate` only when the user explicitly gives or clearly implies a due
  date. Do not invent today's date for undated tasks.
- If the message came from audio transcription, create the todos normally; the
  system will bind them to the source user message.
- Do not create todos for casual conversation unless the user intent is clear.

## Frontend Design

### Client Domain and Service

Add `src/client/entities/Todo.ts`:

```typescript
import type { ChatMessage } from "~/client/entities/ChatMessage";

export type TodoStatus = "Pending" | "Completed";

export interface Todo {
  id: string;
  sourceMessage?: ChatMessage;
  name: string;
  description: string;
  dueDate?: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
}
```

Add `src/client/services/todoService.ts` following `webChatService`:

- Wire types use snake_case:
  - `due_date`
  - `source_message`
  - `media_url`
  - `mime_type`
  - `created_at`
  - `updated_at`
- `parseTodo` maps wire data into client data.
- `source_message` should be parsed with the same mapping rules as
  `webChatService.parseChatMessage` so the client does not duplicate a second
  message model. If needed, extract the chat-message parser into a shared client
  helper used by both `webChatService` and `todoService`.
- Methods:
  - `listTodos(filters)`
  - `getTodo(id)`
  - `createTodo(dto)`
  - `updateTodo(id, dto)`
  - `deleteTodo(id)`

Frontend create/update DTOs should intentionally omit `sourceMessage`.

### Zustand Slice

Add `src/client/stores/slices/todoSlice.ts`.

State:

```typescript
todos: Todo[];
selectedTodo?: Todo;
todoFilters: {
  q: string;
  dueDate: string;
  due: "all" | "with_due_date" | "without_due_date";
  status: "all" | TodoStatus;
};
todoDraft: {
  name: string;
  description: string;
  dueDate: string;
  status: TodoStatus;
};
isTodoBootstrapping: boolean;
isTodoSubmitting: boolean;
todoError?: "loading" | "saving" | "deleting";
```

Computed state:

- `hasTodos`
- `pendingTodoCount`
- `completedTodoCount`
- `canSaveTodoDraft`

Actions:

- `bootstrapTodos(filters)`
- `setTodoFilters(filters)`
- `setTodoDraft(patch)`
- `resetTodoDraft()`
- `createTodoFromDraft()`
- `loadTodo(id)`
- `updateTodo(id, patch)`
- `deleteTodo(id)`
- `clearTodoError()`

Follow the repository rule for Zustand stores: never use `get().someVariable`;
destructure values from `get()` first.

Update `src/client/stores/index.ts` to include the slice in `AppSlices`.

### Routes

Add:

- `src/client/routes/todo/index.tsx`
- `src/client/routes/todo/$todoId.tsx`

Both should use:

```typescript
beforeLoad: async () => {
  const authResult = await requireWebAccess();
  if (!authResult.ok) {
    throw redirect({ to: "/chat/login" });
  }
}
```

`/todo` responsibilities:

- Validate search params:
  - `q?: string`
  - `dueDate?: string`
  - `due?: "all" | "with_due_date" | "without_due_date"`
  - `status?: "all" | "Pending" | "Completed"`
- Bootstrap todos on mount and when filters change.
- Render the list, filters, and create form.

`/todo/{todoId}` responsibilities:

- Render the same page context with a modal opened.
- Load selected todo by route param if not already available.
- Close modal by navigating to `/todo` while preserving search params.

If nested route rendering requires a parent `src/client/routes/todo.tsx` with an
`Outlet`, add it and move the shared page shell there. The important behavior is
that `/todo/{id}` shows the list page with a modal, not a separate blank detail
page.

### Terminal UI

Use existing components:

- `TerminalWindow`
- `TerminalPageHeader`
- `TerminalPanel`
- `TerminalStatusBadge`
- `Input`
- `Textarea`
- `Button`
- `NativeSelect`

Add only focused new components if needed:

- `src/client/components/ui/dialog.tsx`
- `src/client/components/TodoRow.tsx`
- `src/client/components/TodoDetailDialog.tsx`
- `src/client/components/TodoFilters.tsx`
- `src/client/components/TodoComposer.tsx`

Visual direction:

- Full-page terminal window, preferably wider than the default chatless pages.
- Add a first-class navigation affordance between chat and todos:
  - `/chat` should expose a visible Todo action in the terminal chrome or chat
    toolbar.
  - `/todo` should expose a visible Chat action in the terminal chrome or page
    header.
  - Use icon+text buttons for these cross-page commands, such as `MessageSquare`
    for Chat and `ListTodo` for Todos.
  - Preserve auth behavior: unauthenticated navigation to either page redirects
    to `/chat/login`.
- Dense command-center toolbar:
  - search input with `Search` icon
  - status select
  - due-date input
  - due-date presence select: all, with due date, without due date
  - clear filters button
- Todo rows styled like terminal log lines:
  - leading prompt marker, e.g. `>_`
  - amber due date when present
  - explicit muted `no due date` label when absent
  - green Completed status
  - amber Pending status
  - muted metadata
  - subtle left border that brightens on hover
- Create form should feel like a terminal command input, not a marketing card.
- Use lucide icons for actions:
  - `Search`
  - `Calendar`
  - `CheckCircle2`
  - `Circle`
  - `Plus`
  - `Trash2`
  - `X`
  - `Volume2` when audio exists
- Avoid nested cards. Use panels/bands and list rows.

Modal behavior:

- Opens for `/todo/{id}` and on row click.
- Shows:
  - name
  - description
  - due date, or a clear `no due date` state
  - status toggle
  - source message metadata if present
  - audio player if `sourceMessage.mediaUrl` exists
  - transcript if `sourceMessage.transcript` exists
  - edit/save/delete actions
- Frontend editing should not expose audio URL fields.
- Close on overlay click, escape, and explicit close button.

### Internationalization

The chat UI uses `src/client/i18n/en.json` and `pt-BR.json`. Add todo strings
there instead of hardcoding user-facing copy inside components.

Suggested keys:

- `todoPage.windowTitle`
- `todoPage.heading`
- `todoPage.subtitle`
- `todoPage.searchPlaceholder`
- `todoPage.statusAll`
- `todoPage.statusPending`
- `todoPage.statusCompleted`
- `todoPage.dueAll`
- `todoPage.dueWithDueDate`
- `todoPage.dueWithoutDueDate`
- `todoPage.noDueDate`
- `todoPage.createNamePlaceholder`
- `todoPage.createDescriptionPlaceholder`
- `todoPage.emptyState`
- `todoPage.audioLabel`
- `todoPage.transcriptLabel`
- `todoPage.errorLoading`
- `todoPage.errorSaving`
- `todoPage.errorDeleting`

## API Contract

### List Todos

Use `dueDate` for a specific due date and `due` for due-date presence:

- `due=all`
- `due=with_due_date`
- `due=without_due_date`

Final endpoint shape:

`GET /api/v1/web/todos?q=&dueDate=&due=&status=`

Response:

```json
{
  "todos": [
    {
      "id": "uuid",
      "name": "Buy milk",
      "description": "",
      "due_date": "2026-05-17T00:00:00.000Z",
      "status": "Pending",
      "source_message": null,
      "created_at": "2026-05-17T12:00:00.000Z",
      "updated_at": "2026-05-17T12:00:00.000Z"
    }
  ]
}
```

When a todo is bound to a source message, `source_message` is populated:

```json
{
  "source_message": {
    "id": "message-uuid",
    "type": "audio",
    "text": null,
    "media_url": "https://cdn.example/audio.webm",
    "mime_type": "audio/webm",
    "transcript": "Buy milk and call Ana tomorrow",
    "created_at": "2026-05-17T11:59:00.000Z"
  }
}
```

### Create Todo

`POST /api/v1/web/todos`

Request:

```json
{
  "name": "Buy milk",
  "description": "",
  "due_date": null,
  "status": "Pending"
}
```

Response:

```json
{
  "todo": {
    "id": "uuid",
    "name": "Buy milk",
    "description": "",
    "due_date": null,
    "status": "Pending",
    "source_message": null,
    "created_at": "2026-05-17T12:00:00.000Z",
    "updated_at": "2026-05-17T12:00:00.000Z"
  }
}
```

### Read Todo

`GET /api/v1/web/todos/{todoId}`

Response:

```json
{ "todo": { "...": "..." } }
```

### Update Todo

`PATCH /api/v1/web/todos/{todoId}`

Request:

```json
{
  "name": "Buy milk and bread",
  "description": "Stop by the market after work",
  "due_date": "2026-05-18T00:00:00.000Z",
  "status": "Completed"
}
```

Response:

```json
{ "todo": { "...": "..." } }
```

### Delete Todo

`DELETE /api/v1/web/todos/{todoId}`

Response: `200 OK`

## Implementation Steps

### Phase 1: Backend Domain and Persistence

1. Create `TodoStatus`.
2. Create `Todo` entity.
3. Generate and implement `create-todos` migration.
4. Add `TodoService`.
5. Register `TodoService` in `infra/bootstrap.ts`.
6. Update test DI in `tests/orquestrator.ts`.
7. Add `TodoService` tests covering:
   - create one todo
   - create multiple todos
   - list scoped by user
   - filter by search/dueDate/due/status
   - update fields
   - reject unsupported status
   - reject access to another user's todo
   - delete todo

### Phase 2: Web APIs

1. Rename `require-chat-access.ts` / `requireChatAccess` to
   `require-web-access.ts` / `requireWebAccess`, and update existing chat route
   imports without changing behavior.
2. Add `web-todos.ts` collection controller.
3. Add `web-todo.ts` item controller.
4. Add protected API path matching for todo routes.
5. Register API routes in `src/server/tanstack/index.ts`.
6. Manually verify with authenticated browser requests after the frontend page
   exists.

### Phase 3: LLM Tooling

1. Broaden `ToolDefinition` schema typing.
2. Inject `TodoService` into `AiChatGateway`.
3. Pass `TodoService` into `executeTool`.
4. Add `create_todos` tool definition.
5. Add `executeTool("create_todos")`.
6. Add deterministic source-message context for audio binding.
7. Update prompts in English and Portuguese.
8. Add service/tool-focused tests where practical:
   - tool creates multiple todos
   - tool binds created todos to the source message
   - tool leaves description empty when omitted

### Phase 4: Client Data Layer

1. Add client `Todo` entity type.
2. Add `todoService`.
3. Add `todoSlice`.
4. Register `todoSlice` in the app store.
5. Add i18n strings.

### Phase 5: Todo Page UI

1. Add `/todo` route with `requireWebAccess` guard.
2. Add `/todo/{todoId}` route for modal deep links.
3. Add filters wired to URL search params.
4. Add create form.
5. Add list rows with status/due-date/search-friendly layout, including a clear
   undated state.
6. Add detail modal with edit/status/delete actions.
7. Add an obvious Chat link/action from the Todo page.
8. Add an obvious Todo link/action from the Chat page.
9. Add audio player and transcript display in modal when data exists.
10. Verify desktop and mobile layout in browser.

### Phase 6: Verification

Run:

```bash
bun run typecheck
bun run check
bun run test
```

For visual verification:

```bash
bun run dev
```

Then check:

- `/todo` redirects to `/chat/login` when unauthenticated.
- `/todo` loads for authenticated users.
- Users can navigate from `/chat` to `/todo` without manually typing the URL.
- Users can navigate from `/todo` back to `/chat` without manually typing the
  URL.
- Filters update the URL and reload results.
- `due=without_due_date` shows only todos with no due date.
- Todos with no due date are visually distinct from overdue or dated todos.
- Clicking a todo opens `/todo/{id}` modal.
- Directly opening `/todo/{id}` opens the modal.
- Creating/editing/completing/deleting todos works.
- Audio-created todo shows source message audio player and transcript in the
  modal.

## Edge Cases

- Unauthenticated API calls return `401`.
- Authenticated user cannot access another user's todo by ID.
- Empty search behaves like no search.
- Invalid `status` returns validation error.
- Invalid `dueDate` returns validation error.
- Todo with empty description renders without awkward spacing.
- Todo with long name wraps without breaking row layout.
- Deleted todo deep link returns not found and closes or shows a useful error.
- LLM-created todo without an explicit or clearly implied due date should have
  `dueDate = null`.
- LLM-created audio todo should keep the source message binding even if
  transcript processing is missing or delayed.

## Open Questions

1. Should a completed todo eventually get a separate completion timestamp? This
   plan keeps only the requested `dueDate` and `status`.
2. Should the list default to all todos or only pending todos? This plan defaults
   to all, sorted with pending first.
3. Should `/todo/{id}` be exactly `/todo/$todoId` in TanStack route syntax or
   should the public URL be `/todos/{id}`? This plan follows the user's requested
   singular `/todo/{id}`.
