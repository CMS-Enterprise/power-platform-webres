using System;
using System.Text;
using Microsoft.Xrm.Sdk;

namespace LCIDActivityLogs
{
    public class LcidUpdateCreateActivityLog : IPlugin
    {
        private const string LcidEntity = "cr69a_lifecycleids";
        private const string LcidActivityLogEntity = "new_lcidactivitylog";

        private const string LogLcidLookupField = "new_lcid";
        private const string LogAdditionalInformation = "new_additionalinformation";
        private const string LogActivityDescription = "new_action";
        private const string LogActivityType = "new_activitytype";

        private const int ActivityTypeUpdate = 100000002;

        private const string ScopeField = "cr3ee_scope";
        private const string CostBaseline = "cr3ee_costbaseline";

        private const string RetiresAtField = "cr69a_retiresat";
        private const string ExpirationDateField = "cr69a_lcidexpiresat";

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = serviceFactory.CreateOrganizationService(context.UserId);

            try
            {
                if (context.MessageName != "Update")
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

                if (target.LogicalName != LcidEntity)
                {
                    tracing.Trace($"Unexpected entity: {target.LogicalName}");
                    return;
                }

                var changes = new StringBuilder();

                AppendIfPresent(target, changes, RetiresAtField, "Retires At");
                AppendIfPresent(target, changes, ExpirationDateField, "Expiration Date");
                AppendIfPresent(target, changes, ScopeField, "Scope");
                AppendIfPresent(target, changes, CostBaseline, "Cost Baseline");

                if (changes.Length == 0)
                {
                    tracing.Trace("No tracked LCID fields changed. Exiting.");
                    return;
                }

                var log = new Entity(LcidActivityLogEntity);
                log[LogLcidLookupField] = new EntityReference(LcidEntity, target.Id);
                log[LogActivityType] = new OptionSetValue(ActivityTypeUpdate);
                log[LogActivityDescription] = "Update";
                log[LogAdditionalInformation] = changes.ToString().Trim();

                service.Create(log);

                tracing.Trace($"Created LCID activity log for LCID {target.Id}");
            }
            catch (Exception ex)
            {
                tracing.Trace("Plugin failed: " + ex);
                throw new InvalidPluginExecutionException("Error creating LCID activity log.", ex);
            }
        }

        private static void AppendIfPresent(Entity target, StringBuilder changes, string fieldName, string label)
        {
            if (!target.Contains(fieldName))
                return;

            var value = target[fieldName];
            changes.AppendLine($"{label}: {FormatValue(value)}");
        }

        private static string FormatValue(object value)
        {
            if (value == null)
                return "(cleared)";

            if (value is DateTime dt)
                return dt.ToString("yyyy-MM-dd");

            if (value is bool b)
                return b ? "Yes" : "No";

            if (value is OptionSetValue optionSetValue)
                return optionSetValue.Value.ToString();

            if (value is Money money)
                return money.Value.ToString("0.##");

            if (value is string s)
                return TrimIfTooLong(s);

            return value.ToString();
        }

        private static string TrimIfTooLong(string input)   
        {
            if (string.IsNullOrWhiteSpace(input))
                return "(empty)";

            const int maxLength = 500;
            return input.Length > maxLength
                ? input.Substring(0, maxLength) + "...(truncated)"
                : input;
        }
    }
}