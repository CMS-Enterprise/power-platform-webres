using System;
using System.Globalization;
using Microsoft.Xrm.Sdk;

namespace EditRequest
{
    public class EditRequest_Create_SetRequestAdminGovernanceStep : IPlugin
    {
        private const string EditRequestEntity = "cr69a_editrequest";
        private const string BatchIdField = "cr69a_batchid";
        private const string FormNeedsEditsField = "cr69a_whichformneedsedits";
        private const string WhatChangesAreNeededField = "cr3ee_changes_needed";
        private const string AdditionalInformationField = "cr3ee_additionalinformation";
        private const string AdminNoteField = "cr69a_adminnotes";
        private const string RequestLookupField = "cr69a_systemintake";
        private const string ReviewLookupField = "cr69a_systemintakeadmin";
        private const string ActivityLogEntity = "new_activitylogs";
        private const string ActivityLogRequestLookupField = "new_systemintake";
        private const string ActivityLogReviewLookupField = "new_adminreview";
        private const string ActivityLogTargetStepField = "new_process_target_step";
        private const string ActivityLogActivityTypeField = "cr3ee_activitytype";
        private const string ActivityLogActivityField = "new_activity";
        private const string ActivityLogActivityByField = "new_activityby";
        private const string ActivityLogWhichFormNeedsEditsField = "new_whichformneedsedits";
        private const string ActivityLogWhatChangesAreNeededField = "new_whatchangesareneeded";
        private const string ActivityLogAdditionalInformationField = "new_additionalinformation";
        private const string ActivityLogAdminNoteField = "new_adminnote";
        private const string SystemUserEntity = "systemuser";

        private const int PostOperationStage = 40;

        private const int FormIntakeRequest = 971270000;
        private const int FormDraftBusinessCase = 971270001;
        private const int FormFinalBusinessCase = 971270002;
        private const int FormNoTargetProvided = 971270003;

        private const int ProcessStepIntakeRequest = 971270006;
        private const int ProcessStepDraftBusinessCase = 971270001;
        private const int ProcessStepFinalBusinessCase = 971270003;
        private const int ActivityTypeEditRequest = 216640005;

        public void Execute(IServiceProvider serviceProvider)
        {
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            if (context == null)
            {
                tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: context is null. Exiting.");
                return;
            }

            tracing?.Trace(
                "EditRequest_Create_SetRequestAdminGovernanceStep: Start. Message={0}, PrimaryEntity={1}, Stage={2}, Mode={3}, Depth={4}, UserId={5}, InitiatingUserId={6}, CorrelationId={7}, OperationId={8}",
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

                if (target.Attributes.Contains(BatchIdField) && target[BatchIdField] != null)
                {
                    tracing?.Trace(
                        "EditRequest_Create_SetRequestAdminGovernanceStep: Batch ID ({0}) is populated; this is migrated data. Exiting.",
                        BatchIdField
                    );
                    return;
                }

                var formNeedsEdits = target.GetAttributeValue<OptionSetValue>(FormNeedsEditsField);
                if (formNeedsEdits == null)
                {
                    tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: Form needs edits choice ({0}) is missing. Exiting.", FormNeedsEditsField);
                    return;
                }

                int targetStep;
                if (!TryMapTargetStep(formNeedsEdits.Value, out targetStep))
                {
                    tracing?.Trace(
                        "EditRequest_Create_SetRequestAdminGovernanceStep: Form needs edits value {0} does not create an Activity Log. Exiting.",
                        formNeedsEdits.Value.ToString(CultureInfo.InvariantCulture)
                    );
                    return;
                }

                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = serviceFactory.CreateOrganizationService(context.UserId);

                var requestRef = GetRequiredReference(target, tracing, RequestLookupField, "Request");
                var reviewRef = GetRequiredReference(target, tracing, ReviewLookupField, "Review");
                if (requestRef == null || reviewRef == null)
                {
                    tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: Request and Review are both required to keep steps in sync. Exiting before Activity Log creation.");
                    return;
                }

                var activityLog = new Entity(ActivityLogEntity);
                activityLog[ActivityLogRequestLookupField] = requestRef;
                activityLog[ActivityLogReviewLookupField] = reviewRef;
                activityLog[ActivityLogTargetStepField] = new OptionSetValue(targetStep);
                activityLog[ActivityLogActivityTypeField] = new OptionSetValue(ActivityTypeEditRequest);
                activityLog[ActivityLogActivityField] = BuildActivityLogNote(formNeedsEdits.Value, targetStep);
                activityLog[ActivityLogWhichFormNeedsEditsField] = new OptionSetValue(formNeedsEdits.Value);
                CopyIfPresent(target, activityLog, WhatChangesAreNeededField, ActivityLogWhatChangesAreNeededField);
                CopyIfPresent(target, activityLog, AdditionalInformationField, ActivityLogAdditionalInformationField);
                CopyIfPresent(target, activityLog, AdminNoteField, ActivityLogAdminNoteField);

                var activityByRef = GetSubmittingUserReference(context);
                if (activityByRef != null)
                    activityLog[ActivityLogActivityByField] = activityByRef;

                var activityLogId = service.Create(activityLog);

                tracing?.Trace(
                    "EditRequest_Create_SetRequestAdminGovernanceStep: Created Activity Log {0}. Request={1}:{2}, Review={3}:{4}, TargetStep={5}, ActivityType={6}, ActivityBy={7}",
                    activityLogId,
                    requestRef.LogicalName,
                    requestRef.Id,
                    reviewRef.LogicalName,
                    reviewRef.Id,
                    targetStep.ToString(CultureInfo.InvariantCulture),
                    ActivityTypeEditRequest.ToString(CultureInfo.InvariantCulture),
                    activityByRef != null ? activityByRef.Id.ToString() : "(null)"
                );
            }
            catch (Exception ex)
            {
                tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: Exception: {0}", ex);
                throw;
            }
            finally
            {
                tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: End.");
            }
        }

        private static bool IsExpectedContext(IPluginExecutionContext context, ITracingService tracing)
        {
            if (!string.Equals(context.PrimaryEntityName, EditRequestEntity, StringComparison.OrdinalIgnoreCase))
            {
                tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: Not target entity ({0}). Exiting.", EditRequestEntity);
                return false;
            }

            if (!string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase))
            {
                tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: Not Create message. Exiting.");
                return false;
            }

            if (context.Stage != PostOperationStage)
            {
                tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: Not PostOperation (Stage {0}). Exiting.", PostOperationStage);
                return false;
            }

            return true;
        }

        private static Entity GetTarget(IPluginExecutionContext context, ITracingService tracing)
        {
            object targetObj;
            if (!context.InputParameters.TryGetValue("Target", out targetObj))
            {
                tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: Missing Target in InputParameters. Exiting.");
                return null;
            }

            var target = targetObj as Entity;
            if (target == null)
            {
                tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: Target is not an Entity. Exiting.");
                return null;
            }

            tracing?.Trace(
                "EditRequest_Create_SetRequestAdminGovernanceStep: Target received. LogicalName={0}, Id={1}",
                target.LogicalName,
                target.Id
            );

            return target;
        }

        private static EntityReference GetRequiredReference(
            Entity target,
            ITracingService tracing,
            string lookupField,
            string relatedRecordName)
        {
            var relatedRef = target.GetAttributeValue<EntityReference>(lookupField);
            if (relatedRef == null)
            {
                tracing?.Trace(
                    "EditRequest_Create_SetRequestAdminGovernanceStep: {0} lookup ({1}) is missing.",
                    relatedRecordName,
                    lookupField
                );
                return null;
            }

            if (relatedRef.Id == Guid.Empty)
            {
                tracing?.Trace(
                    "EditRequest_Create_SetRequestAdminGovernanceStep: {0} lookup ({1}) has an empty Id.",
                    relatedRecordName,
                    lookupField
                );
                return null;
            }

            return relatedRef;
        }

        private static bool TryMapTargetStep(int formNeedsEdits, out int targetStep)
        {
            switch (formNeedsEdits)
            {
                case FormIntakeRequest:
                    targetStep = ProcessStepIntakeRequest;
                    return true;
                case FormDraftBusinessCase:
                    targetStep = ProcessStepDraftBusinessCase;
                    return true;
                case FormFinalBusinessCase:
                    targetStep = ProcessStepFinalBusinessCase;
                    return true;
                case FormNoTargetProvided:
                default:
                    targetStep = 0;
                    return false;
            }
        }

        private static string BuildActivityLogNote(int formNeedsEdits, int targetStep)
        {
            return "Edit Request for " + GetFormNeedsEditsLabel(formNeedsEdits) +
                ". Moving Request to " +
                GetTargetStepLabel(targetStep) + ".";
        }

        private static string GetFormNeedsEditsLabel(int formNeedsEdits)
        {
            switch (formNeedsEdits)
            {
                case FormIntakeRequest:
                    return "Intake Request Form";
                case FormDraftBusinessCase:
                    return "Draft Business Case";
                case FormFinalBusinessCase:
                    return "Final Business Case";
                case FormNoTargetProvided:
                    return "No Target Provided";
                default:
                    return "choice " + formNeedsEdits.ToString(CultureInfo.InvariantCulture);
            }
        }

        private static string GetTargetStepLabel(int targetStep)
        {
            switch (targetStep)
            {
                case ProcessStepIntakeRequest:
                    return "Intake Request Form";
                case ProcessStepDraftBusinessCase:
                    return "Draft Business Case";
                case ProcessStepFinalBusinessCase:
                    return "Final Business Case";
                default:
                    return "process step " + targetStep.ToString(CultureInfo.InvariantCulture);
            }
        }

        private static EntityReference GetSubmittingUserReference(IPluginExecutionContext context)
        {
            var userId = context.InitiatingUserId != Guid.Empty
                ? context.InitiatingUserId
                : context.UserId;

            return userId == Guid.Empty
                ? null
                : new EntityReference(SystemUserEntity, userId);
        }

        private static void CopyIfPresent(Entity source, Entity destination, string sourceField, string destinationField)
        {
            if (source.Attributes.Contains(sourceField))
                destination[destinationField] = source[sourceField];
        }
    }
}
