using System;
using Microsoft.Xrm.Sdk;

namespace LCIDActivityLogs
{
    public class LcidActivityLogCreate : IPlugin
    {
        private const string LcidActivityLogEntity = "new_lcidactivitylog";
        private const string LcidLookupField = "new_lcid";
        private const string ActivityTypeField = "new_activitytype";

        private const string ActivityLogLcidCostBaselineField = "new_lcidcostbaseline";
        private const string ActivityLogLcidScopeField = "new_lcidscope";
        private const string ActivityLogLcidExpirationDateField = "new_lcidexpirationdate";
        private const string ActivityLogLcidRetireDateField = "new_lcidretiredate";
        private const string ActivityLogLcidCostBaselineOldField = "new_lcidcostbaselineold";
        private const string ActivityLogLcidScopeOldField = "new_lcidscopeold";
        private const string ActivityLogLcidExpirationDateOldField = "new_lcidexpirationdateold";
        private const string ActivityLogLcidRetireDateOldField = "new_lcidretiredateold";

        private const string LcidEntity = "cr69a_lifecycleids";
        private const string LcidStatusField = "cr3ee_lcidstatus";
        private const string LcidRetiredAtField = "cr3ee_retiredat";
        private const string LcidCostBaselineField = "cr3ee_costbaseline";
        private const string LcidScopeField = "cr3ee_scope";
        private const string LcidExpirationDateField = "cr69a_lcidexpiresat";
        private const string LcidRetireDateField = "cr69a_retiresat";

        private const int ActivityTypeRetire = 100000000;
        private const int ActivityTypeUnretire = 100000001;

        private const int LcidStatusIssued = 216640000;
        private const int LcidStatusRetired = 216640002;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = serviceFactory.CreateOrganizationService(context.UserId);

            try
            {
                if (context.MessageName != "Create")
                    return;

                if (context.Depth > 1)
                {
                    tracing.Trace("Exiting due to depth > 1");
                    return;
                }

                if (!context.InputParameters.Contains("Target") ||
                    !(context.InputParameters["Target"] is Entity target))
                {
                    tracing.Trace("No target entity found.");
                    return;
                }

                if (target.LogicalName != LcidActivityLogEntity)
                {
                    tracing.Trace($"Unexpected entity: {target.LogicalName}");
                    return;
                }

                tracing.Trace("Processing LCID Activity Log create.");

                var lcidRef = target.GetAttributeValue<EntityReference>(LcidLookupField);
                if (lcidRef == null)
                {
                    tracing.Trace("No LCID reference found. Exiting.");
                    return;
                }

                var activityType = target.GetAttributeValue<OptionSetValue>(ActivityTypeField);
                if (activityType == null)
                {
                    tracing.Trace("No Activity Type found. Exiting.");
                    return;
                }

                tracing.Trace($"Activity Type value: {activityType.Value}");

                var lcidUpdate = new Entity(LcidEntity, lcidRef.Id);
                var shouldUpdate = false;

                if (activityType.Value == ActivityTypeRetire)
                {
                    lcidUpdate[LcidStatusField] = new OptionSetValue(LcidStatusRetired);
                    lcidUpdate[LcidRetiredAtField] = DateTime.UtcNow;
                    tracing.Trace("Setting LCID status to Retired and retired date to now.");
                    shouldUpdate = true;
                }
                else if (activityType.Value == ActivityTypeUnretire)
                {
                    lcidUpdate[LcidStatusField] = new OptionSetValue(LcidStatusIssued);
                    lcidUpdate[LcidRetiredAtField] = null;
                    tracing.Trace("Setting LCID status to Issued and clearing retired date.");
                    shouldUpdate = true;
                }
                else if (activityType.Value == ActivityTypeEdit)
                {
                    var currentLcid = service.Retrieve(
                        LcidEntity,
                        lcidRef.Id,
                        new ColumnSet(
                            LcidCostBaselineField,
                            LcidScopeField,
                            LcidExpirationDateField,
                            LcidRetireDateField));

                    shouldUpdate |= CopyEditFieldIfPresent(
                        target,
                        lcidUpdate,
                        ActivityLogLcidCostBaselineField,
                        ActivityLogLcidCostBaselineOldField,
                        LcidCostBaselineField,
                        currentLcid,
                        tracing);
                    shouldUpdate |= CopyEditFieldIfPresent(
                        target,
                        lcidUpdate,
                        ActivityLogLcidScopeField,
                        ActivityLogLcidScopeOldField,
                        LcidScopeField,
                        currentLcid,
                        tracing);
                    shouldUpdate |= CopyEditFieldIfPresent(
                        target,
                        lcidUpdate,
                        ActivityLogLcidExpirationDateField,
                        ActivityLogLcidExpirationDateOldField,
                        LcidExpirationDateField,
                        currentLcid,
                        tracing);
                    shouldUpdate |= CopyEditFieldIfPresent(
                        target,
                        lcidUpdate,
                        ActivityLogLcidRetireDateField,
                        ActivityLogLcidRetireDateOldField,
                        LcidRetireDateField,
                        currentLcid,
                        tracing);
                }
                else
                {
                    tracing.Trace($"Activity type {activityType.Value} not handled. Exiting.");
                    return;
                }

                var reason = target.GetAttributeValue<string>(ActivityLogReasonField);
                if (!string.IsNullOrWhiteSpace(reason))
                {
                    lcidUpdate[LcidReasonField] = reason;
                    tracing.Trace("Copying reason from activity log to LCID.");
                    shouldUpdate = true;
                }

                var additionalInformation = target.GetAttributeValue<string>(ActivityLogAdditionalInformationField);
                if (!string.IsNullOrWhiteSpace(additionalInformation))
                {
                    lcidUpdate[LcidAdditionalInformationField] = additionalInformation;
                    tracing.Trace("Copying additional information from activity log to LCID.");
                    shouldUpdate = true;
                }

                if (!shouldUpdate)
                {
                    tracing.Trace("No updates to apply to LCID.");
                    return;
                }

                service.Update(lcidUpdate);
                tracing.Trace($"Updated LCID {lcidRef.Id}");
            }
            catch (Exception ex)
            {
                tracing.Trace("Plugin failed: " + ex);
                throw new InvalidPluginExecutionException("Error in LCID Activity Log plugin.", ex);
            }
        }

        private static bool CopyEditFieldIfPresent(
            Entity activityLog,
            Entity lcidUpdate,
            string activityLogNewField,
            string activityLogOldField,
            string lcidField,
            Entity currentLcid,
            ITracingService tracing)
        {
            if (!activityLog.Contains(activityLogNewField))
                return false;

            activityLog[activityLogOldField] = currentLcid.GetAttributeValue<object>(lcidField);
            lcidUpdate[lcidField] = activityLog[activityLogNewField];
            tracing.Trace($"Snapshotting {lcidField} and copying {activityLogNewField} to the LCID.");
            return true;
        }

        private static void EnsureSynchronousPreOperation(IPluginExecutionContext context)
        {
            if (context.Stage == PreOperationStage && context.Mode == SynchronousMode)
                return;

            throw new InvalidPluginExecutionException(
                "LCID Activity Log plugin must be registered as synchronous PreOperation on Create of new_lcidactivitylog."
            );
        }
    }
}
