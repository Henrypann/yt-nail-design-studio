# GEN-V7.1-04 handoff

## Required follow-ups

1. **Nail Board application-service cutover**
   - Replace direct browser repository imports in the four Board surfaces with async identity/ETag/idempotency ports.
   - Preserve the existing versioned local payload as a compatibility input; corrupted records must remain fail-closed.

2. **Remote identity and persistence adapters**
   - Current adapters disclose `LOCAL_PROTOTYPE`; there is no deployed backend, session authority, tenant isolation, quota service or production moderation service.
   - A remote implementation must keep the same error, identity, ETag and idempotency contracts and must never let UI-provided permissions become authority.

3. **Cross-origin Community → Studio broker**
   - Same-origin intent creation intentionally remains a synchronous trusted-click handoff for popup safety.
   - Until a one-time server handoff token exists, true dual-origin Use/Remix must stay disabled and writer-zero; do not put the document, package or full intent in the URL.

4. **Local crash-orphan cleanup**
   - Binary bytes are in IndexedDB while authoritative metadata/package records are in localStorage. Normal failures roll back fresh bytes and authority never reports `READY` early, but a browser crash between stores may leave unreachable binary orphans.
   - Add garbage collection before calling this production durability.

5. **Historical test fixture drift**
   - Reconcile the old `test:community-v7-1-look-adapter` hardcoded production count (`9`) with the current authority fixture count (`10`) in a dedicated fixture-maintenance change.

## Frozen fail-closed rules

- No authoritative DesignRelease or PublishPackage means no Creator share and no Use/Remix writer.
- Unknown asset alias, missing bytes, hash/MIME/dimension mismatch, corrupt store, stale ETag or reused idempotency key never degrades to success.
- PUBLIC Explore visibility is not manufacturing, device dispatch, real-result or commercial proof.
- 3D/STL/GLB remain outside this port and upload contract.
