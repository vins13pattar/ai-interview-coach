# ADR 0007: BYOK Key Handling

Status: Accepted

Trust preference is server environment secret, explicit AES-256-GCM encrypted
connection, ephemeral voice credential, then tab-scoped request header. Keys
are never accepted in URLs or retained by default. Hosted operators can
technically observe forwarded tab keys, so the UI documents that self-hosting
offers the stronger trust boundary.
