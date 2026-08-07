# PR-05 Wizard recovery and V6 bridge evidence

## Production paths

- `WizardPage` restores in this order: explicit `designId`, active versioned draft, blank session.
- `customerId` and Community Intent effects wait until restoration completes.
- The draft serializer persists incomplete Step 1 and complete Step 2 document state while excluding UI-only state.
- Community conflict probes now use the V6/version-neutral repository facade.
- `StepTwo` and `DesignListPage` call the single V6 bridge orchestrator. The production bridge no longer writes EditorDoc V3.
- Existing supported V1–V6 documents are opened through the migration boundary without Wizard overwrite.
- Invalid and future documents are preserved and blocked. A new conversion navigates only after schema validation and successful V6 persistence.

## Executable acceptance

- `test:pr05-recommendations`: bounded 2+1 policy, stable order, stale request rejection, asset validation before mutation.
- `test:pr05-wizard-draft`: Step 1/Step 2 snapshot, transient-state exclusion, malformed/future rejection, explicit deep-link precedence.
- `test:pr05-v6-bridge`: real converter + schema parser, globally unique IDs, template/geometry/finish/recipe/finger override preservation, exactly-once save, V3/V4/V5/V6 protection, invalid/future protection, save-before-navigation.
- `test:community-intent` and `test:community-studio-flow`: PR-02 consumption and current/new/cancel failure behavior remain green.
- PR-04 V6 contract, migration, store, runtime and production-entry gates remain green.

## Boundary

- This pass does not claim PR-07 direct object manipulation or customer-ready export.
- Automated behavior gates and integration build were run. No new browser walkthrough was recorded in this pass.
