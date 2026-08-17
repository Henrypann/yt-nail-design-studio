/**
 * GEN-V7.1-04 backend-neutral service/error/identity contract.
 *
 * UI code never supplies permissions or a clock. An IdentityAccessPort issues
 * a validated command context from an operation name; local and remote
 * adapters remain free to obtain the actor from different authorities.
 */
export const SERVICE_ERROR_CODES_V1 = [
  'INVALID', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'PRECONDITION_FAILED', 'EXPIRED', 'REVOKED', 'STALE',
  'INTEGRITY_MISMATCH', 'PAYLOAD_TOO_LARGE', 'QUOTA_EXCEEDED',
  'DATA_CORRUPTED', 'UNAVAILABLE', 'RATE_LIMITED', 'INTERNAL',
] as const;
export type ServiceErrorCodeV1 = (typeof SERVICE_ERROR_CODES_V1)[number];

export interface ServiceErrorV1 {
  schemaVersion: 1;
  code: ServiceErrorCodeV1;
  retryable: boolean;
  /** Stable diagnostic key; never a raw exception, URL, file path or secret. */
  reason: string;
  correlationId?: string;
}

export type ServiceResultV1<T> =
  | { ok: true; value: T; changed: boolean }
  | { ok: false; error: ServiceErrorV1 };

export interface ServiceActorV1 {
  actorRef: string;
  permissions: readonly string[];
  disclosure: 'AUTHENTICATED' | 'ANONYMOUS_SHARE' | 'LOCAL_PROTOTYPE';
}

export interface ServiceCommandContextV1 {
  actor: ServiceActorV1;
  idempotencyKey: string;
  correlationId: string;
  now: string;
}

export interface IdentityAccessRequestV1 {
  operation: string;
  /** Caller-generated replay key; it carries no permissions or timestamps. */
  idempotencyKey?: string;
}

export interface IdentityAccessPortV1 {
  readonly adapterKind: 'LOCAL_PROTOTYPE' | 'REMOTE';
  issueContext(request: IdentityAccessRequestV1): Promise<ServiceResultV1<ServiceCommandContextV1>>;
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function exactKeys(raw: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(raw).every((key) => allowed.includes(key));
}

export function isServiceIdV1(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

export function isServiceTimestampV1(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const canonical = new Date(parsed).toISOString();
  return value.includes('.') ? value === canonical : value === canonical.replace('.000Z', 'Z');
}

export function parseServiceCommandContextV1(value: unknown): ServiceCommandContextV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!exactKeys(raw, ['actor', 'idempotencyKey', 'correlationId', 'now'])
    || !isServiceIdV1(raw.idempotencyKey) || !isServiceIdV1(raw.correlationId)
    || !isServiceTimestampV1(raw.now)
    || !raw.actor || typeof raw.actor !== 'object' || Array.isArray(raw.actor)) return null;
  const actor = raw.actor as Record<string, unknown>;
  if (!exactKeys(actor, ['actorRef', 'permissions', 'disclosure'])
    || !isServiceIdV1(actor.actorRef) || !Array.isArray(actor.permissions)
    || !actor.permissions.every(isServiceIdV1) || new Set(actor.permissions).size !== actor.permissions.length
    || !['AUTHENTICATED', 'ANONYMOUS_SHARE', 'LOCAL_PROTOTYPE'].includes(actor.disclosure as string)) return null;
  return structuredClone(value) as ServiceCommandContextV1;
}

export function parseServiceErrorV1(value: unknown): ServiceErrorV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!exactKeys(raw, ['schemaVersion', 'code', 'retryable', 'reason', 'correlationId'])
    || raw.schemaVersion !== 1 || !SERVICE_ERROR_CODES_V1.includes(raw.code as ServiceErrorCodeV1)
    || typeof raw.retryable !== 'boolean' || !isServiceIdV1(raw.reason)
    || (raw.correlationId !== undefined && !isServiceIdV1(raw.correlationId))) return null;
  return structuredClone(value) as ServiceErrorV1;
}

export function serviceErrorV1(
  code: ServiceErrorCodeV1,
  reason: string,
  retryable = false,
  correlationId?: string,
): ServiceResultV1<never> {
  const error: ServiceErrorV1 = {
    schemaVersion: 1,
    code,
    retryable,
    reason: isServiceIdV1(reason) ? reason : 'internal.invalid_error_reason',
    ...(correlationId && isServiceIdV1(correlationId) ? { correlationId } : {}),
  };
  return { ok: false, error };
}

export function requireServicePermissionV1(
  context: ServiceCommandContextV1,
  permission: string,
): ServiceResultV1<true> {
  if (!parseServiceCommandContextV1(context)) return serviceErrorV1('INVALID', 'service.invalid_context');
  if (!isServiceIdV1(permission)) return serviceErrorV1('INVALID', 'service.invalid_permission', false, context.correlationId);
  if (!context.actor.permissions.includes(permission)) {
    return serviceErrorV1('FORBIDDEN', 'service.permission_denied', false, context.correlationId);
  }
  return { ok: true, value: true, changed: false };
}

export function mapDomainErrorCodeV1(code: string): ServiceErrorCodeV1 {
  switch (code) {
    case 'not_found': return 'NOT_FOUND';
    case 'conflict': return 'CONFLICT';
    case 'expired': return 'EXPIRED';
    case 'revoked': return 'REVOKED';
    case 'stale': return 'STALE';
    case 'public_locked':
    case 'public_gate_incomplete':
    case 'transition_denied': return 'PRECONDITION_FAILED';
    case 'persist_failed': return 'UNAVAILABLE';
    default: return 'INVALID';
  }
}
