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
   - Binary bytes are in IndexedDB while authoritative metadata/package records are in localStorage. An asset-batch write failure rolls back its fresh bytes and authority never reports `READY` early. However, authority ETag/quota/permission failure after a successful asset batch, or a browser crash between stores, may leave unreachable metadata/binary orphans.
   - Add garbage collection before calling this production durability.

5. **Historical test fixture drift**
   - Reconcile the old `test:community-v7-1-look-adapter` hardcoded production count (`9`) with the current authority fixture count (`10`) in a dedicated fixture-maintenance change.

6. **Remote concurrency, idempotency and registry proof**
   - Local JSON repositories are single-tab prototypes: read-check-write does not provide cross-tab CAS/Web Locks, and idempotency ledgers have no retention/GC policy.
   - Application mutation APIs do not yet accept caller-stable `commandId`; current protection is repository/asset replay plus in-page action locking, not transport-level exactly-once.
   - The asset command fingerprint is a local non-cryptographic deterministic hash. A remote adapter must use server-side canonical command storage or a cryptographic digest.
   - Bundled asset mappings are registry authority, not cryptographically signed. A production registry needs server authority and signed/provable revisions.

7. **Creator release materialization**
   - Creator PUBLIC cards are `INSPIRATION_ONLY`. Only the frozen canonical demo can create the current same-origin Use intent.
   - Add an authoritative per-Creator DesignRelease path before enabling structured Use/Remix.

8. **Release-owner authorization**
   - Local `ownerRef` proves which prototype actor registered and owns the package/artifacts; it does not bind that actor to `DesignRelease.releasedByIdentityId`.
   - A remote service must authorize source DesignRelease ownership or an explicit remix/license grant before registration.

## Frozen fail-closed rules

- No authoritative DesignRelease or PublishPackage means no Creator share and no Use/Remix writer.
- Unknown asset alias, missing bytes, hash/MIME/dimension mismatch, owner mismatch, corrupt store, stale ETag or conflicting reused idempotency key never degrades to success within the documented local-adapter boundary.
- PUBLIC Explore visibility is not manufacturing, device dispatch, real-result or commercial proof.
- 3D/STL/GLB remain outside this port and upload contract.
