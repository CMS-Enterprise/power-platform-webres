using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace SystemIntake.Plugins
{
    public class ActivityLog_Create_ValidateTargetStepNotCurrent : IPlugin
    {
        private const string ActivityLogEntity = "new_activitylogs";
        private const int PreOperationStage = 20;

        // Activity Log fields
        private const string TargetStepField = "new_process_target_step"; // Choice (global)
        private const string ReviewLookupField = "new_adminreview";       // Lookup -> cr69a_systemintakeadmin

        // Review fields
        private const string ReviewEntity = "cr69a_systemintakeadmin";
        private const string ReviewStepField = "new_admingovernancetasklist"; // Choice (same global)

        public void Execute(IServiceProvider serviceProvider)
        {
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            if (context == null)
            {
                tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: context is null. Exiting.");
                return;
            }

            tracing?.Trace(
                "ActivityLog_Create_ValidateTargetStepNotCurrent: Start. Message={0}, PrimaryEntity={1}, Stage={2}, Mode={3}, Depth={4}, UserId={5}, InitiatingUserId={6}, CorrelationId={7}, OperationId={8}",
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
                    tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: Not target entity ({0}). Exiting.", ActivityLogEntity);
                    return;
                }

                if (!string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase))
                {
                    tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: Not Create message. Exiting.");
                    return;
                }

                // PreOperation only
                if (context.Stage != PreOperationStage)
                {
                    tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: Not PreOperation (Stage {0}). Exiting.", PreOperationStage);
                    return;
                }

                object targetObj;
                if (!context.InputParameters.TryGetValue("Target", out targetObj))
                {
                    tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: Missing Target in InputParameters. Exiting.");
                    return;
                }

                var target = targetObj as Entity;
                if (target == null)
                {
                    tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: Target is not an Entity. Exiting.");
                    return;
                }

                tracing?.Trace(
                    "ActivityLog_Create_ValidateTargetStepNotCurrent: Target received. LogicalName={0}, Id={1}",
                    target.LogicalName,
                    target.Id
                );

                var step = target.GetAttributeValue<OptionSetValue>(TargetStepField);
                if (step == null)
                {
                    tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: No step provided ({0}); nothing to validate. Exiting.", TargetStepField);
                    return;
                }

                var reviewRef = target.GetAttributeValue<EntityReference>(ReviewLookupField);
                if (reviewRef == null)
                {
                    tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: No review reference provided ({0}); nothing to validate. Exiting.", ReviewLookupField);
                    return;
                }

                tracing?.Trace(
                    "ActivityLog_Create_ValidateTargetStepNotCurrent: Validating step. ProposedStep={0}, ReviewRef={1}:{2}",
                    step.Value,
                    reviewRef.LogicalName,
                    reviewRef.Id
                );

                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = serviceFactory.CreateOrganizationService(context.UserId);

                tracing?.Trace(
                    "ActivityLog_Create_ValidateTargetStepNotCurrent: Retrieving Review {0}:{1} (Column={2})",
                    ReviewEntity,
                    reviewRef.Id,
                    ReviewStepField
                );

                var review = service.Retrieve(ReviewEntity, reviewRef.Id, new ColumnSet(ReviewStepField));
                var current = review.GetAttributeValue<OptionSetValue>(ReviewStepField);

                tracing?.Trace(
                    "ActivityLog_Create_ValidateTargetStepNotCurrent: CurrentStep={0}, ProposedStep={1}",
                    current != null ? current.Value.ToString() : "(null)",
                    step.Value
                );

                if (current != null && current.Value == step.Value)
                {
                    tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: Validation failed (proposed step equals current). Throwing InvalidPluginExecutionException.");
                    throw new InvalidPluginExecutionException(
                        "That step is already the current step. Please choose a different target step."
                    );
                }

                tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: Validation passed.");
            }
            catch (InvalidPluginExecutionException)
            {
                // Expected validation failure path
                tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: InvalidPluginExecutionException thrown (validation).");
                throw;
            }
            catch (Exception ex)
            {
                tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: Unexpected exception: {0}", ex);
                throw;
            }
            finally
            {
                tracing?.Trace("ActivityLog_Create_ValidateTargetStepNotCurrent: End.");
            }
        }
    }
}