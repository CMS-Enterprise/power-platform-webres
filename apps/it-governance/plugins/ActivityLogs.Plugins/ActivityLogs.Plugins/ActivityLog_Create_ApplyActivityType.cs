using System;
using System.Globalization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace SystemIntake.Plugins
{
    public class ActivityLog_Create_ApplyActivityType : IPlugin
    {
        private const string ActivityLogEntity = "new_activitylogs";
        private const int PostOperationStage = 40;

        private const string ActivityTypeField = "cr3ee_activitytype";
        private const string TargetStepField = "new_process_target_step";
        private const string ReviewLookupField = "new_adminreview";
        private const string RequestLookupField = "new_systemintake";
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

        private const string RequestEntity = "new_systemintake";
        private const string RequestStepField = "new_admingovernanceprocessstep";
        private const string RequestReadyForReviewField = "cr69a_readyforreview";
        private const string RequestDecisionDateField = "cr3ee_decisiondate";
        private const string RequestDecisionField = "easi_decision";
        private const string RequestLcidField = "cr69a_lcid";
        private const string RequestNextStepsField = "cr3ee_nextsteps";
        private const string RequestStatusField = "cr69a_status";

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

        private const int LifecycleIdModeCreateNew = 216640000;
        private const int LifecycleIdModeUseExisting = 216640001;

        private const int FinishedStep = 971270009;
        private const int DraftStep = 971270006;
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

                var activityType = target.GetAttributeValue<OptionSetValue>(ActivityTypeField);
                if (activityType == null)
                {
                    tracing?.Trace("ActivityLog_Create_ApplyActivityType: No activity type provided ({0}). Exiting.", ActivityTypeField);
                    return;
                }

                tracing?.Trace("ActivityLog_Create_ApplyActivityType: ActivityType={0}", activityType.Value);

                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
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
                    requestUpdate[RequestStepField] = new OptionSetValue(step.Value);

                requestUpdate[RequestReadyForReviewField] = false;
                service.Update(requestUpdate);
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Progress Request update succeeded.");
            }
            else
            {
                tracing?.Trace("ActivityLog_Create_ApplyActivityType: Progress Request lookup missing; skipping Request update.");
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

            var requestUpdate = new Entity(RequestEntity, requestRef.Id);
            requestUpdate[RequestStepField] = new OptionSetValue(FinishedStep);
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

            var requestUpdate = new Entity(RequestEntity, requestRef.Id);
            requestUpdate[RequestStepField] = new OptionSetValue(FinishedStep);
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

            var requestUpdate = new Entity(RequestEntity, requestRef.Id);
            requestUpdate[RequestStepField] = new OptionSetValue(DraftStep);
            requestUpdate[RequestDecisionDateField] = null;
            requestUpdate[RequestDecisionField] = null;
            requestUpdate["cr3ee_decisionreason"] = null;
            requestUpdate[RequestNextStepsField] = null;
            requestUpdate[RequestReadyForReviewField] = false;
            requestUpdate[RequestStatusField] = new OptionSetValue(RequestStatusDraft);
            service.Update(requestUpdate);
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Re-open Request update succeeded.");

            var reviewUpdate = new Entity(ReviewEntity, reviewRef.Id);
            reviewUpdate[ReviewStepField] = new OptionSetValue(DraftStep);
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
            CopyIfPresent(activityLog, lcid, ProjectCostBaselineField, LcidCostBaselineField, service, tracing);
            CopyIfPresent(activityLog, lcid, ExpirationDateField, LcidExpiresAtField, service, tracing);
            lcid[LcidIssuedAtField] = DateTime.UtcNow;
            lcid[LcidStatusField] = new OptionSetValue(LcidStatusIssued);
            CopyIfPresent(activityLog, lcid, ScopeField, LcidScopeField, service, tracing);
            CopyIfPresent(activityLog, lcid, LcidTypeField, LcidTypeField, service, tracing);
            CopyIfPresent(activityLog, lcid, LcidIsLowItField, LcidIsLowItField, service, tracing);
            CopyIfPresent(activityLog, lcid, LcidIsShortenedField, LcidIsShortenedField, service, tracing);
            CopyIfPresent(activityLog, lcid, LcidComponentField, LcidComponentField, service, tracing);
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

            if (matchingLcidCount > 9)
                throw new InvalidPluginExecutionException("The daily LCID limit has been reached. The EASi LCID format supports at most 10 generated LCIDs per Eastern calendar day.");

            var nextName = prefix + matchingLcidCount.ToString(CultureInfo.InvariantCulture);
            tracing?.Trace("ActivityLog_Create_ApplyActivityType: Generated next LCID name {0}.", nextName);
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

        private static void CopyIfPresent(
            Entity source,
            Entity destination,
            string sourceField,
            string destinationField,
            IOrganizationService service,
            ITracingService tracing)
        {
            if (source.Attributes.Contains(sourceField))
            {
                var mappedValue = ChoiceValueMapper.MapIfChoice(
                    service,
                    ActivityLogEntity,
                    sourceField,
                    LcidEntity,
                    destinationField,
                    source[sourceField],
                    tracing);

                destination[destinationField] = mappedValue;
                if (source.FormattedValues.Contains(sourceField))
                    destination.FormattedValues[destinationField] = source.FormattedValues[sourceField];
                else
                {
                    var mappedLabel = ChoiceValueMapper.GetMappedChoiceLabel(service, LcidEntity, destinationField, mappedValue);
                    if (!string.IsNullOrWhiteSpace(mappedLabel))
                        destination.FormattedValues[destinationField] = mappedLabel;
                }
            }
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
