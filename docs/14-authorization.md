# 14 — Authorization

Source: `packages/auth/src/permissions.ts`

## Design principles

From the module comment:

1. Permissions are named after ACTIONS ON RESOURCES, not UI screens. Code asks "may I do X?" not "is the user an admin?"
2. The matrix is exhaustive by construction: `Permission` is a union type and every role must map every permission to a boolean. Adding a permission is a compile error until all four roles explicitly declare a value.
3. This module answers ROLE questions only. Tenant scoping (which workspace's rows are visible) and Row Level Security are the other two enforcement layers.

## Permission union

All 42 permissions:

```
form:read, form:create, form:update, form:delete, form:pause, form:test
submission:read, submission:update, submission:delete, submission:export, submission:restore_spam
file:download
email_destination:manage, autoresponder:manage, webhook:manage, webhook:replay, integration:manage
health:read, health:manage, incident:acknowledge, schema_drift:resolve, ai_repair:generate, scanner:run
api_key:read, api_key:create, api_key:revoke, agent_token:issue
workspace:read, workspace:update, workspace:delete
member:read, member:invite, member:update_role, member:remove
audit_log:read
client_workspace:create, client_workspace:read, client_workspace:manage
billing:read, billing:manage
usage:read
data:export_workspace, data:configure_retention
```

## Role matrix

| Permission | viewer | developer | admin | owner |
|---|:---:|:---:|:---:|:---:|
| `form:read` | Y | Y | Y | Y |
| `form:create` | | Y | Y | Y |
| `form:update` | | Y | Y | Y |
| `form:delete` | | | Y | Y |
| `form:pause` | | Y | Y | Y |
| `form:test` | | Y | Y | Y |
| `submission:read` | Y | Y | Y | Y |
| `submission:update` | | Y | Y | Y |
| `submission:delete` | | | Y | Y |
| `submission:export` | | | Y | Y |
| `submission:restore_spam` | | Y | Y | Y |
| `file:download` | | Y | Y | Y |
| `email_destination:manage` | | Y | Y | Y |
| `autoresponder:manage` | | Y | Y | Y |
| `webhook:manage` | | Y | Y | Y |
| `webhook:replay` | | Y | Y | Y |
| `integration:manage` | | Y | Y | Y |
| `health:read` | Y | Y | Y | Y |
| `health:manage` | | Y | Y | Y |
| `incident:acknowledge` | | Y | Y | Y |
| `schema_drift:resolve` | | Y | Y | Y |
| `ai_repair:generate` | | Y | Y | Y |
| `scanner:run` | | Y | Y | Y |
| `api_key:read` | | Y | Y | Y |
| `api_key:create` | | Y | Y | Y |
| `api_key:revoke` | | Y | Y | Y |
| `agent_token:issue` | | Y | Y | Y |
| `workspace:read` | Y | Y | Y | Y |
| `workspace:update` | | | Y | Y |
| `workspace:delete` | | | | Y |
| `member:read` | Y | Y | Y | Y |
| `member:invite` | | | Y | Y |
| `member:update_role` | | | Y | Y |
| `member:remove` | | | Y | Y |
| `audit_log:read` | | | Y | Y |
| `client_workspace:create` | | | Y | Y |
| `client_workspace:read` | Y | Y | Y | Y |
| `client_workspace:manage` | | | Y | Y |
| `billing:read` | | | Y | Y |
| `billing:manage` | | | | Y |
| `usage:read` | Y | Y | Y | Y |
| `data:export_workspace` | | | Y | Y |
| `data:configure_retention` | | | Y | Y |

## Key design decisions

### Developer can read but not bulk-export submissions

From the module comment: "Deliberately CAN read submissions (needed to debug real payloads) but CANNOT export them in bulk — bulk egress is an owner/admin decision."

`submission:read` is granted to developer. `submission:export` is not.

### Platform admins do not get ambient access to tenant data

From the `Actor` interface and `can()` function:

```typescript
/** True for platform staff. Does NOT bypass workspace permissions. */
readonly isPlatformAdmin?: boolean;
```

```typescript
/**
 * Platform admins deliberately do NOT get implicit access to tenant data here.
 * Support access to customer content requires an explicit, audited escalation
 * (see docs/33-admin-guide.md) rather than an ambient superuser bit.
 */
export function can(actor: Actor, permission: Permission): boolean {
  const roleAllows = PERMISSION_MATRIX[actor.role][permission];
  if (!roleAllows) return false;
  if (actor.credentialScopes !== undefined) {
    return actor.credentialScopes.includes(permission);
  }
  return true;
}
```

The `isPlatformAdmin` flag is stored on the `Actor` but is not consulted in `can()`. A platform admin who is not a member of a workspace has no permissions there.

### Credential scopes (intersection semantics)

When a request is authenticated by an API key or installation token (not a session), `credentialScopes` narrows the effective permissions. The request is allowed only if BOTH the role AND the credential permit it.

### Role rank enforcement

```typescript
const ROLE_RANK = { viewer: 0, developer: 1, admin: 2, owner: 3 };
```

`canManageMemberWithRole(actor, targetRole)` returns false unless `ROLE_RANK[actor.role] > ROLE_RANK[targetRole]`. This prevents an admin from demoting an owner or escalating themselves.

`canAssignRole(actor, roleToAssign)` applies the same strict inequality — you cannot grant a role at or above your own.

## Enforcement points

Authorization checks happen at three layers:

1. **Client-side**: `PermissionGate` component hides UI controls. This is a UX convenience, not security.
2. **Server-side**: `requireActor(workspaceId, permission)` at the top of every Server Action and Route Handler. This is the actual enforcement boundary.
3. **Database**: Row Level Security as a backstop.

The `assertCan(actor, permission)` utility throws `AuthorizationError` when denied. `AuthorizationError.message` is deliberately generic ("You do not have permission to perform this action.") to avoid leaking resource existence.
