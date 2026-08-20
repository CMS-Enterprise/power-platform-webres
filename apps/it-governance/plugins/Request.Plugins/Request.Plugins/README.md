# Request Plugins

This assembly contains Dataverse plugins whose primary trigger and ownership
boundary is the System Intake Request (`new_systemintake`). Requester changes do
not create Activity Logs because Activity Logs represent admin actions.

## Request_Update_SyncReadyForReviewToReview

Keeps the related Admin Review's `cr69a_readyforreview` value synchronized with
the Request for both `true` and `false` changes.

### Registration

- Entity: `new_systemintake`
- Message: `Update`
- Stage: PostOperation (40)
- Mode: Synchronous
- Filtering attribute: `cr69a_readyforreview`
- Run in user's context: a service/admin user with permission to update Admin Reviews
- Post image alias: `PostImage`
- Post image attribute: `cr69a_systemintakereview`

### Behavior

- Retrieves the related Review and skips the update when its value already
  matches the Request. This prevents a redundant Review update when an Activity
  Log has already cleared both records.
- Traces and exits when the Request has no related Review.
- Does not use a blanket depth guard because Activity Log-triggered Request
  updates are valid synchronization events.
- Treats a missing `PostImage` as a registration error so synchronization cannot
  silently stop working.

Do not register automation that copies Review.`cr69a_readyforreview` back to the
Request while this step is enabled. Bidirectional writers could form an update
loop.

## Build

- Assembly: `Request.Plugins.dll`
- Target framework: .NET Framework 4.7.1
- Strong-name key: shared `CMS.ITGovernance.snk`
