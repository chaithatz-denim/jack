import "server-only";

import type { Json } from "./database.types";

type SupabaseAdminClient = {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

type AuditInput = {
  actorUserId?: string | null;
  actorUsername?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  sampleId?: string | null;
  metadata?: Record<string, unknown> | Json;
};

export async function writeAuditLog(supabase: SupabaseAdminClient, input: AuditInput) {
  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: input.actorUserId ?? null,
    actor_username: input.actorUsername ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    sample_id: input.sampleId ?? null,
    metadata: (input.metadata ?? {}) as Json,
  });

  if (error) {
    console.error(`Audit log failed: ${error.message}`);
  }
}
