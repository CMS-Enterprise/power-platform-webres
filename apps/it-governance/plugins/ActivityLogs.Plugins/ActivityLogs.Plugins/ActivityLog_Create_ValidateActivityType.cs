using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace SystemIntake.Plugins
{
    public class ActivityLog_Create_ValidateActivityType : IPlugin
    {
        private const string ActivityLogEntity = "new_activitylogs";
        private const string BatchIdField = "cr69a_batchid";
        private const int PreOperationStage = 20;

        private const string ActivityTypeField = "cr3ee_activitytype";
        private const string TargetStepField = "new_process_target_step";
        private const string ReviewLookupField = "new_adminreview";
        private const string RequestLookupField = "new_systemintake";
        private const string LifecycleIdModeField = "cr3ee_lifecycleid";
        private const string ExistingLcidLookupField = "cr3ee_lcid";
        private const string ExpirationDateField = "cr3ee_expirationdate";
        private const string ClosingReasonField = "cr3ee_whyareyouclosingthisrequest";

        private const string ReviewEntity = "cr69a_systemintakeadmin";
        private const string ReviewStepField = "new_admingovernancetasklist";

        private const int ActivityTypeProgressToStep = 216640000;
        private const int ActivityTypeIssueLcid = 216640001;
        private const int ActivityTypeNotItGovernanceRequest = 216640002;
        private const int ActivityTypeNotApprovedByGrb = 216640003;
        private const int ActivityTypeCloseRequest = 216640004;
        private const int ActivityTypeReopenRequest = 216640006;

        private const int LifecycleIdModeCreateNew = 216640000;
        private const int LifecycleIdModeUseExisting = 216640001;

        public void Execute(IServiceProvider serviceProvider)
        {
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            if (context == null)
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: context is null. Exiting.");
                return;
            }

            tracing?.Trace(
                "ActivityLog_Create_ValidateActivityType: Start. Message={0}, PrimaryEntity={1}, Stage={2}, Mode={3}, Depth={4}, UserId={5}, InitiatingUserId={6}, CorrelationId={7}, OperationId={8}",
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
                if (!IsExpectedContext(context, tracing))
                    return;

                var target = GetTarget(context, tracing);
                if (target == null)
                    return;

                if (HasBatchId(target, tracing))
                    return;

                var activityType = target.GetAttributeValue<OptionSetValue>(ActivityTypeField);
                if (activityType == null)
                {
                    tracing?.Trace("ActivityLog_Create_ValidateActivityType: No activity type provided ({0}). Exiting.", ActivityTypeField);
                    return;
                }

                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = serviceFactory.CreateOrganizationService(context.UserId);

                switch (activityType.Value)
                {
                    case ActivityTypeProgressToStep:
                        ValidateProgressToStep(target, service, tracing);
                        break;
                    case ActivityTypeIssueLcid:
                        ValidateIssueLifecycleId(target, tracing);
                        break;
                    case ActivityTypeNotItGovernanceRequest:
                        ValidateFinalDecision(target, "Not an IT Governance Request", true);
                        break;
                    case ActivityTypeNotApprovedByGrb:
                        ValidateFinalDecision(target, "Not approved by GRB", true);
                        break;
                    case ActivityTypeCloseRequest:
                        ValidateFinalDecision(target, "Close Request", true);
                        break;
                    case ActivityTypeReopenRequest:
                        ValidateFinalDecision(target, "Re-open Request", false);
                        break;
                    default:
                        tracing?.Trace("ActivityLog_Create_ValidateActivityType: Activity type {0} is not handled in this plugin slice. Exiting.", activityType.Value);
                        break;
                }
            }
            catch (InvalidPluginExecutionException)
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: InvalidPluginExecutionException thrown.");
                throw;
            }
            catch (Exception ex)
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: Unexpected exception: {0}", ex);
                throw;
            }
            finally
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: End.");
            }
        }

        private static bool IsExpectedContext(IPluginExecutionContext context, ITracingService tracing)
        {
            if (!string.Equals(context.PrimaryEntityName, ActivityLogEntity, StringComparison.OrdinalIgnoreCase))
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: Not target entity ({0}). Exiting.", ActivityLogEntity);
                return false;
            }

            if (!string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase))
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: Not Create message. Exiting.");
                return false;
            }

            if (context.Stage != PreOperationStage)
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: Not PreOperation (Stage {0}). Exiting.", PreOperationStage);
                return false;
            }

            return true;
        }

        private static Entity GetTarget(IPluginExecutionContext context, ITracingService tracing)
        {
            object targetObj;
            if (!context.InputParameters.TryGetValue("Target", out targetObj))
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: Missing Target in InputParameters. Exiting.");
                return null;
            }

            var target = targetObj as Entity;
            if (target == null)
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: Target is not an Entity. Exiting.");
                return null;
            }

            tracing?.Trace("ActivityLog_Create_ValidateActivityType: Target received. LogicalName={0}, Id={1}", target.LogicalName, target.Id);
            return target;
        }

        private static bool HasBatchId(Entity target, ITracingService tracing)
        {
            object batchId;
            if (!target.Attributes.TryGetValue(BatchIdField, out batchId)
                || batchId == null
                || (batchId is string && string.IsNullOrWhiteSpace((string)batchId)))
                return false;

            tracing?.Trace("ActivityLog_Create_ValidateActivityType: Batch ID is populated; bypassing validation for migrated data.");
            return true;
        }

        private static void ValidateProgressToStep(Entity activityLog, IOrganizationService service, ITracingService tracing)
        {
            var step = activityLog.GetAttributeValue<OptionSetValue>(TargetStepField);
            if (step == null)
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: Progress target step not provided; nothing to validate.");
                return;
            }

            var reviewRef = activityLog.GetAttributeValue<EntityReference>(ReviewLookupField);
            if (reviewRef == null)
            {
                tracing?.Trace("ActivityLog_Create_ValidateActivityType: Progress review lookup not provided; nothing to validate.");
                return;
            }

            var review = service.Retrieve(ReviewEntity, reviewRef.Id, new ColumnSet(ReviewStepField));
            var current = review.GetAttributeValue<OptionSetValue>(ReviewStepField);

            tracing?.Trace(
                "ActivityLog_Create_ValidateActivityType: Progress CurrentStep={0}, ProposedStep={1}",
                current != null ? current.Value.ToString() : "(null)",
                step.Value
            );

            if (current != null && current.Value == step.Value)
            {
                throw new InvalidPluginExecutionException(
                    "That step is already the current step. Please choose a different target step."
                );
            }
        }

        private static void ValidateIssueLifecycleId(Entity activityLog, ITracingService tracing)
        {
            var reviewRef = activityLog.GetAttributeValue<EntityReference>(ReviewLookupField);
            if (reviewRef == null)
                throw new InvalidPluginExecutionException("Issue Lifecycle ID requires an Admin Review.");

            var requestRef = activityLog.GetAttributeValue<EntityReference>(RequestLookupField);
            if (requestRef == null)
                throw new InvalidPluginExecutionException("Issue Lifecycle ID requires a Request.");

            var mode = activityLog.GetAttributeValue<OptionSetValue>(LifecycleIdModeField);
            if (mode == null)
                throw new InvalidPluginExecutionException("Issue Lifecycle ID requires a lifecycle ID selection.");

            tracing?.Trace("ActivityLog_Create_ValidateActivityType: Issue LCID mode={0}", mode.Value);

            if (mode.Value == LifecycleIdModeCreateNew)
            {
                if (!activityLog.Attributes.Contains(ExpirationDateField) || activityLog[ExpirationDateField] == null)
                    throw new InvalidPluginExecutionException("Issue Lifecycle ID requires an expiration date when creating a new Lifecycle ID.");

                return;
            }

            if (mode.Value == LifecycleIdModeUseExisting)
            {
                var existingLcid = activityLog.GetAttributeValue<EntityReference>(ExistingLcidLookupField);
                if (existingLcid == null)
                    throw new InvalidPluginExecutionException("Issue Lifecycle ID requires an existing Lifecycle ID when using an existing Lifecycle ID.");

                return;
            }

            throw new InvalidPluginExecutionException("Issue Lifecycle ID has an unsupported lifecycle ID selection.");
        }

        private static void ValidateFinalDecision(Entity activityLog, string actionName, bool requireClosingReason)
        {
            var reviewRef = activityLog.GetAttributeValue<EntityReference>(ReviewLookupField);
            if (reviewRef == null)
                throw new InvalidPluginExecutionException(actionName + " requires an Admin Review.");

            var requestRef = activityLog.GetAttributeValue<EntityReference>(RequestLookupField);
            if (requestRef == null)
                throw new InvalidPluginExecutionException(actionName + " requires a Request.");

            if (requireClosingReason)
            {
                var reason = activityLog.GetAttributeValue<string>(ClosingReasonField);
                if (string.IsNullOrWhiteSpace(reason))
                    throw new InvalidPluginExecutionException(actionName + " requires a closing reason.");
            }
        }
    }
}
