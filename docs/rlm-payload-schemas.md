# RLM Payload Schemas

> **Status:** Draft · For implementation review
> **Audience:** Agent developers, frontend engineers
> **Purpose:** Zod + TypeScript schemas for all RLM instruction-set primitives. These are lifted directly into Next.js API route middleware (`src/app/api/rlm/`) during Phase 2 of the migration.
>
> **Stack:** TypeScript · Zod · Supabase JS client
>
> **File location:** `src/lib/rlm/schemas.ts`

---

## Type Aliases & Shared Types

```typescript
import { z } from 'zod';

// -------------------------------------------------------------------
// Shared
// -------------------------------------------------------------------

/** 64-char hexadecimal SHA-256 digest */
export const ContextHashSchema = z.string().regex(/^[0-9a-f]{64}$/);

/** ISO 8601 timestamp */
export const TimestampSchema = z.string().datetime();

/** Agent UUID */
export const AgentIdSchema = z.string().uuid();

/** Subtask UUID */
export const SubtaskIdSchema = z.string().uuid();

/** Event UUID */
export const EventIdSchema = z.string().uuid();

/** Supabase auth signature from an agent */
export const AgentSignatureSchema = z.string().min(1).max(1024);

// -------------------------------------------------------------------
// Primitive op labels
// -------------------------------------------------------------------

export const RLMOpSchema = z.enum([
  'EVAL', 'ROLLBACK', 'YIELD', 'FORK', 'MERGE', 'ASSERT', 'EMIT',
]);
export type RLMOp = z.infer<typeof RLMOpSchema>;

// -------------------------------------------------------------------
// Common event envelope — all DB rows share these fields
// -------------------------------------------------------------------

export const ReplEventEnvelopeSchema = z.object({
  id:               EventIdSchema,
  subtask_id:       SubtaskIdSchema,
  event_tick:       z.number().int().min(0),
  parent_event_ids: z.array(EventIdSchema).default([]),
  agent_id:         AgentIdSchema,
  op:               RLMOpSchema,
  payload:          z.record(z.unknown()),
  context_hash:     ContextHashSchema,
  created_at:       TimestampSchema,
});
export type ReplEventEnvelope = z.infer<typeof ReplEventEnvelopeSchema>;
```

---

## 1. EVAL

Run code against a specific snapshot of the REPL environment.

### When to use

An agent wants to execute a code snippet. EVAL is the primary primitive — it's what makes the REPL actually run. Every EVAL produces a state update (terminal output, variable bindings) that other agents observe in real time.

### API Route

```
POST /api/rlm/eval
```

### Request

```typescript
export const EvalRequestSchema = z.object({
  subtask_id:         SubtaskIdSchema,
  parent_context_hash: ContextHashSchema,
  code:               z.string().max(64_000),
  language:           z.enum(['ts', 'py', 'sql', 'sh']),
  timeout_ms:         z.number().int().min(1).max(60_000).default(30_000),
});

export type EvalRequest = z.infer<typeof EvalRequestSchema>;
```

### Response

```typescript
export const EvalResultPayloadSchema = z.object({
  exit_code:  z.number().int().min(-1).max(255),
  stdout:     z.string(),
  stderr:     z.string().optional(),
  duration_ms: z.number().int().min(0),
});

export const EvalResponseSchema = z.object({
  event_id:       EventIdSchema,
  context_hash:   ContextHashSchema,
  event_tick:     z.number().int().min(0),
  result:         EvalResultPayloadSchema,
});

export type EvalResponse = z.infer<typeof EvalResponseSchema>;
```

### DB Effect

```
INSERT INTO repl_events (
  subtask_id, parent_event_ids, agent_id,
  op, payload, context_hash, y_update_bin
) VALUES (
  <subtask_id>, ARRAY[<parent_event_id>], <agent_id>,
  'EVAL',
  jsonb_build_object(
    'code', <code>,
    'language', <language>,
    'timeout_ms', <timeout_ms>,
    'exit_code', <result.exit_code>,
    'stdout', <result.stdout>,
    'stderr', <result.stderr>,
    'duration_ms', <result.duration_ms>
  ),
  <context_hash>,
  <y_update_bin>   -- Yjs binary update
);
```

### Realtime Broadcast Payload

```json
{
  "event_id": "uuid",
  "op": "EVAL",
  "context_hash": "sha256-hex",
  "event_tick": 42,
  "result_summary": "... truncated stdout ..."
}
```

---

## 2. ROLLBACK

Revert the REPL state by creating a new branch that forks from an earlier event. The rolled-back branch is reachable for inspection.

### When to use

A syntax error, hallucination, or bad algorithmic decision is discovered. Instead of mutating history, ROLLBACK creates a new branch anchored to the parent of the erroneous event, preserving the error trace.

### API Route

```
POST /api/rlm/rollback
```

### Request

```typescript
export const RollbackRequestSchema = z.object({
  subtask_id:     SubtaskIdSchema,
  target_event_id: EventIdSchema,
  reason:         z.string().max(500),
});

export type RollbackRequest = z.infer<typeof RollbackRequestSchema>;
```

### Response

```typescript
export const RollbackResponseSchema = z.object({
  event_id:          EventIdSchema,
  context_hash:      ContextHashSchema,
  branched_from:      EventIdSchema,
  event_tick:         z.number().int().min(0),
});

export type RollbackResponse = z.infer<typeof RollbackResponseSchema>;
```

### DB Effect

```
-- Look up target_event.parent_event_ids[1] as the new parent
INSERT INTO repl_events (
  subtask_id, parent_event_ids, agent_id,
  op, payload, context_hash
) VALUES (
  <subtask_id>,
  ARRAY[(SELECT parent_event_ids[1] FROM repl_events WHERE id = <target_event_id>)],
  <agent_id>,
  'ROLLBACK',
  jsonb_build_object(
    'target_event_id', <target_event_id>,
    'reason', <reason>
  ),
  <new_context_hash>  -- hash of (rolled-back parent's hash + ROLLBACK + reason)
);
```

### Realtime Broadcast Payload

```json
{
  "event_id": "uuid",
  "op": "ROLLBACK",
  "branched_from": "uuid",
  "reason": "syntax error in SQL join"
}
```

---

## 3. YIELD

Agent A writes the scaffolding, then yields the REPL lock to Agent B to write the business logic. Consumes the caller's lease and issues a new one to the target agent.

### When to use

Task specialization: one agent sets up the environment, another agent fills in the logic. Classic scaffolder/implementer handoff.

### API Route

```
POST /api/rlm/yield
```

### Request

```typescript
export const YieldRequestSchema = z.object({
  subtask_id:      SubtaskIdSchema,
  to_agent_id:     AgentIdSchema,
  context_hash:    ContextHashSchema,
  lease_ttl_ms:    z.number().int().min(1_000).max(3_600_000).default(300_000),
});

export type YieldRequest = z.infer<typeof YieldRequestSchema>;
```

### Response

```typescript
export const YieldResponseSchema = z.object({
  event_id:        EventIdSchema,
  from_agent_id:   AgentIdSchema,
  to_agent_id:     AgentIdSchema,
  new_lease_id:    z.string().uuid(),
  expires_at:      TimestampSchema,
});

export type YieldResponse = z.infer<typeof YieldResponseSchema>;
```

### DB Effect

```sql
-- Step 1: consume caller's lease (handled by rpc_acquire_lease)
-- Step 2: insert new lease for to_agent (handled by rpc_acquire_lease)
-- Step 3: record the YIELD event
INSERT INTO repl_events (subtask_id, parent_event_ids, agent_id, op, payload, context_hash)
VALUES (
  <subtask_id>, ARRAY[<last_event_id>], <caller_agent_id>,
  'YIELD',
  jsonb_build_object(
    'from_agent_id', <caller_agent_id>,
    'to_agent_id', <to_agent_id>,
    'lease_ttl_ms', <lease_ttl_ms>
  ),
  <context_hash>
);
```

### Realtime Broadcast Payload

```json
{
  "event_id": "uuid",
  "op": "YIELD",
  "from_agent_id": "uuid",
  "to_agent_id": "uuid",
  "new_lease_id": "uuid"
}
```

---

## 4. FORK

An agent duplicates the current REPL state to test two different algorithmic approaches simultaneously. Creates two sibling events on the same branch — one labeled scaffolder, one labeled implementer.

### When to use

When the optimal approach is unclear and the agent wants to explore alternatives in parallel before committing to a direction. The `hypothesis` field records the reasoning so a human or supervisor can review later.

### API Route

```
POST /api/rlm/fork
```

### Request

```typescript
export const ForkRequestSchema = z.object({
  subtask_id:         SubtaskIdSchema,
  parent_context_hash: ContextHashSchema,
  hypothesis:         z.string().max(1_000),
  branch_label:       z.string().max(100),
});

export type ForkRequest = z.infer<typeof ForkRequestSchema>;
```

### Response

```typescript
export const ForkBranchSchema = z.object({
  event_id:     EventIdSchema,
  context_hash: ContextHashSchema,
  role:         z.enum(['scaffolder', 'implementer']),
  event_tick:   z.number().int().min(0),
});

export const ForkResponseSchema = z.object({
  branch_id:      z.string(),  // shared identifier for the fork pair
  branches:       z.array(ForkBranchSchema).length(2),
});

export type ForkResponse = z.infer<typeof ForkResponseSchema>;
```

### DB Effect

```
-- Two sibling events, same parent, different roles
INSERT INTO repl_events (subtask_id, parent_event_ids, agent_id, op, payload, context_hash)
VALUES
  (
    <subtask_id>, ARRAY[<parent_event_id>], <agent_id>,
    'FORK',
    jsonb_build_object(
      'type',        'branch',
      'label',       <branch_label>,
      'role',        'scaffolder',
      'hypothesis',  <hypothesis>,
      'branch_id',   <generated_branch_id>
    ),
    <context_hash_scaffolder>
  ),
  (
    <subtask_id>, ARRAY[<parent_event_id>], <agent_id>,
    'FORK',
    jsonb_build_object(
      'type',        'branch',
      'label',       <branch_label>,
      'role',        'implementer',
      'hypothesis',  <hypothesis>,
      'branch_id',   <generated_branch_id>
    ),
    <context_hash_implementer>
  );
```

### Realtime Broadcast Payload

```json
{
  "event_id": "uuid",
  "op": "FORK",
  "branch_id": "string",
  "branches": [
    { "event_id": "uuid", "role": "scaffolder", "context_hash": "..." },
    { "event_id": "uuid", "role": "implementer", "context_hash": "..." }
  ]
}
```

---

## 5. MERGE

Converge two forked branches back into a single stream. The CRDT state is resolved deterministically; the merge event records the resolution strategy used.

### When to use

After evaluating both forked approaches, one is selected (or the agent wants to combine insights from both). MERGE creates a new event whose parents are both branch tips, making the history fully traversable in both directions.

### API Route

```
POST /api/rlm/merge
```

### Request

```typescript
export const MergeStrategySchema = z.enum([
  'crdt-converge',
  'last-write-wins',
  'supervisor-choose',
]);
export type MergeStrategy = z.infer<typeof MergeStrategySchema>;

export const MergeRequestSchema = z.object({
  subtask_id:     SubtaskIdSchema,
  left_hash:      ContextHashSchema,
  right_hash:     ContextHashSchema,
  strategy:       MergeStrategySchema.default('crdt-converge'),
  signature_left:  AgentSignatureSchema.optional(),
  signature_right: AgentSignatureSchema.optional(),
});

export type MergeRequest = z.infer<typeof MergeRequestSchema>;
```

### Response

```typescript
export const MergeResponseSchema = z.object({
  event_id:       EventIdSchema,
  context_hash:   ContextHashSchema,
  branch_id:      z.string(),
  event_tick:     z.number().int().min(0),
  merged_hash:    ContextHashSchema,
});

export type MergeResponse = z.infer<typeof MergeResponseSchema>;
```

### DB Effect

```
INSERT INTO repl_events (subtask_id, parent_event_ids, agent_id, op, payload, context_hash)
VALUES (
  <subtask_id>,
  ARRAY[<left_event_id>, <right_event_id>],
  <agent_id>,
  'MERGE',
  jsonb_build_object(
    'left_hash',   <left_hash>,
    'right_hash',  <right_hash>,
    'strategy',    <strategy>,
    'signature_left',  <signature_left>,
    'signature_right', <signature_right>
  ),
  <merged_context_hash>
);
```

### Realtime Broadcast Payload

```json
{
  "event_id": "uuid",
  "op": "MERGE",
  "branch_id": "string",
  "merged_hash": "sha256-hex"
}
```

---

## 6. ASSERT

Register a programmatic tripwire. The condition is evaluated in API middleware (not in SQL) on every subsequent EVAL. If violated, the configured `action` is taken.

### When to use

Supervisors set ASSERTs to constrain agent behavior — e.g., preventing destructive shell commands, capping memory usage, blocking network egress. ASSERTs are a policy-as-code mechanism for RLM safety.

### API Route

```
POST /api/rlm/assert
```

### Request

```typescript
export const AssertActionSchema = z.enum(['revoke', 'halt', 'notify']);
export type AssertAction = z.infer<typeof AssertActionSchema>;

export const AssertRequestSchema = z.object({
  subtask_id:    SubtaskIdSchema,
  condition_ref: z.string().max(100),
  action:        AssertActionSchema.default('revoke'),
});

export type AssertRequest = z.infer<typeof AssertRequestSchema>;
```

### Response

```typescript
export const AssertResponseSchema = z.object({
  assert_id:  z.string().uuid(),
  enabled:    z.boolean(),
});

export type AssertResponse = z.infer<typeof AssertResponseSchema>;
```

### DB Effect

```
INSERT INTO repl_asserts (subtask_id, owner_agent_id, condition_ref, action)
VALUES (<subtask_id>, <owner_agent_id>, <condition_ref>, <action>);
```

### Built-in Validators (middleware-side)

| `condition_ref` | Description | Triggered when |
|---|---|---|
| `no_destructive_shell_cmds` | Static analysis for destructive shell patterns | `rm -rf`, `del /f`, `format`, `dd`, fork bombs |
| `max_memory_mb` | Memory guard | Estimated memory > threshold |
| `no_network_egress` | Network guard | Outbound HTTP(S) request detected |
| `max_execution_time_ms` | Timeout guard | Wall clock time > threshold |
| `max_output_bytes` | Output size guard | Stdout + stderr size > threshold |

### Realtime Broadcast Payload

```json
{
  "event_id": "uuid",
  "op": "ASSERT",
  "condition_ref": "no_destructive_shell_cmds",
  "action": "revoke"
}
```

---

## 7. EMIT

A passive, non-mutative event used to record metadata or signal state transitions without advancing the Yjs document. Used for session_started, error_observed, checkpoint_saved, etc.

### API Route

```
POST /api/rlm/emit
```

### Request

```typescript
export const EmitTypeSchema = z.enum([
  'session_started',
  'checkpoint_saved',
  'error_observed',
  'merge_intent_signed',
  'supervisor_override',
]);

export const EmitRequestSchema = z.object({
  subtask_id:     SubtaskIdSchema,
  parent_event_ids: z.array(EventIdSchema).default([]),
  emit_type:      EmitTypeSchema,
  metadata:       z.record(z.unknown()).optional(),
});

export type EmitRequest = z.infer<typeof EmitRequestSchema>;
```

### Response

```typescript
export const EmitResponseSchema = z.object({
  event_id:    EventIdSchema,
  context_hash: ContextHashSchema,
  event_tick:  z.number().int().min(0),
});

export type EmitResponse = z.infer<typeof EmitResponseSchema>;
```

---

## 8. SUBSCRIBE (Client-Side)

SUBSCRIBE is not a server primitive — it is a **client-side** operation that opens a Supabase Realtime channel and streams events. The schema here describes the channel contract.

### Channel Name

```
repl-subtask-{subtask_id}
```

### Incoming Event Shape

All broadcast events share a common envelope:

```typescript
export const RealtimeEventSchema = z.object({
  event_id:     EventIdSchema,
  op:           RLMOpSchema,
  context_hash: ContextHashSchema,
  event_tick:   z.number().int().min(0),
  agent_id:     AgentIdSchema,
  payload:      z.record(z.unknown()),
  timestamp:    TimestampSchema,
});
export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;
```

### Gap Detection Protocol

```
Client state:
  - last_known_tick: number
  - channel: Supabase Realtime channel

On channel event:
  1. Receive event with event_tick = T
  2. If T === last_known_tick + 1:
       Apply event, last_known_tick = T
  3. Else if T > last_known_tick + 1:
       -- Gap detected
       Buffer T (do not apply)
       Call: POST /api/rlm/reconcile
         Body: { subtask_id, since_tick: last_known_tick }
       Apply returned events in order
       Update last_known_tick = T
  4. Else:
       -- Duplicate / out-of-order; ignore
```

### Reconcile RPC

```
POST /api/rlm/reconcile
```

```typescript
export const ReconcileRequestSchema = z.object({
  subtask_id:   SubtaskIdSchema,
  since_tick:   z.number().int().min(0),
});

export const ReconcileResponseSchema = z.object({
  events: z.array(ReplEventEnvelopeSchema),
  has_more: z.boolean(),
});

export type ReconcileResponse = z.infer<typeof ReconcileResponseSchema>;
```

---

## 9. Middleware Validation Pipeline

All API routes share the same middleware chain before any DB write is committed:

```typescript
// src/lib/rlm/middleware.ts

import { classify } from './destructive-op-classifier';
import { evaluateAsserts } from './assert-evaluators';

export async function rlmValidate(
  req: Request,
  agentId: string,
  subtaskId: string
): Promise<{ ok: true } | { ok: false; reason: string; action?: AssertAction }> {
  // 1. Load active asserts for this subtask
  const asserts = await loadActiveAsserts(subtaskId);

  // 2. For EVAL requests, run code through destructives classifier
  if (req.op === 'EVAL') {
    const code = req.payload.code as string;
    const classification = classify(code);
    if (classification.is_destructive) {
      // Check if there's a matching ASSERT
      const blockAssert = asserts.find(
        a => a.condition_ref === 'no_destructive_shell_cmds'
      );
      if (blockAssert) {
        return {
          ok: false,
          reason: `Destructive pattern detected: ${classification.matched_patterns.join(', ')}`,
          action: blockAssert.action,
        };
      }
    }
  }

  // 3. Run all other assert evaluators
  for (const assertRow of asserts) {
    const result = await evaluateAsserts(assertRow, req);
    if (!result.passed) {
      return { ok: false, reason: result.reason, action: assertRow.action };
    }
  }

  return { ok: true };
}
```

---

## Appendix B: Zod Schema Summary Table

| Primitive | Request Schema | Response Schema |
|---|---|---|
| `EVAL` | `EvalRequestSchema` | `EvalResponseSchema` |
| `ROLLBACK` | `RollbackRequestSchema` | `RollbackResponseSchema` |
| `YIELD` | `YieldRequestSchema` | `YieldResponseSchema` |
| `FORK` | `ForkRequestSchema` | `ForkResponseSchema` |
| `MERGE` | `MergeRequestSchema` | `MergeResponseSchema` |
| `ASSERT` | `AssertRequestSchema` | `AssertResponseSchema` |
| `EMIT` | `EmitRequestSchema` | `EmitResponseSchema` |
| `SUBSCRIBE` | (client-side channel) | `RealtimeEventSchema` |
| `reconcile` | `ReconcileRequestSchema` | `ReconcileResponseSchema` |

---

## Appendix C: Named Condition References

These are the registered `condition_ref` values. Each maps to a validator function in `src/lib/rlm/assert-evaluators.ts`.

| Condition | Description | Parameters |
|---|---|---|
| `no_destructive_shell_cmds` | Block destructive shell commands in EVAL | none |
| `max_memory_mb` | Halt if memory estimate exceeds threshold | `threshold_mb: number` (stored in `payload`) |
| `no_network_egress` | Block outbound HTTP(S) requests | none |
| `max_execution_time_ms` | Hard wall-clock timeout per EVAL | `threshold_ms: number` |
| `max_output_bytes` | Cap stdout + stderr size | `threshold_bytes: number` |
| `allowlist_only` | Only allow specified modules/packages | `allowlist: string[]` |
| `max_file_writes` | Limit number of file write operations | `max_count: number` |
| `readonly_fs` | All filesystem operations are read-only | none |
