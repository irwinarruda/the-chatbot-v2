---
name: client-state-management
description: "Authoritative guide to The Chatbot client state architecture: URL/search params, Zustand slices, selectors, derived state, async actions, loading/submitting/reset behavior, optimistic updates, SSE reduction, browser recording/device state, preferences, and SSR hydration. Use whenever changing client workflows or deciding between URL, Zustand, local React state, refs, and return values, even when the user does not mention state management."
---

# Client State Management

## Source of truth and precedence

The feature-owned client slices, TanStack route/search state, client services, and
SSR hydration flow are the source of truth.

Precedence:

1. The user's explicit request and scoped `AGENTS.md`.
2. The owning feature's implemented lifecycle and established slice pattern.
3. This skill as the default state-placement and orchestration guide.

Use the state placement ladder before adding any field, action, hook, or store.

## Purpose

Give every piece of client state one owner. Durable navigation belongs in the URL,
shared feature facts belong in a feature slice, derived values are computed, and
transient interactions stay local. The browser uses plain data; backend entity
classes do not live in React state.

Load `app-architecture` for module ownership, `app-service-boundaries` for HTTP/SSE
and browser effects, and `app-coding-styleguide` while implementing.

## State placement ladder

Classify state in this order. The first fitting rung wins.

1. **URL** — durable navigation or workflow identity that should survive reload,
   deep links, back, or forward.
2. **Feature slice** — shared fetched source data, workflow state, non-navigable
   selected IDs, loading/submitting state, connection state, and actions used across
   components.
3. **Derived value** — anything computable from source state.
4. **Not state** — one-use values that can be returned from an action and consumed
   immediately.
5. **Local React state/ref** — drafts, popovers, hover, element measurements,
   recording handles, and interaction details whose loss on unmount is correct.

Do not put a value in Zustand merely because more than one line uses it. State exists
to survive time or coordinate owners, not to ferry a value between adjacent awaits.

## URL as durable workflow state

Use path/search params for:

- selected record identity when the selection is navigable;
- list filters, sort, and pagination that users may share or revisit;
- multi-step flow position and restorable draft identity;
- sub-views that should participate in browser history.

The URL is canonical. A slice may fetch/cache what the URL identifies, but it must
not maintain another independently mutable copy of the same selection/filter.

On reload or direct navigation, the screen reads the URL and calls the same slice
action used by in-app navigation. When params are invalid, redirect declaratively to
the closest valid state.

Keep ephemeral interaction state out of the URL.

## Feature-owned slices

Each feature owns its slice under the module's `client/` area. The app may compose
slices into one hook, but composition does not erase ownership.

A slice interface may contain:

- stable source fields;
- derived selectors/capabilities;
- async and synchronous feature actions;
- explicit reset/bootstrap actions.

Do not create a separate Zustand store by default. Split stores only for a concrete
request-isolation, lifecycle, or performance reason.

Keep slice creation static and deterministic. Do not read storage, DOM, transport,
provider services, or request data while defining initial state.

## Source state and derived state

Store facts. Derive relationships.

- For a non-navigable selection, store `selectedTodoId` and derive `selectedTodo`
  from `todos`.
- Store messages; derive visible groups and capabilities.
- Store filter criteria in the URL; derive the filtered view.
- Store connection state; derive whether controls are enabled.

Never store a second value that can drift after refresh, reset, mutation, or
reconnection.

Use selectors or the project's computed-state mechanism for derived values shared by
multiple components. Keep cheap component-only derivations close to the component.

## Slice actions

Actions orchestrate client workflow state around a client service:

1. read needed source values;
2. guard missing prerequisites;
3. set loading/submitting/optimistic state;
4. call the client service;
5. reduce the authoritative result;
6. clean up flags in `finally`.

Resolve no dependencies from a global service locator inside actions. Define slices
as typed factories such as `createChatSlice(dependencies)` and inject feature client
services through the client composition root. Tests use the same factory with
deterministic fakes.

Let errors propagate to the UI error boundary/wrapper unless the action has a real
rollback or fallback. Use `try/finally` when cleanup is the only need.

Do not put routing, translations, toasts, dialogs, or JSX decisions inside the slice.
The screen decides presentation and navigation after the action resolves.

## Authoritative mutation policy

Choose one consistency path per mutation:

- accept the authoritative entity returned by the server and replace/update source
  state; or
- perform the mutation, then refresh because the backend owns ordering, generated
  fields, or complex derived state; or
- acknowledge an optimistic command now, then reconcile the canonical entity through
  an owned stream event using its stable correlation ID.

Do not update source state from the mutation response and then refetch by habit.
Document the reason when a refresh is required.

For service-persisted preferences, the service computes/returns the authoritative
next value. Do not flip a cached slice mirror and separately persist it.

## Optimistic state

Use optimistic updates only when latency materially affects the interaction and the
workflow has a deterministic reconciliation key.

An optimistic item needs:

- stable client correlation identity;
- pending/succeeded/failed state when failure must remain visible;
- exact server reconciliation;
- rollback or retry behavior.

Do not invent permanent IDs/timestamps that later masquerade as canonical server
data. Do not leave a failed optimistic item looking confirmed.

## Realtime and SSE state

Separate mechanics from reduction:

```text
stream adapter -> parse/retry/backoff/cancel
feature slice  -> connection state + canonical event reduction
component      -> render status and user choices
```

The low-level adapter owns reconnect behavior. Key each subscription by the owning
conversation/workflow identity. Opening another identity cancels/replaces the prior
subscription, advances a generation token, and ignores callbacks from stale
generations. The slice must not interpret a recoverable error callback as an
instruction to call the permanent unsubscribe function. Only logout, unmount of the
owning feature, identity replacement, or an explicit stop action ends the lifecycle.

Reduce canonical events by stable persisted identity. Updates target exact IDs; do
not scan for the most plausible item.

Reconnecting is not enough when events can be missed. Send the last accepted event ID
or cursor, then reduce either replayed events or an authoritative snapshot according
to the owned stream contract. Event reduction must tolerate documented duplicates
and reject stale/out-of-order updates.

Make event reduction a pure named function when the event family or reconciliation
logic becomes complex enough to test independently.

## Browser media and device lifecycles

Browser recording, audio devices, timers, and stream handles have a different
lifecycle from chat messages.

- Keep MediaRecorder/device handles inside a focused client adapter. A hook/ref may
  hold only the adapter session or cleanup handle, not the browser mechanics.
- Keep user-visible recording/device state in a focused feature slice only when
  several components coordinate it.
- Clean up subscriptions, tracks, timers, and object URLs explicitly.
- Do not mix media-device discovery/retry mechanics into message reduction.

Split a slice when these independent lifecycles make each other hard to follow, not
because of an arbitrary line limit.

## SSR-safe store creation

Never mutate a process-global Zustand singleton with request-specific data during
server render. Server modules may be reused across users.

The default in this app is to keep request-specific server data in TanStack request
and route context, then explicitly hydrate the browser store during client
initialization. Create per-request Zustand stores only when a feature has a concrete
server-side state need that route context cannot represent cleanly.

Bootstrap must be explicit and deterministic. Static defaults belong in slice
creation; request/browser values arrive through a bootstrap/hydrate action.

The initial hydrate replaces static defaults with the request snapshot. Later hydrate
calls must name their semantics explicitly (`replace`, `merge`, or `ignore`) rather
than silently reusing the first value. Do not lock one request's value into
process-global state.

## Storage and browser effects

Slices and components do not know storage keys, cookie serialization, MediaRecorder
details, EventSource behavior, or fetch mechanics.

Browser-local persistence belongs behind a client service. Request-cookie
parsing/serialization belongs to server middleware/controllers. Keep pure
parsing/normalization in the owning module or genuinely shared contract code so
server code never imports client mutation behavior.

## Resets and lifecycle exits

Give restartable workflows explicit reset/stop actions.

Reset only what the lifecycle owns:

- selected IDs and drafts;
- fetched collections that must reload;
- editing/submitting/loading flags;
- optimistic pending state;
- connection state and subscriptions;
- recording/device state and handles.

Do not let a narrow feature reset erase unrelated module state. Stop external
subscriptions before clearing the state that identifies them.

## Selector usage

Use narrow selectors in React:

```ts
const messages = useApp((state) => state.messages);
const sendMessage = useApp((state) => state.sendMessage);
```

Do not select/destructure the whole store. Do not call `useApp.getState()` in a
component or hook; it does not subscribe and hides the dependency. Use `getState()`
only in non-React bootstrap code and tests.

Actions should destructure needed fields from `get()` once rather than scattering
`get().field` through expressions.

## Error and loading semantics

Model loading flags at the scope users experience:

- initial feature load;
- one mutation submission;
- pagination/load-more;
- stream connection;
- recording/upload.

One global `isLoading` is insufficient when independent operations overlap. Do not
add a flag for every method either; add one when it affects rendering or prevents an
invalid concurrent action.

Preserve distinctions between valid empty state, unauthorized access, validation
failure, network failure, and unavailable realtime connection. Client services parse
errors; slices manage workflow state; UI decides presentation.

## Testing state

Test slices and pure reducers through public actions and selectors:

- URL hydration and invalid-param behavior;
- source-to-derived consistency;
- loading/submitting cleanup on success and failure;
- authoritative mutation or refresh policy;
- optimistic reconciliation and rollback;
- reset boundaries;
- stream disconnect/reconnect and exact-ID updates;
- SSR isolation with two requests carrying different data.

Use deterministic client-service fakes. Do not start PostgreSQL to prove a slice
loading flag.

## Checklist

1. Classify the value through URL -> slice -> derived -> not-state -> local.
2. Keep one source of truth.
3. Keep browser/transport mechanics in client services.
4. Make slice actions explicit and error-transparent.
5. Choose authoritative response or refresh, not both by habit.
6. Give optimistic items stable correlation and failure behavior.
7. Let the stream adapter own retry and cancellation.
8. Reduce realtime events by canonical identity.
9. Isolate request-specific SSR state.
10. Add explicit reset/bootstrap semantics.
11. Select narrowly in React.
12. Test workflows without unrelated infrastructure.

## Related skills

- `app-architecture` — feature ownership and client/module placement.
- `app-service-boundaries` — HTTP/SSE contracts and client service mechanics.
- `app-coding-styleguide` — Zustand and TypeScript implementation style.
- `client-jsx-styleguide` — React components and user-facing interaction behavior.
- `app-tests` — slice, SSR, realtime, and client-service test conventions.
