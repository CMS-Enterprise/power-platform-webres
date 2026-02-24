using System;
using Microsoft.Xrm.Sdk;

namespace SystemIntake.Plugins
{
    public class ActivityLog_Create_SyncTargetStepToReviewAndRequest : IPlugin
    {
        private const string ActivityLogEntity = "new_activitylogs";

        // Activity Log fields
        private const string TargetStepField = "new_process_target_step"; // Choice (global)
        private const string ReviewLookupField = "new_adminreview";       // Lookup -> cr69a_systemintakeadmin
        private const string RequestLookupField = "new_systemintake";     // Lookup -> new_systemintake (Request)

        // Review fields
        private const string ReviewEntity = "cr69a_systemintakeadmin";
        private const string ReviewStepField = "new_admingovernancetasklist"; // Choice (same global)
        private const string ReviewReadyForReviewField = "cr69a_readyforreview"; // Two Options (Yes/No)

        // Request fields
        private const string RequestEntity = "new_systemintake";
        private const string RequestStepField = "new_admingovernanceprocessstep"; // Choice (same global)
        private const string RequestReadyForReviewField = "cr69a_readyforreview"; // Two Options (Yes/No)

        private const int PostOperationStage = 40;

        //TODO: Consider shared PluginTracing helper to standardize Start/End/Exception tracing across plugins.
        //Keep it in same assembly initially to avoid dependency deployment complexity.

        public void Execute(IServiceProvider serviceProvider)
        {
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            if (context == null)
            {
                tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: context is null. Exiting.");
                return;
            }

            tracing?.Trace(
                "ActivityLog_Create_SyncTargetStepToReviewAndRequest: Start. Message={0}, PrimaryEntity={1}, Stage={2}, Mode={3}, Depth={4}, UserId={5}, InitiatingUserId={6}, CorrelationId={7}, OperationId={8}",
                context.MessageName,
                context.PrimaryEntityName,
                context.Stage,
                context.Mode,
                context.Depth,
                context.UserId,
                context.InitiatingUserId,
                context.CorrelationId,
                context.OperationId
            );

            try
            {
                if (!string.Equals(context.PrimaryEntityName, ActivityLogEntity, StringComparison.OrdinalIgnoreCase))
                {
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Not target entity ({0}). Exiting.", ActivityLogEntity);
                    return;
                }

                if (!string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase))
                {
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Not Create message. Exiting.");
                    return;
                }

                // PostOperation only
                if (context.Stage != PostOperationStage)
                {
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Not PostOperation (Stage {0}). Exiting.", PostOperationStage);
                    return;
                }

                object targetObj;
                if (!context.InputParameters.TryGetValue("Target", out targetObj))
                {
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Missing Target in InputParameters. Exiting.");
                    return;
                }

                var target = targetObj as Entity;
                if (target == null)
                {
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Target is not an Entity. Exiting.");
                    return;
                }

                tracing?.Trace(
                    "ActivityLog_Create_SyncTargetStepToReviewAndRequest: Target received. LogicalName={0}, Id={1}",
                    target.LogicalName,
                    target.Id
                );

                var reviewRef = target.GetAttributeValue<EntityReference>(ReviewLookupField);
                var requestRef = target.GetAttributeValue<EntityReference>(RequestLookupField);

                // Step is optional now (we still want to clear Ready for Review even if step isn't set)
                var step = target.GetAttributeValue<OptionSetValue>(TargetStepField);

                tracing?.Trace(
                    "ActivityLog_Create_SyncTargetStepToReviewAndRequest: Parsed fields. ReviewRef={0}, RequestRef={1}, Step={2}",
                    reviewRef != null ? $"{reviewRef.LogicalName}:{reviewRef.Id}" : "(null)",
                    requestRef != null ? $"{requestRef.LogicalName}:{requestRef.Id}" : "(null)",
                    step != null ? step.Value.ToString() : "(null)"
                );

                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = serviceFactory.CreateOrganizationService(context.UserId);

                // Update Review (if present)
                if (reviewRef != null)
                {
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Updating Review {0}:{1}", reviewRef.LogicalName, reviewRef.Id);

                    var reviewUpdate = new Entity(ReviewEntity, reviewRef.Id);

                    // Sync step only if provided on the log
                    if (step != null)
                    {
                        reviewUpdate[ReviewStepField] = new OptionSetValue(step.Value);
                        tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Review step set to {0}", step.Value);
                    }
                    else
                    {
                        tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Review step not provided; leaving step unchanged.");
                    }

                    // Always set Ready for Review = false when an Activity Log is created
                    reviewUpdate[ReviewReadyForReviewField] = false;
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Review ReadyForReview set to false.");

                    service.Update(reviewUpdate);
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Review update succeeded.");
                }
                else
                {
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Review lookup not present; skipping Review update.");
                }

                // Update Request (if present)
                if (requestRef != null)
                {
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Updating Request {0}:{1}", requestRef.LogicalName, requestRef.Id);

                    var requestUpdate = new Entity(RequestEntity, requestRef.Id);

                    // Sync step only if provided on the log
                    if (step != null)
                    {
                        requestUpdate[RequestStepField] = new OptionSetValue(step.Value);
                        tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Request step set to {0}", step.Value);
                    }
                    else
                    {
                        tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Request step not provided; leaving step unchanged.");
                    }

                    // Always set Ready for Review = false when an Activity Log is created
                    requestUpdate[RequestReadyForReviewField] = false;
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Request ReadyForReview set to false.");

                    service.Update(requestUpdate);
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Request update succeeded.");
                }
                else
                {
                    tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Request lookup not present; skipping Request update.");
                }
            }
            catch (Exception ex)
            {
                tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: Exception: {0}", ex);
                throw;
            }
            finally
            {
                tracing?.Trace("ActivityLog_Create_SyncTargetStepToReviewAndRequest: End.");
            }
        }
    }
}