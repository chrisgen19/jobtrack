-- Every deleted document row queues the removal of its private file in the same
-- transaction, whatever deleted it: a single document delete, or the cascade when
-- Better Auth deletes the account (so an upload that commits while the account is
-- being deleted is covered too). Graphile only sees the job after the commit, when
-- no row references the key; the worker still skips keys a document references.
-- Batches of 1000 keys match MAX_STORAGE_KEYS_PER_JOB in src/lib/jobs/types.ts.
-- Written by hand: Prisma does not manage functions or triggers.

-- CreateFunction
CREATE FUNCTION "queue_document_file_cleanup"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  batch text[];
BEGIN
  FOR batch IN
    SELECT array_agg(storage_key)
    FROM (SELECT storage_key, (row_number() OVER () - 1) / 1000 AS chunk FROM deleted_documents) AS numbered
    GROUP BY chunk
  LOOP
    PERFORM graphile_worker.add_job(
      identifier => 'delete_user_files',
      payload => json_build_object('storageKeys', batch),
      max_attempts => 25
    );
  END LOOP;
  RETURN NULL;
END;
$$;

-- CreateTrigger
CREATE TRIGGER "documents_queue_file_cleanup"
AFTER DELETE ON "documents"
REFERENCING OLD TABLE AS deleted_documents
FOR EACH STATEMENT EXECUTE FUNCTION "queue_document_file_cleanup"();
