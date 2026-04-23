-- ============================================================
-- Brinepool RLM Schema Migration
-- ============================================================
-- Version:   20260423
-- Author:    Brinepool Core
-- Status:    DRAFT — for implementation review
-- Stack:     Supabase (Postgres 15+)
-- Run in:    Supabase SQL Editor
--             https://supabase.com/dashboard → SQL Editor
-- ============================================================
--
-- This migration adds the event-sourced DAG + CRDT infrastructure
-- for Brinepool's collaborative REPL sessions (RLMs).
--
-- It is designed to run alongside the existing schema without
-- disruption. See docs/rlm-architecture.md §9 for the phased
-- migration strategy.
--
-- ============================================================
-- PHASE 0: Core Tables
-- ============================================================

-- 1. repl_events
--    Immutable append-only log. Every EVAL / YIELD / FORK / MERGE /
--    ASSERT / ROLLBACK / EMIT is a row here.
--    Ordering is enforced by event_tick (see trigger below).
--
CREATE TABLE repl_events (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  subtask_id       uuid         NOT NULL,
  event_tick       bigint        NOT NULL,
  parent_event_ids  uuid[]        NOT NULL DEFAULT '{}',
  agent_id         uuid         NOT NULL,
  op               text         NOT NULL
                    CHECK (op IN (
                      'EVAL','ROLLBACK','YIELD',
                      'FORK','MERGE','ASSERT','EMIT'
                    )),
  payload          jsonb        NOT NULL,
  context_hash     text         NOT NULL,
  y_update_bin     bytea,
  created_at       timestamptz  DEFAULT now(),

  -- Self-parent is always invalid
  CONSTRAINT repl_no_self_parent CHECK (
    cardinality(parent_event_ids) = 0
    OR cardinality(parent_event_ids) = 1 AND parent_event_ids[1] != id
  )
);

-- Index: fast time-ordered reads for a given subtask
CREATE INDEX repl_events_subtask_tick
  ON repl_events (subtask_id, event_tick ASC);

-- Index: fast parent lookup (for reconstructing DAG edges)
CREATE INDEX repl_events_parents_gin
  ON repl_events USING gin (parent_event_ids);

-- Index: fast context_hash lookups (for caching / deduplication)
CREATE INDEX repl_events_context_hash
  ON repl_events (context_hash);

-- Index: fast agent-scoped queries
CREATE INDEX repl_events_agent
  ON repl_events (agent_id, subtask_id);

-- 2. repl_snapshots
--    Compaction anchors. Yjs state vector is checkpointed to R2;
--    this table holds the R2 pointer so readers can reconstruct state.
--
CREATE TABLE repl_snapshots (
  context_hash        text         PRIMARY KEY,
  subtask_id         uuid         NOT NULL,
  r2_key             text         NOT NULL,
  y_state_vector_bin  bytea,
  event_count         bigint       NOT NULL,
  event_tick          bigint       NOT NULL,
  created_at          timestamptz  DEFAULT now()
);

CREATE INDEX repl_snapshots_subtask_tick
  ON repl_snapshots (subtask_id, event_tick DESC);

-- 3. repl_leases
--    Short-lived, single-use capability tokens.
--    Grants an agent the right to write EVAL/YIELD/FORK events
--    for a specific context_hash in a specific subtask.
--
CREATE TABLE repl_leases (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  subtask_id   uuid         NOT NULL,
  agent_id     uuid         NOT NULL,
  context_hash text         NOT NULL,
  granted_by   uuid         NOT NULL,
  expires_at   timestamptz  NOT NULL,
  consumed     boolean      NOT NULL DEFAULT false,
  created_at   timestamptz  DEFAULT now(),

  CONSTRAINT repl_lease_not_expired CHECK (expires_at > now())
);

-- Index: fast active-lease lookup by agent + subtask (most common path)
CREATE INDEX repl_leases_active
  ON repl_leases (agent_id, subtask_id)
  WHERE consumed = false;

-- Index: fast context_hash + subtask lookup for write preconditions
CREATE INDEX repl_leases_lookup
  ON repl_leases (subtask_id, context_hash, consumed)
  WHERE consumed = false;

-- 4. repl_asserts
--    Programmatic tripwires. Registered by supervisors; evaluated
--    in API middleware before EVAL events are committed.
--
CREATE TABLE repl_asserts (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  subtask_id     uuid         NOT NULL,
  owner_agent_id uuid         NOT NULL,
  condition_ref  text         NOT NULL,  -- e.g. "no_destructive_shell_cmds"
  action         text         NOT NULL DEFAULT 'revoke'
                  CHECK (action IN ('revoke','halt','notify')),
  enabled        boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  DEFAULT now()
);

CREATE INDEX repl_asserts_subtask_enabled
  ON repl_asserts (subtask_id) WHERE enabled = true;

-- 5. repl_supervisors
--    Agents authorized to approve MERGE events and override lease checks.
--
CREATE TABLE repl_supervisors (
  subtask_id     uuid         NOT NULL,
  supervisor_id  uuid         NOT NULL,
  added_at       timestamptz  DEFAULT now(),
  PRIMARY KEY (subtask_id, supervisor_id)
);

-- ============================================================
-- PHASE 1: Sequences & Triggers
-- ============================================================

-- Per-subtask sequences keep tick sequences independent per REPL
-- session and prevent cross-subtask tick contention.
--
-- We use a shared catalog table to track sequence names per subtask
-- (rather than dynamic CREATE SEQUENCE per insert) so we can create
-- them on-demand when a subtask first receives an event.

CREATE TABLE repl_tick_sequences (
  subtask_id      uuid         PRIMARY KEY,
  sequence_name   text         NOT NULL,
  last_tick       bigint       NOT NULL DEFAULT 0
);

-- Trigger function: grab-and-increment the per-subtask tick
CREATE OR REPLACE FUNCTION repl_advance_tick()
RETURNS TRIGGER AS $$
DECLARE
  seq_name   text;
  next_tick  bigint;
BEGIN
  -- Get or create the sequence name for this subtask
  seq_name := (
    SELECT sequence_name
    FROM repl_tick_sequences
    WHERE subtask_id = NEW.subtask_id
  );

  IF seq_name IS NULL THEN
    -- First event for this subtask: create its sequence
    seq_name := 'repl_tick_' || replace(NEW.subtask_id::text, '-', '_');
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I', seq_name);
    INSERT INTO repl_tick_sequences (subtask_id, sequence_name)
    VALUES (NEW.subtask_id, seq_name);
  END IF;

  -- Atomic increment + fetch
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_tick;
  NEW.event_tick := next_tick;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER repl_events_advance_tick
  BEFORE INSERT ON repl_events
  FOR EACH ROW
  EXECUTE FUNCTION repl_advance_tick();

-- ============================================================
-- PHASE 2: RPC Functions
-- ============================================================

-- rpc_get_events_since
-- Called by clients after gap detection to reconcile missed events.
-- Returns up to 500 events after p_since_tick, ordered by tick.
--
CREATE OR REPLACE FUNCTION rpc_get_events_since(
  p_subtask_id   uuid,
  p_since_tick  bigint
)
RETURNS SETOF repl_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM repl_events
  WHERE subtask_id = p_subtask_id
    AND event_tick > p_since_tick
  ORDER BY event_tick ASC
  LIMIT 500;
END;
$$;

-- rpc_get_latest_snapshot
-- Returns the most recent repl_snapshots row for a subtask.
--
CREATE OR REPLACE FUNCTION rpc_get_latest_snapshot(
  p_subtask_id uuid
)
RETURNS repl_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM repl_snapshots
  WHERE subtask_id = p_subtask_id
  ORDER BY event_tick DESC
  LIMIT 1;
END;
$$;

-- rpc_acquire_lease
-- Called by YIELD to consume the caller's lease and issue a new one.
-- Returns the new lease row, or NULL if the caller doesn't hold a valid lease.
--
CREATE OR REPLACE FUNCTION rpc_acquire_lease(
  p_subtask_id   uuid,
  p_agent_id     uuid,
  p_context_hash text,
  p_granted_by   uuid,
  p_ttl_ms       bigint DEFAULT 300000  -- 5 minutes default
)
RETURNS repl_leases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_lease repl_leases;
BEGIN
  -- Consume any existing un-consumed lease held by this agent for this context
  UPDATE repl_leases
  SET consumed = true
  WHERE agent_id   = p_agent_id
    AND subtask_id = p_subtask_id
    AND consumed   = false;

  -- Issue new lease
  INSERT INTO repl_leases (
    subtask_id, agent_id, context_hash,
    granted_by, expires_at
  ) VALUES (
    p_subtask_id,
    p_agent_id,
    p_context_hash,
    p_granted_by,
    now() + make_interval(0, 0, 0, 0, 0, 0, p_ttl_ms / 1000.0)
  )
  RETURNING * INTO new_lease;

  RETURN new_lease;
END;
$$;

-- rpc_validate_and_write_event
-- Core write path: validates lease + asserts, then inserts the event.
-- This is the single entry point all EVAL/YIELD/FORK/ASSERT calls go through.
-- Returns the inserted row, or raises an exception on failure.
--
CREATE OR REPLACE FUNCTION rpc_validate_and_write_event(
  p_subtask_id       uuid,
  p_parent_event_ids uuid[],
  p_agent_id         uuid,
  p_op               text,
  p_payload          jsonb,
  p_context_hash     text,
  p_y_update_bin     bytea  DEFAULT NULL
)
RETURNS repl_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event       repl_events;
  v_asserts     repl_asserts%ROWTYPE;
  v_lease_count int;
BEGIN
  -- 1. Lease check
  IF p_op != 'ASSERT' AND p_op != 'SUBSCRIBE' THEN
    SELECT COUNT(*)
    INTO v_lease_count
    FROM repl_leases
    WHERE agent_id     = p_agent_id
      AND subtask_id   = p_subtask_id
      AND context_hash = p_context_hash
      AND consumed     = false
      AND expires_at   > now();

    IF v_lease_count = 0 THEN
      RAISE EXCEPTION 'No valid lease for agent % on subtask % (context %)',
        p_agent_id, p_subtask_id, p_context_hash
      USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 2. Parent existence check
  IF array_length(p_parent_event_ids, 1) > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM repl_events
      WHERE id = ANY(p_parent_event_ids)
        AND subtask_id = p_subtask_id
    ) THEN
      RAISE EXCEPTION 'Parent event(s) not found or belong to a different subtask'
      USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- 3. Tick monotonicity check (guard against concurrent inserts skipping ticks)
  IF array_length(p_parent_event_ids, 1) = 1 THEN
    -- Single parent: tick must be strictly greater than parent
    IF EXISTS (
      SELECT 1 FROM repl_events
      WHERE id = p_parent_event_ids[1]
        AND event_tick >= (
          SELECT event_tick FROM repl_events
          WHERE subtask_id = p_subtask_id
          ORDER BY event_tick DESC LIMIT 1
        )
    ) THEN
      RAISE EXCEPTION 'Tick monotonicity violated: new event tick must exceed parent tick'
      USING ERRCODE = 'P0003';
    END IF;
  END IF;

  -- 4. Insert
  INSERT INTO repl_events (
    subtask_id, parent_event_ids, agent_id,
    op, payload, context_hash, y_update_bin
  ) VALUES (
    p_subtask_id, p_parent_event_ids, p_agent_id,
    p_op, p_payload, p_context_hash, p_y_update_bin
  )
  RETURNING * INTO v_event;

  RETURN v_event;
END;
$$;

-- rpc_snapshot_and_compact
-- Called by the compaction worker (pg_cron or external scheduler).
-- Triggers snapshot for subtasks that exceed the tick or idle threshold.
-- Returns the number of subtasks compacted.
--
CREATE OR REPLACE FUNCTION rpc_snapshot_and_compact(
  p_tick_threshold   bigint  DEFAULT 200,
  p_idle_threshold_s bigint  DEFAULT 600  -- 10 minutes
)
RETURNS TABLE (subtask_id uuid, last_tick bigint, r2_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtask uuid;
BEGIN
  -- Find subtasks with un-snapshotted events past the tick threshold,
  -- taking a lock so the compaction worker doesn't collide with itself.
  FOR v_subtask IN
    SELECT DISTINCT subtask_id
    FROM repl_events
    WHERE y_update_bin IS NOT NULL
      AND context_hash NOT IN (SELECT context_hash FROM repl_snapshots)
    GROUP BY subtask_id
    HAVING MAX(event_tick) - COALESCE(
      (SELECT MAX(event_tick) FROM repl_snapshots WHERE subtask_id = repl_events.subtask_id),
      0
    ) >= p_tick_threshold
    FOR UPDATE SKIP LOCKED
  LOOP
    -- This block delegates actual snapshot creation to the application
    -- layer (Next.js API route or Edge Function) because it needs to:
    --   a. Fetch Yjs updates from Postgres
    --   b. Apply them to produce a compacted state vector
    --   c. Upload the binary to R2
    --   d. INSERT the repl_snapshots row
    -- SQL alone cannot do binary CRDT operations.
    -- The RPC returns the subtask_id so the caller knows what to process.
    RETURN QUERY
    SELECT
      v_subtask,
      (SELECT MAX(event_tick) FROM repl_events WHERE subtask_id = v_subtask),
      'subtasks/' || v_subtask::text || '/snapshots/' ||
        (SELECT MAX(event_tick) FROM repl_events WHERE subtask_id = v_subtask)::text ||
        '.ybin'
    ;
  END LOOP;
END;
$$;

-- ============================================================
-- PHASE 3: Row-Level Security
-- ============================================================

-- repl_events
ALTER TABLE repl_events ENABLE ROW LEVEL SECURITY;

-- Agents read events for subtasks they participate in or supervise
CREATE POLICY repl_events_select ON repl_events
  FOR SELECT
  USING (
    agent_id IN (
      SELECT agent_id FROM subtasks WHERE id = subtask_id
    )
    OR
    auth.uid() IN (
      SELECT supervisor_id FROM repl_supervisors
      WHERE subtask_id = repl_events.subtask_id
    )
  );

-- Insert only with a valid, un-consumed lease
CREATE POLICY repl_events_insert ON repl_events
  FOR INSERT
  WITH CHECK (
    agent_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM repl_leases
      WHERE agent_id   = auth.uid()
        AND subtask_id = repl_events.subtask_id
        AND context_hash = repl_events.context_hash
        AND consumed   = false
        AND expires_at > now()
    )
  );

-- repl_snapshots — readable by all subtask participants
ALTER TABLE repl_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY repl_snapshots_select ON repl_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM repl_events
      WHERE repl_events.subtask_id = repl_snapshots.subtask_id
        AND repl_events.agent_id = auth.uid()
    )
    OR
    auth.uid() IN (
      SELECT supervisor_id FROM repl_supervisors
      WHERE subtask_id = repl_snapshots.subtask_id
    )
  );

-- repl_leases — readable by holder or granter
ALTER TABLE repl_leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY repl_leases_select ON repl_leases
  FOR SELECT
  USING (agent_id = auth.uid() OR granted_by = auth.uid());

-- Only the granter can create a lease (via rpc_acquire_lease for now)
CREATE POLICY repl_leases_insert ON repl_leases
  FOR INSERT
  WITH CHECK (granted_by = auth.uid());

-- repl_asserts — readable by subtask participants + supervisors
ALTER TABLE repl_asserts ENABLE ROW LEVEL SECURITY;

CREATE POLICY repl_asserts_select ON repl_asserts
  FOR SELECT
  USING (
    owner_agent_id = auth.uid()
    OR
    auth.uid() IN (
      SELECT agent_id FROM subtasks WHERE id = subtask_id
    )
    OR
    auth.uid() IN (
      SELECT supervisor_id FROM repl_supervisors
      WHERE subtask_id = repl_asserts.subtask_id
    )
  );

-- Only subtask owner or supervisors can register asserts
CREATE POLICY repl_asserts_insert ON repl_asserts
  FOR INSERT
  WITH CHECK (
    owner_agent_id = auth.uid()
    OR
    auth.uid() IN (
      SELECT supervisor_id FROM repl_supervisors
      WHERE subtask_id = repl_asserts.subtask_id
    )
  );

-- repl_supervisors
ALTER TABLE repl_supervisors ENABLE ROW LEVEL SECURITY;

CREATE POLICY repl_supervisors_select ON repl_supervisors
  FOR SELECT
  USING (TRUE);  -- readable by authenticated users

-- ============================================================
-- PHASE 4: Backfill Helpers
-- ============================================================

-- backfill_subtask_events
-- Backfills the initial EVAL event for a legacy subtask that has
-- result_file_path set but no repl_events. Called during Phase 0
-- to bootstrap the event log from existing data.
--
CREATE OR REPLACE FUNCTION backfill_subtask_events(
  p_subtask_id uuid
)
RETURNS SETOF repl_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtask   subtasks%ROWTYPE;
  v_parent_id uuid := NULL;
  v_hash     text;
BEGIN
  SELECT * INTO v_subtask FROM subtasks WHERE id = p_subtask_id;

  IF v_subtask.id IS NULL THEN
    RAISE EXCEPTION 'Subtask % not found', p_subtask_id;
  END IF;

  -- Create a synthetic "session_started" EMIT event as the root
  v_hash := encode(
    sha256(
      (v_subtask.id::text || 'session_started' || now()::text)::bytea
    ),
    'hex'
  );

  INSERT INTO repl_events (
    subtask_id, parent_event_ids, agent_id,
    op, payload, context_hash
  ) VALUES (
    v_subtask.id,
    '{}',
    COALESCE(v_subtask.agent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    'EMIT',
    jsonb_build_object(
      'type',   'session_started',
      'title',  v_subtask.title,
      'status', v_subtask.status
    ),
    v_hash
  )
  RETURNING * INTO v_parent_id;

  -- If there's a result_file_path, backfill the first EVAL
  IF v_subtask.result_file_path IS NOT NULL THEN
    v_hash := encode(
      sha256(
        (v_subtask.id::text || v_parent_id::text || 'backfill_eval' || now()::text)::bytea
      ),
      'hex'
    );

    RETURN QUERY
    INSERT INTO repl_events (
      subtask_id, parent_event_ids, agent_id,
      op, payload, context_hash
    ) VALUES (
      v_subtask.id,
      ARRAY[v_parent_id],
      COALESCE(v_subtask.agent_id, '00000000-0000-0000-0000-000000000000'::uuid),
      'EVAL',
      jsonb_build_object(
        'type',          'backfill',
        'result_file_path', v_subtask.result_file_path,
        'result_summary', v_subtask.result_summary
      ),
      v_hash
    )
    RETURNING *;
  END IF;

END;
$$;

-- ============================================================
-- PHASE 5: Cleanup & Stats
-- ============================================================

-- repl_clean_expired_leases
-- Removes leases that have expired and been consumed.
-- Can be wired to pg_cron: SELECT cron.schedule('cleanup-leases', '*/5 * * * *', 'SELECT repl_clean_expired_leases()');
--
CREATE OR REPLACE FUNCTION repl_clean_expired_leases()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  DELETE FROM repl_leases
  WHERE expires_at < now() - interval '1 day'
    AND consumed = true;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================
-- NOTES & GOTCHAS
-- ============================================================
--
-- 1. The event_tick trigger (repl_advance_tick) requires CREATE
--    permission on the database for the app user, since it executes
--    dynamic DDL (CREATE SEQUENCE). Grant as needed:
--    GRANT CREATE ON DATABASE your_db_name TO supabase_service_role;
--
-- 2. RLS is enabled on all new tables. Ensure your Supabase
--    auth.uid() is set correctly in the API layer. The
--    repl_events_insert policy relies on auth.uid() matching
--    the inserting agent_id.
-- 3. The compaction logic in rpc_snapshot_and_compact is partial —
--    it identifies which subtasks need compaction but delegates
--    actual Yjs merge + R2 upload to the application layer.
--    See docs/rlm-architecture.md §5.3 for the full process.
-- 4. backfill_subtask_events is idempotent — calling it multiple
--    times for the same subtask will insert duplicate events if
--    the result_file_path hasn't changed. Add a guard in the
--    calling code if idempotency is required.
--
