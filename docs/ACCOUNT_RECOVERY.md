# Pseudonymous Accounts and Recovery

The hosted alpha does not require an email address, external identity provider,
or operator-funded service. A candidate begins as a guest and may optionally
register the current workspace.

## Registration

Registration upgrades the existing guest user and preserves its interview
history. The server returns two values once:

- an opaque account handle such as `aic_0123456789abcdef`;
- a high-entropy recovery code beginning with `aicr_`.

The raw recovery code is never stored. PostgreSQL stores a per-account salted
scrypt hash. Audit events contain only lifecycle event names and identifiers.
The browser keeps the signed-in session in an HttpOnly, SameSite cookie.

Candidates must save both values in a password manager. Maintainers cannot
retrieve a forgotten recovery code.

## Sign-in and rotation

The handle and recovery code establish a new 90-day browser session. Recovery
attempts are rate-limited in PostgreSQL. Signing in from a guest workspace
switches the browser to the recovered account; guest data is not silently
merged.

Rotating the recovery code invalidates the previous code immediately. The new
code is displayed once. Existing signed-in sessions remain active until they
expire or are signed out.

## Deletion

Account deletion requires the current recovery code plus the exact confirmation
phrase `DELETE MY ACCOUNT`. It removes the tenant and all relational data by
cascade after explicitly deleting LangGraph checkpoint rows for every owned
session. The browser session cookie is then expired.

This is intentionally a pseudonymous recovery design, not verified identity.
Future email, passkey, or social identity support requires a separate threat
model, enumeration controls, verified recovery lifecycle, and migration plan.
