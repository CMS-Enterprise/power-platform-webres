using System;
using System.Globalization;
using Microsoft.Xrm.Sdk;

namespace EditRequest
{
    public class EditRequest_Create_SetRequestAdminGovernanceStep : IPlugin
    {
        private const string EditRequestEntity = "cr69a_editrequest";
        private const string FormNeedsEditsField = "cr69a_whichformneedsedits";
        private const string RequestLookupField = "cr69a_systemintake";
        private const string ReviewLookupField = "cr69a_systemintakeadmin";
        private const string RequestStepField = "new_admingovernanceprocessstep";
        private const string ReviewStepField = "new_admingovernancetasklist";

        private const int PostOperationStage = 40;

        private const int FormIntakeRequest = 971270000;
        private const int FormDraftBusinessCase = 971270001;
        private const int FormFinalBusinessCase = 971270002;
        private const int FormNoTargetProvided = 971270003;

        private const int ProcessStepIntakeRequest = 971270006;
        private const int ProcessStepDraftBusinessCase = 971270001;
        private const int ProcessStepFinalBusinessCase = 971270003;

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

                var formNeedsEdits = target.GetAttributeValue<OptionSetValue>(FormNeedsEditsField);
                if (formNeedsEdits == null)
                {
                    tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: Form needs edits choice ({0}) is missing. Exiting.", FormNeedsEditsField);
                    return;
                }

                int processStep;
                if (!TryMapProcessStep(formNeedsEdits.Value, out processStep))
                {
                    tracing?.Trace(
                        "EditRequest_Create_SetRequestAdminGovernanceStep: Form needs edits value {0} does not update process steps. Exiting.",
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
                    tracing?.Trace("EditRequest_Create_SetRequestAdminGovernanceStep: Request and Review are both required to keep steps in sync. Exiting before updates.");
                    return;
                }

                UpdateRelatedStep(requestRef, service, tracing, RequestStepField, "Request", processStep);
                UpdateRelatedStep(reviewRef, service, tracing, ReviewStepField, "Review", processStep);
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

        private static void UpdateRelatedStep(
            EntityReference relatedRef,
            IOrganizationService service,
            ITracingService tracing,
            string stepField,
            string relatedRecordName,
            int processStep)
        {
            var relatedUpdate = new Entity(relatedRef.LogicalName, relatedRef.Id);
            relatedUpdate[stepField] = new OptionSetValue(processStep);

            service.Update(relatedUpdate);

            tracing?.Trace(
                "EditRequest_Create_SetRequestAdminGovernanceStep: Updated {0} {1}:{2}. {3}={4}",
                relatedRecordName,
                relatedRef.LogicalName,
                relatedRef.Id,
                stepField,
                processStep.ToString(CultureInfo.InvariantCulture)
            );
        }

        private static bool TryMapProcessStep(int formNeedsEdits, out int processStep)
        {
            switch (formNeedsEdits)
            {
                case FormIntakeRequest:
                    processStep = ProcessStepIntakeRequest;
                    return true;
                case FormDraftBusinessCase:
                    processStep = ProcessStepDraftBusinessCase;
                    return true;
                case FormFinalBusinessCase:
                    processStep = ProcessStepFinalBusinessCase;
                    return true;
                case FormNoTargetProvided:
                default:
                    processStep = 0;
                    return false;
            }
        }
    }
}
