using System;
using Microsoft.Xrm.Sdk;

namespace LCIDActivityLogs
{
    public class LcidActivityLogCreate : IPlugin
    {
        private const string LcidActivityLogEntity = "new_lcidactivitylog";
        private const string LcidLookupField = "new_lcid";
        private const string ActivityTypeField = "new_activitytype";

        private const string ActivityLogReasonField = "new_reason";
        private const string ActivityLogAdditionalInformationField = "new_additionalinformation";

        private const string LcidEntity = "cr69a_lifecycleids";
        private const string LcidStatusField = "cr3ee_lcidstatus";
        private const string LcidRetiredAtField = "cr3ee_retiredat";
        private const string LcidReasonField = "new_reason";
        private const string LcidAdditionalInformationField = "new_additionalinformation";

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
    }
}