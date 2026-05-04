# Plan 003: Client Zustand and Service Layer Refactor

## Problem

The current `src/client/` code keeps most application state and side effects
inside React components. The heaviest example is `src/client/routes/chat/index.tsx`,
which owns authentication bootstrapping, message loading, SSE connection retry,
message submission, audio input discovery, audio recording, upload, optimistic
message creation, loading flags, and error handling in a single route component.

This conflicts with `architecture.instructions.md` in several ways:

- Global and application-level state is held in `useState` instead of Zustand.
- Components call `fetch` directly instead of going through typed services.
- Browser APIs such as `localStorage`, `navigator.mediaDevices`, `MediaRecorder`,
  `EventSource`, cookies, and `document.documentElement.dataset` are accessed
  directly from components instead of behind services or store actions.
- API wire response parsing lives in `src/client/utils/webChatApi.ts`, but it is
  really part of the frontend integration layer.
- There is no frontend `src/stores/`, `src/services/`, `src/entities/`, or
  `src/entities/dtos/` layer matching the required architecture.

## Goal

Refactor the client so components render and wire events while Zustand slices own
application state, orchestration, async actions, loading flags, and derived state.
Introduce a typed frontend service layer for API and browser integration. Keep
purely DOM-specific and third-party instance state local when it should not be
global.

The refactor should preserve current behavior:

- Same routes and route guards.
- Same terminal UI and translations.
- Same optimistic message behavior.
- Same SSE reconnect behavior.
- Same audio recording, upload, and transcript completion behavior.
- Same theme and locale cookie persistence.
- Same web auth endpoints.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Store location | Add frontend store at `src/stores/` | Matches `architecture.instructions.md`; client code imports `~/stores` |
| Services location | Add frontend services at `src/services/` | Matches required folder structure and keeps API/browser integration out of components |
| Entity location | Add frontend entities at `src/entities/` | Frontend domain types should be stable and not tied to server wire casing |
| DTO location | Add frontend DTOs at `src/entities/dtos/` | Store actions and services should use explicit contracts, not inline shapes |
| Store shape | One root `useApp` hook with slices | Required Zustand pattern from the architecture instructions |
| Slice split | `prefsSlice` and `chatSlice` first | These are the only current client application-state domains; avoid premature extra slices |
| Chat audio state | Keep in `chatSlice` | Audio recording is part of chat composition and submission, not a standalone app module yet |
| EventSource ownership | `webChatStreamService` creates/manages browser connection; `chatSlice` owns connection state | Browser API stays in service; app state stays in store |
| MediaRecorder ownership | `audioRecordingService` owns browser recording primitives; `chatSlice` owns status/duration/upload orchestration | Avoids storing raw `MediaRecorder` and chunks in React components |
| Optimistic messages | Created in `chatSlice` | Optimistic updates are business/UI orchestration, not rendering logic |
| Navigation | Remains in route components | Architecture explicitly keeps router usage in components/screens |
| Scroll and measurement state | Remains local in `ChatRoute` | It is DOM-specific state and is an allowed React local-state exception |
| Audio playback waveform state | Remains local in `AudioWaveform` | It is third-party instance/DOM playback state, not app state |
| Transcript expand/collapse | Remains local in `ChatMessage` | It is isolated per-message presentation state |

## Current Client Inventory

### Application State Currently in React

**File:** `src/client/routes/chat/index.tsx`

Move these to Zustand:

| Current state | Target | Why |
|---|---|---|
| `user` | `chatSlice.currentUser` | Authenticated chat user is app/session state |
| `messages` | `chatSlice.chatMessages` | Message history is core chat state |
| `input` | `chatSlice.chatInput` | Composer input participates in send/reset actions |
| `isLoading` | `chatSlice.isChatBootstrapping` | Async bootstrap loading flag |
| `isSending` | `chatSlice.isChatSubmitting` | Shared submit flag for text, button, and audio |
| `isRecording` | `chatSlice.isRecording` | Chat composer recording state |
| `recordingDuration` | `chatSlice.recordingDuration` | Recording status rendered in composer |
| `sseConnected` | `chatSlice.isChatStreamConnected` | Connection state rendered in terminal chrome |
| `audioInputOptions` | `chatSlice.audioInputOptions` | Browser device list used by composer and recording actions |
| `selectedAudioInputId` | `chatSlice.selectedAudioInputId` | Persisted device preference used across actions |
| `error` | `chatSlice.chatError` | Module-level UI error shared by async actions |

Keep these local:

| Current state/ref | Keep Local | Why |
|---|---|---|
| `inputEl` | Yes, preferably `useRef` instead of `useState` | DOM element reference for focus/height only |
| `mediaRecorderRef` | No in component; move primitive to service | Browser integration belongs in service |
| `audioChunksRef` | No in component; move primitive to service | Browser integration belongs in service |
| `recordingTimerRef` | No in component; move primitive to service or store-managed cleanup | Recording side effect belongs behind action/service |
| `shouldSendRecordingRef` | No in component; move primitive to service stop call | Recording side effect belongs behind action/service |
| `composerRef` | Yes | DOM measurement only |
| `parentRef` | Yes | Virtualizer scroll element only |
| `isNearBottomRef` | Yes | Scroll position behavior only |
| `showScrollBtn` | Yes | Scroll affordance, isolated DOM UI state |
| `composerHeight` | Yes | ResizeObserver measurement only |
| `virtualizer` | Yes | Component/DOM virtualization instance |

**File:** `src/client/components/PrefsProvider.tsx`

Move these to Zustand:

| Current state | Target | Why |
|---|---|---|
| `theme` | `prefsSlice.theme` | Used globally and persisted |
| `locale` | `prefsSlice.locale` | Used across routes and persisted |
| `toggleTheme` | `prefsSlice.toggleTheme` | App action with browser side effects |
| `toggleLocale` | `prefsSlice.toggleLocale` | App action with persistence side effects |

Delete `PrefsProvider` after all `usePrefs()` imports are replaced by `useApp()`.

**File:** `src/client/components/ChatMessage.tsx`

Keep local:

| Current state | Keep Local | Why |
|---|---|---|
| `AudioTranscript.isExpanded` | Yes | Small, isolated, per-rendered-message presentation state |

**File:** `src/client/components/AudioWaveform.tsx`

Keep local:

| Current state | Keep Local | Why |
|---|---|---|
| `container` | Yes | DOM node ref/state for WaveSurfer mount |
| `wavesurfer` | Yes | Third-party instance tied to one component |
| `duration` | Yes | Playback UI state scoped to one waveform |
| `currentTime` | Yes | Playback UI state scoped to one waveform |
| `isReady` | Yes | Playback UI state scoped to one waveform |
| `isPlaying` | Yes | Playback UI state scoped to one waveform |

## Target File Structure

Add these files:

```text
src/
  stores/
    index.ts
    slices/
      prefsSlice.ts
      chatSlice.ts
  services/
    apiService.ts
    prefsService.ts
    webChatService.ts
    webChatStreamService.ts
    audioInputService.ts
    audioRecordingService.ts
  entities/
    AudioInputOption.ts
    ChatMessage.ts
    CurrentUser.ts
    WebChatEvent.ts
    dtos/
      HydratePrefsDto.ts
      SendWebMessageDto.ts
      SendWebAudioDto.ts
      StartAudioRecordingDto.ts
  constants/
    preferredAudioMimeTypesConstants.ts
```

Remove or stop using these files after migration:

```text
src/client/components/PrefsProvider.tsx
src/client/utils/webChatApi.ts
src/client/utils/audioInputDevices.ts
src/client/utils/webAudioRecording.ts
```

If a pure helper is still useful, move it into the service file that owns it or
into a correctly named constant file. Do not keep API/browser integration in
`src/client/utils`.

## Dependency Changes

**File:** `package.json`

Add runtime dependencies:

```json
"zustand": "<latest compatible>",
"zustand-computed-state": "<latest compatible>"
```

Use Bun to install them so `bun.lock` is updated:

```bash
bun add zustand zustand-computed-state
```

## Entities and DTOs

### `src/entities/CurrentUser.ts`

Create a frontend entity matching what client screens consume:

```ts
export type CurrentUser = {
  id: string;
  name: string;
  email?: string;
  phoneNumber: string;
};
```

This replaces direct component imports of `SharedCurrentUser` where practical.
The service can still parse from server response shapes.

### `src/entities/ChatMessage.ts`

Create a frontend entity matching rendered chat message state:

```ts
export type ChatMessage = {
  id: string;
  type: "text" | "interactive" | "audio";
  userType: "user" | "bot";
  text?: string;
  buttonReply?: string;
  buttonReplyOptions?: string[];
  mediaUrl?: string;
  mimeType?: string;
  transcript?: string;
  createdAt: string;
};
```

Keep this equivalent to `SharedChatMessage` unless there is a deliberate UI
model change. Do not expose snake_case wire fields to components or slices.

### `src/entities/AudioInputOption.ts`

Move the current `AudioInputOption` interface here:

```ts
export type AudioInputOption = {
  deviceId: string;
  label: string;
};
```

### `src/entities/WebChatEvent.ts`

Create a frontend event entity for parsed SSE events:

```ts
export type WebChatEvent =
  | { type: "text"; data: { to?: string; text?: string } }
  | {
      type: "interactive_button";
      data: { to?: string; text?: string; buttons?: string[] };
    }
  | {
      type: "audio";
      data: { mediaUrl?: string; mimeType?: string; transcript?: string };
    }
  | { type: "error"; data: { text?: string } };
```

The service can keep this aligned with `src/shared/types/web-chat.ts`, but
components and stores should depend on frontend entities.

### `src/entities/dtos/HydratePrefsDto.ts`

```ts
import type { Locale } from "~/client/i18n";
import type { Theme } from "~/stores/slices/prefsSlice";

export type HydratePrefsDto = {
  locale: Locale;
  theme: Theme;
};
```

### `src/entities/dtos/SendWebMessageDto.ts`

Use an explicit union instead of inline objects:

```ts
export type SendWebMessageDto =
  | { text: string; buttonReply?: never }
  | { text?: never; buttonReply: string };
```

This maps directly to `POST /api/v1/web/messages`.

### `src/entities/dtos/SendWebAudioDto.ts`

```ts
export type SendWebAudioDto = {
  blob: Blob;
  mimeType: string;
};
```

This maps to `POST /api/v1/web/audio`.

### `src/entities/dtos/StartAudioRecordingDto.ts`

```ts
export type StartAudioRecordingDto = {
  audioInputDeviceId?: string;
};
```

This keeps the browser recording service contract explicit.

## Services

### `src/services/apiService.ts`

Create a small fetch wrapper. It should not know any UI, store, or route logic.

Responsibilities:

- Execute typed JSON requests.
- Execute command requests that return `Promise<void>`.
- Execute binary/body requests for audio upload.
- Throw or return `undefined` in a predictable way so module services can apply
  safe defaults.

Suggested shape:

```ts
export const apiService = {
  async getJson<T>(url: string): Promise<T | undefined>;
  async postJson<TBody>(url: string, body?: TBody): Promise<void>;
  async postBody(url: string, body: BodyInit, contentType: string): Promise<void>;
};
```

Error handling details:

- Catch errors inside `apiService` or inside module services, but not both with
  duplicate logs.
- Because this code uses `fetch`, log HTTP status and response text when
  available.
- Do not return raw `Response` from module services.

### `src/services/webChatService.ts`

Replace `src/client/utils/webChatApi.ts` and all direct `fetch` calls in
`src/client/routes/chat/index.tsx`.

Methods:

```ts
export const webChatService = {
  async getCurrentUser(): Promise<CurrentUser | undefined>;
  async getMessages(): Promise<ChatMessage[]>;
  async sendMessage(dto: SendWebMessageDto): Promise<void>;
  async sendAudio(dto: SendWebAudioDto): Promise<void>;
  async logout(): Promise<void>;
};
```

Endpoint mapping:

| Method | Endpoint | Safe default |
|---|---|---|
| `getCurrentUser` | `GET /api/v1/web/auth/me` | `undefined` |
| `getMessages` | `GET /api/v1/web/messages` | `[]` |
| `sendMessage` | `POST /api/v1/web/messages` | `void` |
| `sendAudio` | `POST /api/v1/web/audio` | `void` |
| `logout` | `POST /api/v1/web/auth/logout` | `void` |

Parsing details:

- Move `WireCurrentUser` and `WireChatMessage` from `WebChatApi` into this
  service as private wire types.
- Convert snake_case fields to frontend entities in private local functions.
- Preserve the existing `data.error` behavior by returning `undefined` for
  `getCurrentUser()` when the response cannot be parsed as a user.
- Do not import Zustand.
- Do not navigate.

### `src/services/webChatStreamService.ts`

Move all `EventSource` creation, JSON parsing, retry timing, and cleanup into a
service.

Suggested shape:

```ts
type SubscribeToWebChatStreamDto = {
  onOpen: () => void;
  onClose: () => void;
  onEvent: (event: WebChatEvent) => void;
  onMalformedEvent?: () => void;
  retryMs?: number;
};

export const webChatStreamService = {
  subscribe(dto: SubscribeToWebChatStreamDto): () => void;
};
```

Behavior:

- Connect to `/api/v1/web/stream`.
- Call `onOpen` when the connection opens.
- Parse `message.data` as `WebChatEvent` and call `onEvent`.
- Ignore malformed events, matching current behavior.
- On error, close the current `EventSource`, call `onClose`, and reconnect after
  `retryMs ?? 3000`.
- Return an unsubscribe function that closes the source and clears any pending
  reconnect timer.

### `src/services/audioInputService.ts`

Replace `src/client/utils/audioInputDevices.ts` and the component-level
`navigator.mediaDevices.enumerateDevices()` and `localStorage` access.

Methods:

```ts
export const audioInputService = {
  async listAudioInputs(): Promise<AudioInputOption[]>;
  resolveSelected(
    devices: AudioInputOption[],
    selectedDeviceId?: string,
  ): string;
  getStoredDeviceId(): string | undefined;
  storeDeviceId(deviceId: string): Promise<void>;
  subscribeToDeviceChanges(callback: () => void): () => void;
};
```

Behavior:

- Guard `typeof navigator === "undefined"` and missing `mediaDevices`.
- Guard `typeof window === "undefined"` before localStorage access.
- Return `[]` from `listAudioInputs()` on failure.
- Keep storage key private to the service or move it to a constant file.

### `src/services/audioRecordingService.ts`

Replace `src/client/utils/webAudioRecording.ts` and route-owned `MediaRecorder`
refs/chunks/timer state.

Suggested shape:

```ts
type StartAudioRecordingServiceDto = {
  audioInputDeviceId?: string;
  onTick: (duration: number) => void;
  onRecorded: (recording: { blob: Blob; url: string }) => Promise<void> | void;
  onEmptyRecording: () => void;
  onError: () => void;
};

export const audioRecordingService = {
  async start(dto: StartAudioRecordingServiceDto): Promise<void>;
  stop(shouldSend: boolean): void;
  isActive(): boolean;
};
```

Behavior:

- Use `navigator.mediaDevices.getUserMedia()` with optional exact device id.
- Use preferred MIME types from `preferredAudioMimeTypesConstants`.
- Own `MediaRecorder`, audio chunks, active stream, timer, and the send/cancel
  flag internally.
- Stop every media track on recorder stop.
- Create the recorded `Blob` with a valid audio MIME type.
- Create the optimistic local playback URL with `URL.createObjectURL(blob)` and
  pass it to the store through `onRecorded`.
- Call `onEmptyRecording` if the recorded blob has size `0`.
- Call `onError` on microphone or recording startup failure.
- Do not upload the blob directly; upload remains a `chatSlice` action through
  `webChatService.sendAudio()` so message state and loading flags stay together.

### `src/services/prefsService.ts`

Move cookie and DOM theme side effects out of `PrefsProvider`.

Methods:

```ts
export const prefsService = {
  applyTheme(theme: Theme): Promise<void>;
  persistTheme(theme: Theme): Promise<void>;
  persistLocale(locale: Locale): Promise<void>;
};
```

Behavior:

- Guard `typeof document === "undefined"`.
- Set `document.documentElement.dataset.theme` in `applyTheme()`.
- Preserve current cookie settings:
  `path=/;max-age=31536000;SameSite=Lax`.

## Store Root

### `src/stores/index.ts`

Create the root Zustand hook using the required pattern:

```ts
import { create, type StateCreator } from "zustand";
import { computed } from "zustand-computed-state";

import { type ChatSlice, chatSlice } from "./slices/chatSlice";
import { type PrefsSlice, prefsSlice } from "./slices/prefsSlice";

type ComputedSlice = {
  hasChatMessages: boolean;
  canSendChatInput: boolean;
  canSelectAudioInput: boolean;
};

export type AppSlices = ChatSlice & PrefsSlice & ComputedSlice;

export type AppState<T> = StateCreator<AppSlices, [], [], T>;

export const useApp = create<AppSlices>(
  computed(
    (...args) => ({
      ...prefsSlice(...args),
      ...chatSlice(...args),
    }),
    (state) => ({
      hasChatMessages: state.chatMessages.length > 0,
      canSendChatInput:
        state.chatInput.trim().length > 0 && !state.isChatSubmitting,
      canSelectAudioInput:
        state.audioInputOptions.length >= 2 &&
        !state.isChatSubmitting &&
        !state.isRecording,
    }),
  ),
);
```

Notes:

- If the installed `zustand-computed-state` version has a slightly different
  function signature, adapt the syntax while keeping computed state in the root.
- Keep derived values pure and free of translations or router logic.

## Slices

### `src/stores/slices/prefsSlice.ts`

State:

```ts
export type Theme = "light" | "dark";

export type PrefsSlice = {
  locale: Locale;
  theme: Theme;
  isPrefsHydrated: boolean;

  hydratePrefs: (dto: HydratePrefsDto) => void;
  toggleTheme: () => Promise<void>;
  toggleLocale: () => Promise<Locale>;
};
```

Behavior:

- Initial state should use safe defaults, likely `DEFAULT_LOCALE` and `"dark"`.
- `hydratePrefs(dto)` sets `locale`, `theme`, and `isPrefsHydrated: true`.
- `toggleTheme()` computes the next theme, applies it through `prefsService`,
  persists it, then updates store state.
- `toggleLocale()` computes the next locale, persists it, updates store state,
  and returns the next locale so the route component can call
  `router.invalidate()`.
- Do not import TanStack Router in the slice.
- Do not compute dictionaries in the slice; components call `getDictionary(locale)`.

Root hydration detail:

- `src/client/routes/__root.tsx` still resolves `locale` and `theme` in
  `beforeLoad()` for SSR and `<html>` attributes.
- `RootComponent` must hydrate `useApp` from `Route.useRouteContext()` before
  descendants read `locale` and `theme`.
- Prefer a tiny `PrefsHydrator` component or a guarded synchronous hydration
  call that avoids repeated state writes.

### `src/stores/slices/chatSlice.ts`

State:

```ts
export type ChatSlice = {
  currentUser?: CurrentUser;
  chatMessages: ChatMessage[];
  chatInput: string;
  chatError?: string;

  isChatBootstrapping: boolean;
  isChatSubmitting: boolean;
  isChatStreamConnected: boolean;

  audioInputOptions: AudioInputOption[];
  selectedAudioInputId: string;
  isRecording: boolean;
  recordingDuration: number;

  setChatInput: (input: string) => void;
  clearChatError: () => void;
  bootstrapChat: () => Promise<"ok" | "unauthorized" | "not_registered">;
  startChatStream: () => void;
  stopChatStream: () => void;
  syncAudioInputs: () => Promise<void>;
  selectAudioInput: (deviceId: string) => Promise<void>;
  sendChatInput: () => Promise<void>;
  sendButtonReply: (buttonReply: string) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: (shouldSend: boolean) => void;
  logout: () => Promise<void>;
};
```

Non-rendering cleanup handles:

- The slice may keep a module-level `let stopStream: (() => void) | undefined`
  inside `chatSlice.ts` rather than putting the function in public state.
- The slice should not expose `EventSource`, `MediaRecorder`, chunks, or timers.
  Those stay in services.

Actions:

**`bootstrapChat()`**

- Set `isChatBootstrapping: true` and clear `chatError`.
- Call `webChatService.getCurrentUser()`.
- If it returns `undefined`, return a status for the component to navigate.
- Set `currentUser`.
- Call `webChatService.getMessages()` and set `chatMessages`.
- Use `try/finally` to reset `isChatBootstrapping`.
- Return `"ok"`, `"unauthorized"`, or `"not_registered"` so the route handles
  navigation.

**`startChatStream()`**

- No-op if there is no `currentUser` or a stream is already active.
- Call `webChatStreamService.subscribe()`.
- On open, set `isChatStreamConnected: true`.
- On close/error, set `isChatStreamConnected: false`.
- On event, update `chatMessages` using current behavior:
  - `text`: append bot text message.
  - `interactive_button`: append bot interactive message with buttons.
  - `audio`: find the latest user audio message without `transcript` and patch
    `mediaUrl`, `mimeType`, and `transcript`.
  - `error`: set `chatError` if `event.data.text` exists.
- Use `crypto.randomUUID()` and `new Date().toISOString()` for optimistic/SSE
  generated messages, as current code does.

**`stopChatStream()`**

- Invoke and clear the unsubscribe function.
- Set `isChatStreamConnected: false`.

**`syncAudioInputs()`**

- Call `audioInputService.listAudioInputs()`.
- Resolve selected device using current selection or stored id.
- Set `audioInputOptions` and `selectedAudioInputId`.
- Safe default is empty options and empty selected id.

**`selectAudioInput(deviceId)`**

- Set `selectedAudioInputId`.
- Persist via `audioInputService.storeDeviceId(deviceId)`.

**`sendChatInput()`**

- Trim `chatInput`.
- Return early if empty or `isChatSubmitting`.
- Set `isChatSubmitting: true`.
- Clear `chatInput`.
- Append optimistic user text message.
- Call `webChatService.sendMessage({ text })`.
- On failure, set `chatError` using a generic key-independent message or allow
  the component to map an error code to translations. Prefer storing a small
  error code over storing translated text if this refactor also touches i18n.
- Reset `isChatSubmitting` in `finally`.

**`sendButtonReply(buttonReply)`**

- Return early if `isChatSubmitting`.
- Set `isChatSubmitting: true`.
- Append optimistic user interactive message with `buttonReply`.
- Call `webChatService.sendMessage({ buttonReply })`.
- Reset `isChatSubmitting` in `finally`.

**`startRecording()`**

- Call `audioRecordingService.start()` with selected device id.
- Set `isRecording: true` and `recordingDuration: 0` only after recording starts.
- `onTick(duration)` updates `recordingDuration`.
- `onRecorded({ blob, url })` calls an internal async flow:
  - Set `isChatSubmitting: true`.
  - Append optimistic user audio message with `mediaUrl: url` and
    `mimeType: blob.type`.
  - Call `webChatService.sendAudio({ blob, mimeType: blob.type })`.
  - Clear submitting in `finally`.
- `onEmptyRecording` sets `chatError`.
- `onError` sets microphone error.
- If startup fails, ensure `isRecording: false` and `recordingDuration: 0`.

**`stopRecording(shouldSend)`**

- Call `audioRecordingService.stop(shouldSend)`.
- Set `isRecording: false` and `recordingDuration: 0` immediately, matching
  current UI behavior.

**`logout()`**

- Call `webChatService.logout()`.
- Call `stopChatStream()`.
- Reset chat state to its initial values except audio input preferences if those
  should remain available after login.
- Return `void`; component navigates to `/chat/login`.

## Route and Component Changes

### `src/client/routes/__root.tsx`

Changes:

- Remove `PrefsProvider` import and usage.
- Keep `parseCookies()`, `resolvePrefs()`, `getPrefs()`, and route context for
  SSR and document attributes.
- Import `useApp` from `~/stores`.
- In `RootComponent`, hydrate the prefs slice with route context and render
  `<Outlet />` directly.
- In `RootDocument`, continue using route context for `<html lang>`,
  `data-theme`, and `className`.
- In `NotFoundRoute`, read locale through `useApp((state) => state.locale)`.

Example target shape:

```tsx
function RootComponent() {
  const { locale, theme } = Route.useRouteContext();
  const hydratePrefs = useApp((state) => state.hydratePrefs);

  // Hydrate before descendants depend on prefs. Guard in the action to avoid
  // repeated writes when the values have not changed.
  hydratePrefs({ locale, theme });

  return <Outlet />;
}
```

If render-time hydration causes React warnings, replace it with a tiny component
that initializes a per-render flag and keeps the first client render aligned
with route context.

### `src/client/components/PrefsProvider.tsx`

Delete after all imports are migrated.

Migration targets:

- `src/client/routes/__root.tsx`
- `src/client/routes/index.tsx`
- `src/client/routes/privacy.tsx`
- `src/client/routes/chat/login.tsx`
- `src/client/routes/chat/index.tsx`
- Any other future `usePrefs` imports found by grep.

### `src/client/routes/index.tsx`

Changes:

- Replace `usePrefs()` with `useApp((state) => state.locale)`.
- Keep dictionary lookup in component.
- No local state needed.

### `src/client/routes/privacy.tsx`

Changes:

- Replace `usePrefs()` with `useApp((state) => state.locale)`.
- Keep loader and `dangerouslySetInnerHTML` unchanged.

### `src/client/routes/chat/login.tsx`

Changes:

- Replace `usePrefs()` with `useApp((state) => state.locale)`.
- Keep `<form method="GET" action="/api/v1/web/auth/login">` unchanged. This is
  an OAuth navigation, not a service call from application code.

### `src/client/routes/chat/index.tsx`

This file should become mostly rendering, selectors, event wiring, navigation,
scrolling, virtualization, and DOM measurement.

Remove imports:

- `WebChatApi`
- `AudioInputDevices`
- `WebAudioRecording`
- `SharedChatMessage`, `SharedCurrentUser`, `WebChatEvent`
- Most `useState` usages that are not DOM-specific

Add imports:

- `useApp` from `~/stores`
- `type ChatMessage` from `~/entities/ChatMessage` if needed for local typing

Selectors:

```ts
const locale = useApp((state) => state.locale);
const theme = useApp((state) => state.theme);
const toggleTheme = useApp((state) => state.toggleTheme);
const toggleLocale = useApp((state) => state.toggleLocale);
const user = useApp((state) => state.currentUser);
const messages = useApp((state) => state.chatMessages);
const input = useApp((state) => state.chatInput);
const setInput = useApp((state) => state.setChatInput);
const isLoading = useApp((state) => state.isChatBootstrapping);
const isSending = useApp((state) => state.isChatSubmitting);
const isRecording = useApp((state) => state.isRecording);
const recordingDuration = useApp((state) => state.recordingDuration);
const sseConnected = useApp((state) => state.isChatStreamConnected);
const audioInputOptions = useApp((state) => state.audioInputOptions);
const selectedAudioInputId = useApp((state) => state.selectedAudioInputId);
const error = useApp((state) => state.chatError);
const canSendChatInput = useApp((state) => state.canSendChatInput);
const canSelectAudioInput = useApp((state) => state.canSelectAudioInput);
```

Actions:

```ts
const bootstrapChat = useApp((state) => state.bootstrapChat);
const startChatStream = useApp((state) => state.startChatStream);
const stopChatStream = useApp((state) => state.stopChatStream);
const syncAudioInputs = useApp((state) => state.syncAudioInputs);
const selectAudioInput = useApp((state) => state.selectAudioInput);
const sendChatInput = useApp((state) => state.sendChatInput);
const sendButtonReply = useApp((state) => state.sendButtonReply);
const startRecording = useApp((state) => state.startRecording);
const stopRecording = useApp((state) => state.stopRecording);
const clearChatError = useApp((state) => state.clearChatError);
const logout = useApp((state) => state.logout);
```

Effects that remain in the route:

- Auto-scroll when `messages.length` changes.
- ResizeObserver for composer height.
- Bootstrap effect that calls `bootstrapChat()` and navigates based on returned
  status.
- Stream lifecycle effect that calls `startChatStream()` when `user` exists and
  `stopChatStream()` on cleanup.
- Audio device lifecycle effect that calls `syncAudioInputs()` once and uses
  `audioInputService.subscribeToDeviceChanges()` either directly or through a
  store action. Prefer a store action if it keeps browser APIs behind services.

Effects removed from the route:

- Direct `/api/v1/web/auth/me` fetch.
- Direct `/api/v1/web/messages` fetch.
- Direct `EventSource` handling.
- Direct `navigator.mediaDevices.enumerateDevices()` calls.
- Direct `window.localStorage` calls.
- Direct `MediaRecorder` setup and chunk handling.
- Direct `/api/v1/web/audio` fetch.
- Direct `/api/v1/web/auth/logout` fetch.

Handlers after refactor:

- `handleSubmit()` prevents default, calls `sendChatInput()`, resets textarea
  height/focus locally.
- `handleInputKeyDown()` calls `sendChatInput()` on Enter.
- `handleAudioInputChange()` calls `selectAudioInput(event.target.value)`.
- `handleLogout()` calls `logout()` then `navigate({ to: "/chat/login" })`.
- `toggleLocale` button calls the store action, then `router.invalidate()` in
  the component because router invalidation is navigation/router concern.
- `onButtonReply` passed to `ChatMessage` calls `sendButtonReply`.

Local DOM state to keep in this route:

```ts
const inputElRef = useRef<HTMLTextAreaElement | null>(null);
const composerRef = useRef<HTMLDivElement>(null);
const parentRef = useRef<HTMLDivElement>(null);
const isNearBottomRef = useRef(true);
const [showScrollBtn, setShowScrollBtn] = useState(false);
const [composerHeight, setComposerHeight] = useState(0);
```

### `src/client/components/ChatMessage.tsx`

Changes:

- Update `SharedChatMessage` import to `ChatMessage` from `~/entities/ChatMessage`.
- Keep `AudioTranscript` local `isExpanded` state.
- Keep `useMemo` for parsed message formatting unless broader React compiler
  guidance says otherwise.

### `src/client/components/AudioWaveform.tsx`

Changes:

- Keep local state.
- Optionally replace `container` `useState` with `useRef` if desired, but this
  is not required for the Zustand refactor.
- Do not move WaveSurfer instance state to Zustand.

## Error Handling and Translation Strategy

Current route code stores translated strings in `error` using `t.errorLoading`,
`t.errorSending`, and `t.errorMicrophone`. During this refactor, prefer one of
these approaches:

1. Minimal behavior-preserving approach: store translated strings by passing the
   needed text into store actions from components. This is less clean because
   actions receive UI copy.
2. Preferred architecture approach: store an error code in Zustand and let the
   component map it through `dictionary.chatPage`.

Use the preferred approach if the diff stays reasonable:

```ts
export type ChatErrorCode = "loading" | "sending" | "microphone";
```

Then `ChatRoute` renders:

```ts
const errorMessage = chatError ? t[chatErrorToDictionaryKey[chatError]] : undefined;
```

If using this option, put the mapping in `src/constants/chatErrorMessageKeyConstants.ts`
or keep it local in `ChatRoute` if it is only used there.

## Detailed Implementation Steps

### Step 1: Install Zustand Dependencies

Run:

```bash
bun add zustand zustand-computed-state
```

Files changed:

- `package.json`
- `bun.lock`

### Step 2: Add Frontend Entities and DTOs

Create:

- `src/entities/CurrentUser.ts`
- `src/entities/ChatMessage.ts`
- `src/entities/AudioInputOption.ts`
- `src/entities/WebChatEvent.ts`
- `src/entities/dtos/HydratePrefsDto.ts`
- `src/entities/dtos/SendWebMessageDto.ts`
- `src/entities/dtos/SendWebAudioDto.ts`
- `src/entities/dtos/StartAudioRecordingDto.ts`

Then update client component prop imports from shared types to frontend entities
where appropriate.

### Step 3: Add Constants

Create:

- `src/constants/preferredAudioMimeTypesConstants.ts`

Move `WebAudioRecording.PreferredAudioMimeTypes` into this constant:

```ts
export const preferredAudioMimeTypesConstants = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;
```

### Step 4: Add Services

Create:

- `src/services/apiService.ts`
- `src/services/webChatService.ts`
- `src/services/webChatStreamService.ts`
- `src/services/audioInputService.ts`
- `src/services/audioRecordingService.ts`
- `src/services/prefsService.ts`

Keep all methods typed and ensure safe defaults:

- Lists return `[]`.
- Optional entities return `undefined`.
- Commands return `void`.
- Services never import stores or components.

### Step 5: Add Root Store and Slices

Create:

- `src/stores/index.ts`
- `src/stores/slices/prefsSlice.ts`
- `src/stores/slices/chatSlice.ts`

Wire slices into `AppSlices` and `useApp` immediately. Add computed values at
the root using `zustand-computed-state`.

### Step 6: Migrate Preferences

Modify:

- `src/client/routes/__root.tsx`
- `src/client/routes/index.tsx`
- `src/client/routes/privacy.tsx`
- `src/client/routes/chat/login.tsx`
- `src/client/routes/chat/index.tsx`

Actions:

- Replace all `usePrefs()` calls with `useApp()` selectors.
- Move theme/locale mutations to `prefsSlice` actions.
- Keep router invalidation in components after locale changes.
- Delete `src/client/components/PrefsProvider.tsx` after imports are gone.

### Step 7: Migrate Chat Bootstrapping and Messages

Modify:

- `src/client/routes/chat/index.tsx`
- `src/client/components/ChatMessage.tsx`

Actions:

- Move auth/me fetch to `webChatService.getCurrentUser()`.
- Move messages fetch to `webChatService.getMessages()`.
- Move bootstrapping orchestration to `chatSlice.bootstrapChat()`.
- Move optimistic text and button reply updates to `chatSlice` actions.
- Keep navigation decisions in the route based on action return values.

### Step 8: Migrate SSE Stream

Modify:

- `src/client/routes/chat/index.tsx`
- `src/stores/slices/chatSlice.ts`
- `src/services/webChatStreamService.ts`

Actions:

- Move `EventSource` and retry timer to `webChatStreamService`.
- Move event handling and message updates to `chatSlice.startChatStream()`.
- Route only starts/stops the stream based on `currentUser` lifecycle.

### Step 9: Migrate Audio Inputs

Modify:

- `src/client/routes/chat/index.tsx`
- `src/stores/slices/chatSlice.ts`
- `src/services/audioInputService.ts`

Actions:

- Move device enumeration and selected-device resolution to service/store.
- Move localStorage read/write to `audioInputService`.
- Move selected device state to `chatSlice`.
- Route only renders the select and calls `selectAudioInput()`.

### Step 10: Migrate Audio Recording and Upload

Modify:

- `src/client/routes/chat/index.tsx`
- `src/stores/slices/chatSlice.ts`
- `src/services/audioRecordingService.ts`
- `src/services/webChatService.ts`

Actions:

- Move `getUserMedia`, `MediaRecorder`, chunks, MIME selection, stream cleanup,
  and recording timer to `audioRecordingService`.
- Move recording state and duration to `chatSlice`.
- Move audio optimistic message creation and upload orchestration to `chatSlice`.
- Move `/api/v1/web/audio` request to `webChatService.sendAudio()`.

### Step 11: Remove Old Utils and Context

Delete after usage is gone:

- `src/client/components/PrefsProvider.tsx`
- `src/client/utils/webChatApi.ts`
- `src/client/utils/audioInputDevices.ts`
- `src/client/utils/webAudioRecording.ts`

Run a grep for old symbols:

```bash
rg "usePrefs|WebChatApi|AudioInputDevices|WebAudioRecording|fetch\(" src/client src/stores src/services
```

Expected result:

- No `usePrefs`.
- No old utility class imports.
- No `fetch(` inside `src/client/` components or routes, except OAuth form
  actions are not `fetch` calls.
- `fetch(` should be centralized in `src/services/apiService.ts` or service files.

### Step 12: Verification

Run:

```bash
bun run typecheck
bun run check
```

Run tests if the local PostgreSQL test dependency is available:

```bash
bun run test
```

Manual verification:

- Open `/` and verify locale/theme render correctly.
- Toggle theme and confirm `<html data-theme>` changes and cookie persists.
- Toggle locale and confirm route content/head metadata invalidate correctly.
- Open `/chat/login` and confirm Google auth form still navigates.
- Open `/chat` authenticated and confirm bootstrapping loads user/messages.
- Send a text message and confirm optimistic message plus bot SSE response.
- Click an interactive button and confirm optimistic reply plus response.
- Change microphone selection and refresh to confirm persistence.
- Record, cancel, and send audio.
- Confirm user audio optimistic waveform appears.
- Confirm transcript patches onto latest pending user audio message after SSE.
- Logout and confirm navigation to `/chat/login`.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Zustand global store with SSR could hydrate stale defaults before route context | Hydrate prefs from root route context before rendering descendants; keep document attributes based on route context |
| SSE reconnect timer leaks after route unmount | `webChatStreamService.subscribe()` must return cleanup that closes `EventSource` and clears timeout |
| Audio media tracks continue after cancel/navigation | `audioRecordingService.stop()` and cleanup must stop all stream tracks |
| Object URLs for optimistic audio are never revoked | Track generated URLs and revoke on message replacement/removal or route reset if this becomes a leak; preserve current behavior initially |
| Store actions need translated error messages | Prefer error codes in store and translation mapping in components |
| Too many selectors make `ChatRoute` verbose | Keep selectors explicit for clarity first; introduce small selector hooks later only if repeated |
| Current import casing differs from file casing for utility classes | Removing those utility imports avoids the mismatch; new files must follow required casing |

## Completion Criteria

The refactor is complete when:

- `src/stores/index.ts` exports `useApp` and wires all slices.
- `src/stores/slices/prefsSlice.ts` owns theme and locale state/actions.
- `src/stores/slices/chatSlice.ts` owns chat, message, stream, composer, and
  recording state/actions.
- `src/services/*Service.ts` owns all API and browser integration.
- Client routes/components no longer call `fetch` directly.
- Client routes/components no longer use `usePrefs`.
- Application state from `src/client/routes/chat/index.tsx` is moved to Zustand.
- DOM-specific state remains local and documented by the implementation shape.
- Old utility/context files are deleted or no longer imported.
- `bun run typecheck` and `bun run check` pass.
