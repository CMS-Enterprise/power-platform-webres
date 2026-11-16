using System;
using System.Globalization;
using System.Collections.Generic;
using System.Linq;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace SystemIntake.Plugins
{
    public class ActivityLog_Create_ApplyActivityType : IPlugin
    {
        private const string ActivityLogEntity = "new_activitylogs";
        private const string BatchIdField = "cr3ee_batchid";
        private const int PostOperationStage = 40;
        private const int SynchronousMode = 0;
        private const int ObjectDoesNotExist = unchecked((int)0x80040217);

        private const string ActivityTypeField = "cr3ee_activitytype";
        private const string TargetStepField = "new_process_target_step";
        private const string ReviewLookupField = "new_adminreview";
        private const string RequestLookupField = "new_systemintake";
        private const string AdminLeadLookupField = "new_adminlead";
        private const string LifecycleIdModeField = "cr3ee_lifecycleid";
        private const string ExistingLcidLookupField = "cr3ee_lcid";
        private const string ProjectCostBaselineField = "cr3ee_projectcostbaseline";
        private const string ExpirationDateField = "cr3ee_expirationdate";
        private const string ScopeField = "cr3ee_scopeofthelifecycleid";
        private const string NextStepsField = "cr3ee_nextsteps";
        private const string ClosingReasonField = "cr3ee_whyareyouclosingthisrequest";

        private const string ReviewEntity = "cr69a_systemintakeadmin";
        private const string ReviewStepField = "new_admingovernancetasklist";
        private const string ReviewReadyForReviewField = "cr69a_readyforreview";
        private const string ReviewDecisionField = "cr69a_decision";
        private const string ReviewDecisionDateField = "cr69a_decisiondate";
        private const string ReviewLcidField = "cr69a_lcid";
        private const string ReviewCompleteField = "cr69a_systemintakecomplete";
        private const string ReviewStepWhenClosedField = "new_stepwhenclosed";

        private const string RequestEntity = "new_systemintake";
        private const string RequestStepField = "new_admingovernanceprocessstep";
        private const string RequestReadyForReviewField = "cr69a_readyforreview";
        private const string RequestDecisionDateField = "cr3ee_decisiondate";
        private const string RequestDecisionField = "easi_decision";
        private const string RequestLcidField = "cr69a_lcid";
        private const string RequestNextStepsField = "cr3ee_nextsteps";
        private const string RequestStatusField = "cr69a_status";
        private const string RequestStepWhenClosedField = "new_stepwhenclosed";
        private const string RequestFinalBusinessCaseSubmittedField = "cr69a_finalbusinesscasesubmitted";
        private const string RequestFinalBusinessCaseSubmittedDateField = "cr69a_finalbusinesscasesubmitteddate";

        private const string LcidEntity = "cr69a_lifecycleids";
        private const string LcidNameField = "cr69a_lcid";
        private const string LcidRawLcidField = "cr3ee_rawlcid";
        private const string LcidCostBaselineField = "cr3ee_costbaseline";
        private const string LcidExpiresAtField = "cr69a_lcidexpiresat";
        private const string LcidIssuedAtField = "cr69a_issuedat";
        private const string LcidStatusField = "cr3ee_lcidstatus";
        private const string LcidScopeField = "cr3ee_scope";
        private const string LcidTypeField = "new_lcidtype";
        private const string LcidIsLowItField = "new_lcidislowit";
        private const string LcidIsShortenedField = "new_lcidisshortened";
        private const string LcidComponentField = "new_lcidcomponent";

        private const string TeamEntity = "team";
        private const string TeamNameField = "name";
        private const string AdminTeamName = "IT Governance Admin Team";

        private const int ActivityTypeProgressToStep = 216640000;
        private const int ActivityTypeIssueLcid = 216640001;
        private const int ActivityTypeNotItGovernanceRequest = 216640002;
        private const int ActivityTypeNotApprovedByGrb = 216640003;
        private const int ActivityTypeCloseRequest = 216640004;
        private const int ActivityTypeEditRequest = 216640005;
        private const int ActivityTypeReopenRequest = 216640006;
        private const int ActivityTypeMakeChangesToRequest = 216640008;
        private const int ActivityTypeReassignRequester = 216640009;

        private const int LifecycleIdModeCreateNew = 216640000;
        private const int LifecycleIdModeUseExisting = 216640001;

        private const int FinishedStep = 971270009;
        private const int DraftStep = 971270006;
        private const int IntakeRequestReviewStep = 971270000;
        private const int DraftBusinessCaseStep = 971270001;
        private const int GrtMeetingStep = 971270002;
        private const int FinalBusinessCaseStep = 971270003;
        private const int IssueLifecycleIdDecision = 971270000;
        private const int NotItGovernanceRequestDecision = 971270001;
        private const int NotApprovedByGrbDecision = 971270002;
        private const int CloseRequestDecision = 971270003;
        private const int RequestStatusClosed = 100000000;
        private const int RequestStatusDraft = 971270000;
        private const int LcidStatusIssued = 216640000;
        private const int ReviewCompleteYes = 971270000;
        private const int ReviewCompleteNo = 971270001;

        public void Execute(IServiceProvider serviceProvider)
        {
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            if (context == null)
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: context is null. Exiting.");
                return;
            }

            tracing?.Trace(
                "ActivityLog_Create_ApplyActivityType: Start. Message={0}, PrimaryEntity={1}, Stage={2}, Mode={3}, Depth={4}, UserId={5}, InitiatingUserId={6}, CorrelationId={7}, OperationId={8}",
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
                    tracing?.Trace("ActivityLog_Create_ApplyActivityType: No activity type provided ({0}). Exiting.", ActivityTypeField);
                    return;
                }

                tracing?.Trace("ActivityLog_Create_ApplyActivityType: ActivityType={0}", activityType.Value);

                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                if (activityType.Value == ActivityTypeMakeChangesToRequest)
                {
                    if (context.Mode != SynchronousMode || !context.IsInTransaction)
                        throw new InvalidPluginExecutionException("Make Changes to Request requires a synchronous PostOperation transaction.");

                    ApplyRequestChanges(target, context.PrimaryEntityId, serviceFactory, tracing);
                    return;
                }

                if (activityType.Value == ActivityTypeReassignRequester)
                {
                    if (context.Mode != SynchronousMode || !context.IsInTransaction)
                        throw new InvalidPluginExecutionException("Reassign Requester requires a synchronous PostOperation transaction.");

                    ReassignRequester(target, context.PrimaryEntityId, serviceFactory, tracing);
                    return;
                }

                var service = serviceFactory.CreateOrganizationService(context.UserId);

                switch (activityType.Value)
                {
                    case ActivityTypeProgressToStep:
                    case ActivityTypeEditRequest:
                        ApplyProgressToStep(target, service, tracing);
                        break;
                    case ActivityTypeIssueLcid:
                        ApplyIssueLifecycleId(target, service, tracing);
                        break;
                    case ActivityTypeNotItGovernanceRequest:
                        ApplyFinalDecision(
                            target,
                            service,
                            tracing,
                            NotItGovernanceRequestDecision,
                            NotItGovernanceRequestDecision,
                            "Not an IT Governance Request"
                        );
                        break;
                    case ActivityTypeNotApprovedByGrb:
                        ApplyFinalDecision(
                            target,
                            service,
                            tracing,
                            NotApprovedByGrbDecision,
                            NotApprovedByGrbDecision,
                            "Not approved by GRB"
                        );
                        break;
                    case ActivityTypeCloseRequest:
                        ApplyFinalDecision(
                            target,
                            service,
                            tracing,
                            CloseRequestDecision,
                            CloseRequestDecision,
                            "Close Request"
                        );
                        break;
                    case ActivityTypeReopenRequest:
                        ApplyReopenRequest(target, service, tracing);
                        break;
                    case ActivityLog_Create_ValidateActivityType.ActivityTypeSetAdminLead:
                        ApplySetAdminLead(target, service, tracing);
                        break;
                    default:
                        tracing?.Trace("ActivityLog_Create_ApplyActivityType: Activity type {0} is not handled in this plugin slice. Exiting.", activityType.Value);
                        break;
                }
            }
            catch (Exception ex)
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Exception: {0}", ex);
                throw;
            }
            finally
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: End.");
            }
        }

        private static bool IsExpectedContext(IPluginExecutionContext context, ITracingService tracing)
        {
            if (!string.Equals(context.PrimaryEntityName, ActivityLogEntity, StringComparison.OrdinalIgnoreCase))
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Not target entity ({0}). Exiting.", ActivityLogEntity);
                return false;
            }

            if (!string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase))
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Not Create message. Exiting.");
                return false;
            }

            if (context.Stage != PostOperationStage)
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Not PostOperation (Stage {0}). Exiting.", PostOperationStage);
                return false;
            }

            return true;
        }

        private static Entity GetTarget(IPluginExecutionContext context, ITracingService tracing)
        {
            object targetObj;
            if (!context.InputParameters.TryGetValue("Target", out targetObj))
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Missing Target in InputParameters. Exiting.");
                return null;
            }

            var target = targetObj as Entity;
            if (target == null)
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Target is not an Entity. Exiting.");
                return null;
            }

            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Target received. LogicalName={0}, Id={1}", target.LogicalName, target.Id);
            return target;
        }

        private static bool HasBatchId(Entity target, ITracingService tracing)
        {
            object batchId;
            if (!target.Attributes.TryGetValue(BatchIdField, out batchId)
                || batchId == null
                || (batchId is string && string.IsNullOrWhiteSpace((string)batchId)))
                return false;

            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Batch ID is populated; bypassing actions for migrated data.");
            return true;
        }

        private static void ReassignRequester(Entity activityLog, Guid activityLogId, IOrganizationServiceFactory serviceFactory, ITracingService tracing)
        {
            var request = activityLog.GetAttributeValue<EntityReference>(RequestLookupField);
            if (request == null || request.Id == Guid.Empty)
                throw new InvalidPluginExecutionException("A related Request is required to reassign the requester.");

            var newRequester = activityLog.GetAttributeValue<EntityReference>("new_newrequester");
            if (newRequester == null || newRequester.Id == Guid.Empty)
                throw new InvalidPluginExecutionException("A new requester is required.");

            if (string.IsNullOrWhiteSpace(activityLog.GetAttributeValue<string>("cr3ee_reason")))
                throw new InvalidPluginExecutionException("A reason is required to reassign the requester.");

            const string activeUserMessage = "The selected requester must be an active user.";
            if (!string.Equals(newRequester.LogicalName, "systemuser", StringComparison.OrdinalIgnoreCase))
                throw new InvalidPluginExecutionException(activeUserMessage);

            try
            {
                var service = serviceFactory.CreateOrganizationService(null);
                Entity user;
                try
                {
                    user = service.Retrieve("systemuser", newRequester.Id, new ColumnSet("isdisabled"));
                }
                catch (FaultException<OrganizationServiceFault> ex) when (ex.Detail?.ErrorCode == ObjectDoesNotExist)
                {
                    throw new InvalidPluginExecutionException(activeUserMessage, ex);
                }

                if (user.GetAttributeValue<bool?>("isdisabled") != false)
                    throw new InvalidPluginExecutionException(activeUserMessage);

                var currentRequest = service.Retrieve(RequestEntity, request.Id, new ColumnSet("cr69a_requester", "ownerid"));
                var previousRequester = currentRequest.GetAttributeValue<EntityReference>("cr69a_requester");
                var currentOwner = currentRequest.GetAttributeValue<EntityReference>("ownerid");
                if (newRequester.Equals(previousRequester) && newRequester.Equals(currentOwner))
                    throw new InvalidPluginExecutionException("The selected user is already the requester and owner of this Request.");

                var auditUpdate = new Entity(ActivityLogEntity, activityLogId);
                auditUpdate["new_previousrequester"] = previousRequester;
                service.Update(auditUpdate);

                var requestUpdate = new Entity(RequestEntity, request.Id);
                requestUpdate["cr69a_requester"] = newRequester;
                requestUpdate["ownerid"] = newRequester;
                service.Update(requestUpdate);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new InvalidPluginExecutionException("The Request could not be reassigned. No changes were made.", ex);
            }

            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Reassign Requester succeeded. Request={0}, Requester={1}", request.Id, newRequester.Id);
        }

        private static readonly ChangeField[] RequestChangeFields =
        {
            new ChangeField("new_requesttitle", "new_name", "Request Title"),
            new ChangeField("new_requestbusinessneed", "cr3ee_business_need_multi", "Business or User Need")
        };

        private sealed class ChangeField
        {
            public ChangeField(string activityLogField, string requestField, string displayLabel)
            {
                ActivityLogField = activityLogField;
                RequestField = requestField;
                DisplayLabel = displayLabel;
            }

            public string ActivityLogField { get; }
            public string RequestField { get; }
            public string DisplayLabel { get; }
        }

        private static void ApplyRequestChanges(Entity activityLog, Guid activityLogId, IOrganizationServiceFactory serviceFactory, ITracingService tracing)
        {
            var request = activityLog.GetAttributeValue<EntityReference>(RequestLookupField);
            if (request == null || request.Id == Guid.Empty)
                throw new InvalidPluginExecutionException("A related Request is required to update Request details.");

            if (string.IsNullOrWhiteSpace(activityLog.GetAttributeValue<string>("cr3ee_reason")))
                throw new InvalidPluginExecutionException("A reason is required to update Request details.");

            try
            {
                var systemService = serviceFactory.CreateOrganizationService(null);
                var current = systemService.Retrieve(RequestEntity, request.Id,
                    new ColumnSet(RequestChangeFields.Select(field => field.RequestField).ToArray()));
                var update = new Entity(RequestEntity, request.Id);
                var summary = BuildRequestChangeSummary(activityLog, current, update);
                if (summary.Length == 0)
                    throw new InvalidPluginExecutionException("No Request values were changed.");

                systemService.Update(update);
                var auditUpdate = new Entity(ActivityLogEntity, activityLogId);
                auditUpdate["new_changesummary"] = summary;
                systemService.Update(auditUpdate);
            }
            catch (FaultException<OrganizationServiceFault> ex) when (ex.Detail?.ErrorCode == ObjectDoesNotExist)
            {
                throw new InvalidPluginExecutionException("The related Request no longer exists. Select an existing Request.", ex);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new InvalidPluginExecutionException(
                    "The Request changes could not be applied. No changes were made.", ex);
            }

            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Make Changes to Request succeeded. Request={0}", request.Id);
        }

        private static string BuildRequestChangeSummary(Entity activityLog, Entity current, Entity update)
        {
            var sections = new List<string>();
            foreach (var field in RequestChangeFields)
            {
                var before = NormalizeChangeValue(current.GetAttributeValue<object>(field.RequestField));
                var submitted = activityLog.GetAttributeValue<object>(field.ActivityLogField);
                var after = NormalizeChangeValue(submitted);
                if (Equals(before, after))
                    continue;

                update[field.RequestField] = after == null ? null : submitted;
                sections.Add(field.DisplayLabel + "\nBefore: " + FormatChangeValue(before, "[blank]")
                    + "\nAfter: " + FormatChangeValue(after, "[cleared]"));
            }

            return string.Join("\n\n", sections);
        }

        private static object NormalizeChangeValue(object value)
        {
            if (value is string text)
                return text.Length == 0 ? null : text.Replace("\r\n", "\n").Replace('\r', '\n');

            return value;
        }

        private static string FormatChangeValue(object value, string blankLabel)
        {
            return value == null ? blankLabel : Convert.ToString(value, CultureInfo.InvariantCulture);
        }

        private static void ApplySetAdminLead(Entity activityLog, IOrganizationService service, ITracingService tracing)
        {
            ActivityLog_Create_ValidateActivityType.ValidateSetAdminLead(activityLog);

            var request = activityLog.GetAttributeValue<EntityReference>(RequestLookupField);
            var adminLead = activityLog.GetAttributeValue<EntityReference>(AdminLeadLookupField);
            var requestUpdate = new Entity(RequestEntity, request.Id);
            requestUpdate[AdminLeadLookupField] = adminLead;
            service.Update(requestUpdate);

            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Set Admin Lead succeeded. Request={0}, AdminLead={1}", request.Id, adminLead.Id);
        }

        private static void ApplyProgressToStep(Entity activityLog, IOrganizationService service, ITracingService tracing)
        {
            var reviewRef = activityLog.GetAttributeValue<EntityReference>(ReviewLookupField);
            var requestRef = activityLog.GetAttributeValue<EntityReference>(RequestLookupField);
            var step = activityLog.GetAttributeValue<OptionSetValue>(TargetStepField);

            tracing?.Trace(
                "ActivityLog_Create_ApplyActivityType: Progress parsed. ReviewRef={0}, RequestRef={1}, Step={2}",
                FormatReference(reviewRef),
                FormatReference(requestRef),
                step != null ? step.Value.ToString(CultureInfo.InvariantCulture) : "(null)"
            );

            if (reviewRef != null)
            {
                var reviewUpdate = new Entity(ReviewEntity, reviewRef.Id);
                if (step != null)
                    reviewUpdate[ReviewStepField] = new OptionSetValue(step.Value);

                reviewUpdate[ReviewReadyForReviewField] = false;
                service.Update(reviewUpdate);
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Progress Review update succeeded.");
            }
            else
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Progress Review lookup missing; skipping Review update.");
            }

            if (requestRef != null)
            {
                var requestUpdate = new Entity(RequestEntity, requestRef.Id);
                if (step != null)
                {
                    requestUpdate[RequestStepField] = new OptionSetValue(step.Value);

                    if (ShouldClearFinalBusinessCaseSubmission(step.Value))
                    {
                        requestUpdate[RequestFinalBusinessCaseSubmittedField] = false;
                        requestUpdate[RequestFinalBusinessCaseSubmittedDateField] = null;
                        tracing?.Trace(
                            "ActivityLog_Create_ApplyActivityType: Progress target requires Final Business Case resubmission; submission flag and date cleared."
                        );
                    }
                }

                requestUpdate[RequestReadyForReviewField] = false;
                service.Update(requestUpdate);
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Progress Request update succeeded.");
            }
            else
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Progress Request lookup missing; skipping Request update.");
            }
        }

        private static bool ShouldClearFinalBusinessCaseSubmission(int step)
        {
            switch (step)
            {
                case DraftStep:
                case IntakeRequestReviewStep:
                case DraftBusinessCaseStep:
                case GrtMeetingStep:
                case FinalBusinessCaseStep:
                    return true;
                default:
                    return false;
            }
        }

        private static void ApplyIssueLifecycleId(Entity activityLog, IOrganizationService service, ITracingService tracing)
        {
            var reviewRef = activityLog.GetAttributeValue<EntityReference>(ReviewLookupField);
            var requestRef = activityLog.GetAttributeValue<EntityReference>(RequestLookupField);
            var mode = activityLog.GetAttributeValue<OptionSetValue>(LifecycleIdModeField);

            tracing?.Trace(
                "ActivityLog_Create_ApplyActivityType: Issue LCID parsed. ReviewRef={0}, RequestRef={1}, LifecycleMode={2}",
                FormatReference(reviewRef),
                FormatReference(requestRef),
                mode != null ? mode.Value.ToString(CultureInfo.InvariantCulture) : "(null)"
            );

            if (reviewRef == null)
                throw new InvalidPluginExecutionException("Issue Lifecycle ID requires an Admin Review.");

            if (requestRef == null)
                throw new InvalidPluginExecutionException("Issue Lifecycle ID requires a Request.");

            if (mode == null)
                throw new InvalidPluginExecutionException("Issue Lifecycle ID requires a lifecycle ID selection.");

            var lcidRef = mode.Value == LifecycleIdModeCreateNew
                ? CreateLifecycleId(activityLog, service, tracing)
                : GetExistingLifecycleId(activityLog, service, tracing);

            var now = DateTime.UtcNow;

            var priorRequestStep = RetrieveCurrentStep(service, RequestEntity, requestRef.Id, RequestStepField, tracing);
            var priorReviewStep = RetrieveCurrentStep(service, ReviewEntity, reviewRef.Id, ReviewStepField, tracing);

            var requestUpdate = new Entity(RequestEntity, requestRef.Id);
            requestUpdate[RequestStepField] = new OptionSetValue(FinishedStep);
            if (priorRequestStep != null && priorRequestStep.Value != FinishedStep)
                requestUpdate[RequestStepWhenClosedField] = priorRequestStep;
            requestUpdate[RequestDecisionDateField] = now;
            requestUpdate[RequestDecisionField] = new OptionSetValue(IssueLifecycleIdDecision);
            requestUpdate[RequestLcidField] = lcidRef;
            CopyIfPresent(activityLog, requestUpdate, NextStepsField, RequestNextStepsField);
            requestUpdate[RequestReadyForReviewField] = false;
            requestUpdate[RequestStatusField] = new OptionSetValue(RequestStatusClosed);
            service.Update(requestUpdate);
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Issue LCID Request update succeeded.");

            var reviewUpdate = new Entity(ReviewEntity, reviewRef.Id);
            reviewUpdate[ReviewStepField] = new OptionSetValue(FinishedStep);
            if (priorReviewStep != null && priorReviewStep.Value != FinishedStep)
                reviewUpdate[ReviewStepWhenClosedField] = priorReviewStep;
            reviewUpdate[ReviewDecisionField] = new OptionSetValue(IssueLifecycleIdDecision);
            reviewUpdate[ReviewDecisionDateField] = now;
            reviewUpdate[ReviewLcidField] = lcidRef;
            reviewUpdate[ReviewReadyForReviewField] = false;
            reviewUpdate[ReviewCompleteField] = new OptionSetValue(ReviewCompleteYes);
            service.Update(reviewUpdate);
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Issue LCID Review update succeeded.");
        }

        private static void ApplyFinalDecision(
            Entity activityLog,
            IOrganizationService service,
            ITracingService tracing,
            int requestDecision,
            int reviewDecision,
            string actionName)
        {
            var reviewRef = activityLog.GetAttributeValue<EntityReference>(ReviewLookupField);
            var requestRef = activityLog.GetAttributeValue<EntityReference>(RequestLookupField);
            var now = DateTime.UtcNow;

            EnsureReviewAndRequest(actionName, reviewRef, requestRef);

            var priorRequestStep = RetrieveCurrentStep(service, RequestEntity, requestRef.Id, RequestStepField, tracing);
            var priorReviewStep = RetrieveCurrentStep(service, ReviewEntity, reviewRef.Id, ReviewStepField, tracing);

            var requestUpdate = new Entity(RequestEntity, requestRef.Id);
            requestUpdate[RequestStepField] = new OptionSetValue(FinishedStep);
            if (priorRequestStep != null && priorRequestStep.Value != FinishedStep)
                requestUpdate[RequestStepWhenClosedField] = priorRequestStep;
            requestUpdate[RequestDecisionDateField] = now;
            requestUpdate[RequestDecisionField] = new OptionSetValue(requestDecision);
            CopyIfPresent(activityLog, requestUpdate, ClosingReasonField, "cr3ee_decisionreason");
            CopyIfPresent(activityLog, requestUpdate, NextStepsField, RequestNextStepsField);
            requestUpdate[RequestReadyForReviewField] = false;
            requestUpdate[RequestStatusField] = new OptionSetValue(RequestStatusClosed);
            service.Update(requestUpdate);
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: {0} Request update succeeded.", actionName);

            var reviewUpdate = new Entity(ReviewEntity, reviewRef.Id);
            reviewUpdate[ReviewStepField] = new OptionSetValue(FinishedStep);
            if (priorReviewStep != null && priorReviewStep.Value != FinishedStep)
                reviewUpdate[ReviewStepWhenClosedField] = priorReviewStep;
            reviewUpdate[ReviewDecisionField] = new OptionSetValue(reviewDecision);
            reviewUpdate[ReviewDecisionDateField] = now;
            reviewUpdate[ReviewReadyForReviewField] = false;
            reviewUpdate[ReviewCompleteField] = new OptionSetValue(ReviewCompleteYes);
            service.Update(reviewUpdate);
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: {0} Review update succeeded.", actionName);
        }

        private static void ApplyReopenRequest(Entity activityLog, IOrganizationService service, ITracingService tracing)
        {
            var reviewRef = activityLog.GetAttributeValue<EntityReference>(ReviewLookupField);
            var requestRef = activityLog.GetAttributeValue<EntityReference>(RequestLookupField);

            EnsureReviewAndRequest("Re-open Request", reviewRef, requestRef);

            var priorRequestStep = RetrieveCurrentStep(service, RequestEntity, requestRef.Id, RequestStepWhenClosedField, tracing);
            var priorReviewStep = RetrieveCurrentStep(service, ReviewEntity, reviewRef.Id, ReviewStepWhenClosedField, tracing);

            var requestUpdate = new Entity(RequestEntity, requestRef.Id);
            requestUpdate[RequestStepField] = priorRequestStep ?? new OptionSetValue(DraftStep);
            requestUpdate[RequestStepWhenClosedField] = null;
            requestUpdate[RequestDecisionDateField] = null;
            requestUpdate[RequestDecisionField] = null;
            requestUpdate["cr3ee_decisionreason"] = null;
            requestUpdate[RequestNextStepsField] = null;
            requestUpdate[RequestReadyForReviewField] = false;
            requestUpdate[RequestStatusField] = new OptionSetValue(RequestStatusDraft);
            service.Update(requestUpdate);
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Re-open Request update succeeded.");

            var reviewUpdate = new Entity(ReviewEntity, reviewRef.Id);
            reviewUpdate[ReviewStepField] = priorReviewStep ?? new OptionSetValue(DraftStep);
            reviewUpdate[ReviewStepWhenClosedField] = null;
            reviewUpdate[ReviewDecisionField] = null;
            reviewUpdate[ReviewDecisionDateField] = null;
            reviewUpdate[ReviewReadyForReviewField] = false;
            reviewUpdate[ReviewCompleteField] = new OptionSetValue(ReviewCompleteNo);
            service.Update(reviewUpdate);
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Re-open Review update succeeded.");
        }

        private static EntityReference CreateLifecycleId(Entity activityLog, IOrganizationService service, ITracingService tracing)
        {
            var rawLcid = GenerateNextLifecycleIdName(service, tracing);
            var lcid = new Entity(LcidEntity);

            lcid[LcidRawLcidField] = rawLcid;
            CopyIfPresent(activityLog, lcid, ProjectCostBaselineField, LcidCostBaselineField);
            CopyIfPresent(activityLog, lcid, ExpirationDateField, LcidExpiresAtField);
            lcid[LcidIssuedAtField] = DateTime.UtcNow;
            lcid[LcidStatusField] = new OptionSetValue(LcidStatusIssued);
            CopyIfPresent(activityLog, lcid, ScopeField, LcidScopeField);
            CopyIfPresent(activityLog, lcid, LcidTypeField, LcidTypeField);
            CopyIfPresent(activityLog, lcid, LcidIsLowItField, LcidIsLowItField);
            CopyIfPresent(activityLog, lcid, LcidIsShortenedField, LcidIsShortenedField);
            CopyIfPresent(activityLog, lcid, LcidComponentField, LcidComponentField);
            lcid[LcidNameField] = LifecycleIdDisplayName.Build(lcid) ?? rawLcid;

            var adminTeamRef = TryGetAdminTeam(service, tracing);
            if (adminTeamRef != null)
                lcid["ownerid"] = adminTeamRef;

            var lcidId = service.Create(lcid);
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Created LCID {0} with raw LCID {1}.", lcidId, rawLcid);

            return new EntityReference(LcidEntity, lcidId);
        }

        private static EntityReference GetExistingLifecycleId(Entity activityLog, IOrganizationService service, ITracingService tracing)
        {
            var lcidRef = activityLog.GetAttributeValue<EntityReference>(ExistingLcidLookupField);
            if (lcidRef == null)
                throw new InvalidPluginExecutionException("Issue Lifecycle ID requires an existing Lifecycle ID when using an existing Lifecycle ID.");

            service.Retrieve(LcidEntity, lcidRef.Id, new ColumnSet(LcidNameField));
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Existing LCID validated: {0}.", lcidRef.Id);
            return new EntityReference(LcidEntity, lcidRef.Id);
        }

        private static string GenerateNextLifecycleIdName(IOrganizationService service, ITracingService tracing)
        {
            var prefix = GenerateLifecycleIdPrefix(GetEasternNow());
            var matchingLcidCount = 0;
            var pageNumber = 1;
            var pagingCookie = string.Empty;

            while (true)
            {
                var query = new QueryExpression(LcidEntity);
                query.ColumnSet = new ColumnSet(LcidRawLcidField);
                query.Criteria.AddCondition(LcidRawLcidField, ConditionOperator.Like, prefix + "%");
                query.PageInfo = new PagingInfo
                {
                    Count = 5000,
                    PageNumber = pageNumber,
                    PagingCookie = pagingCookie
                };

                var results = service.RetrieveMultiple(query);
                matchingLcidCount += results.Entities.Count;

                if (!results.MoreRecords)
                    break;

                pageNumber++;
                pagingCookie = results.PagingCookie;
            }

            if (matchingLcidCount > 99)
                throw new InvalidPluginExecutionException("The daily LCID limit has been reached. The EASi LCID format supports at most 100 generated LCIDs per Eastern calendar day.");

            var nextName = prefix + matchingLcidCount.ToString("00", CultureInfo.InvariantCulture);
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Generated next raw LCID {0}.", nextName);
            return nextName;
        }

        private static string GenerateLifecycleIdPrefix(DateTime easternNow)
        {
            return easternNow.ToString("yy", CultureInfo.InvariantCulture)
                + easternNow.DayOfYear.ToString("000", CultureInfo.InvariantCulture);
        }

        private static DateTime GetEasternNow()
        {
            try
            {
                var eastern = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, eastern);
            }
            catch (TimeZoneNotFoundException)
            {
                return DateTime.UtcNow;
            }
            catch (InvalidTimeZoneException)
            {
                return DateTime.UtcNow;
            }
        }

        private static EntityReference TryGetAdminTeam(IOrganizationService service, ITracingService tracing)
        {
            var query = new QueryExpression(TeamEntity);
            query.ColumnSet = new ColumnSet(TeamNameField);
            query.Criteria.AddCondition(TeamNameField, ConditionOperator.Equal, AdminTeamName);
            query.TopCount = 1;

            var teams = service.RetrieveMultiple(query);
            if (teams.Entities.Count == 0)
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Admin team '{0}' not found. LCID will use default owner.", AdminTeamName);
                return null;
            }

            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Admin team found: {0}.", teams.Entities[0].Id);
            return new EntityReference(TeamEntity, teams.Entities[0].Id);
        }

        private static OptionSetValue RetrieveCurrentStep(IOrganizationService service, string entityName, Guid id, string stepField, ITracingService tracing)
        {
            var current = service.Retrieve(entityName, id, new ColumnSet(stepField));
            var step = current.GetAttributeValue<OptionSetValue>(stepField);
            tracing?.Trace(
                "ActivityLog_Create_ApplyActivityType: Prior {0}.{1} = {2}.",
                entityName,
                stepField,
                step != null ? step.Value.ToString(CultureInfo.InvariantCulture) : "(null)"
            );
            return step;
        }

        private static void CopyIfPresent(Entity source, Entity destination, string sourceField, string destinationField)
        {
            if (source.Attributes.Contains(sourceField))
                destination[destinationField] = source[sourceField];
        }

        private static void EnsureReviewAndRequest(string actionName, EntityReference reviewRef, EntityReference requestRef)
        {
            if (reviewRef == null)
                throw new InvalidPluginExecutionException(actionName + " requires an Admin Review.");

            if (requestRef == null)
                throw new InvalidPluginExecutionException(actionName + " requires a Request.");
        }

        private static string FormatReference(EntityReference reference)
        {
            return reference == null ? "(null)" : reference.LogicalName + ":" + reference.Id;
        }
    }
}
