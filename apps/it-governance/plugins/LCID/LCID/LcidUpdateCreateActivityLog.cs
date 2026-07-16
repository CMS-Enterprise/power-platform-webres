using System;
using System.Text;
using Microsoft.Xrm.Sdk;

namespace LCIDActivityLogs
{
    public class LcidUpdateCreateActivityLog : IPlugin
    {
        private const string LcidEntity = "cr69a_lifecycleids";
        private const string LcidActivityLogEntity = "new_lcidactivitylog";
        private const string PreImageName = "PreImage";

        private const string LogLcidLookupField = "new_lcid";
        private const string LogAdditionalInformation = "new_additionalinformation";
        private const string LogActivityDescription = "new_action";
        private const string LogActivityType = "new_activitytype";
        private const string LogReason = "new_reason";
        private const string LogScopeField = "new_lcidscope";
        private const string LogScopeOldField = "new_lcidscopeold";
        private const string LogCostBaselineField = "new_lcidcostbaseline";
        private const string LogCostBaselineOldField = "new_lcidcostbaselineold";
        private const string LogRetiresAtField = "new_lcidretiredate";
        private const string LogRetiresAtOldField = "new_lcidretiredateold";
        private const string LogExpirationDateField = "new_lcidexpirationdate";
        private const string LogExpirationDateOldField = "new_lcidexpirationdateold";
        private const string LogTypeField = "new_lcidtype";
        private const string LogIsLowItField = "new_lcidislowit";
        private const string LogIsShortenedField = "new_lcidisshortened";
        private const string LogComponentField = "new_lcidcomponent";

        private const int ActivityTypeUpdate = 100000002;

        private const string ScopeField = "cr3ee_scope";
        private const string CostBaseline = "cr3ee_costbaseline";

        private const string RetiresAtField = "cr69a_retiresat";
        private const string ExpirationDateField = "cr69a_lcidexpiresat";
        private const string TypeField = "new_lcidtype";
        private const string IsLowItField = "new_lcidislowit";
        private const string IsShortenedField = "new_lcidisshortened";
        private const string ComponentField = "new_lcidcomponent";

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

                if (!ContainsTrackedField(target))
                {
                    tracing.Trace("No tracked LCID fields changed. Exiting.");
                    return;
                }

                if (!context.PreEntityImages.Contains(PreImageName))
                {
                    throw new InvalidPluginExecutionException(
                        $"The {PreImageName} pre-image is required for LCID update auditing.");
                }

                var preImage = context.PreEntityImages[PreImageName];
                var changes = new StringBuilder();
                var log = new Entity(LcidActivityLogEntity);

                AppendChangeIfPresent(target, preImage, log, changes, RetiresAtField, LogRetiresAtField, LogRetiresAtOldField, "Retires At", service, tracing);
                AppendChangeIfPresent(target, preImage, log, changes, ExpirationDateField, LogExpirationDateField, LogExpirationDateOldField, "Expiration Date", service, tracing);
                AppendChangeIfPresent(target, preImage, log, changes, ScopeField, LogScopeField, LogScopeOldField, "Scope", service, tracing);
                AppendChangeIfPresent(target, preImage, log, changes, CostBaseline, LogCostBaselineField, LogCostBaselineOldField, "Cost Baseline", service, tracing);
                AppendChangeIfPresent(target, preImage, log, changes, TypeField, LogTypeField, "LCID Type", service, tracing);
                AppendChangeIfPresent(target, preImage, log, changes, IsLowItField, LogIsLowItField, "Low IT", service, tracing);
                AppendChangeIfPresent(target, preImage, log, changes, IsShortenedField, LogIsShortenedField, "Shortened", service, tracing);
                AppendChangeIfPresent(target, preImage, log, changes, ComponentField, LogComponentField, "Component", service, tracing);

                if (changes.Length == 0)
                {
                    tracing.Trace("No tracked LCID fields changed. Exiting.");
                    return;
                }

                log[LogLcidLookupField] = new EntityReference(LcidEntity, target.Id);
                log[LogActivityType] = new OptionSetValue(ActivityTypeUpdate);
                log[LogActivityDescription] = "Update";
                log[LogReason] = "LCID fields updated directly.";
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

        private static bool ContainsTrackedField(Entity target)
        {
            return target.Contains(RetiresAtField) ||
                   target.Contains(ExpirationDateField) ||
                   target.Contains(ScopeField) ||
                   target.Contains(CostBaseline) ||
                   target.Contains(TypeField) ||
                   target.Contains(IsLowItField) ||
                   target.Contains(IsShortenedField) ||
                   target.Contains(ComponentField);
        }

        private static void AppendChangeIfPresent(
            Entity target,
            Entity preImage,
            Entity log,
            StringBuilder changes,
            string lcidField,
            string logNewField,
            string logOldField,
            string label,
            IOrganizationService service,
            ITracingService tracing)
        {
            if (!target.Contains(lcidField))
                return;

            var oldValue = preImage.GetAttributeValue<object>(lcidField);
            var newValue = target[lcidField];

            if (ValuesEqual(oldValue, newValue))
                return;

            log[logOldField] = ChoiceValueMapper.MapIfChoice(service, LcidEntity, lcidField, LcidActivityLogEntity, logOldField, oldValue, tracing);
            log[logNewField] = ChoiceValueMapper.MapIfChoice(service, LcidEntity, lcidField, LcidActivityLogEntity, logNewField, newValue, tracing);
            changes.AppendLine($"{label}: {FormatValue(oldValue)} -> {FormatValue(newValue)}");
        }

        private static void AppendChangeIfPresent(
            Entity target,
            Entity preImage,
            Entity log,
            StringBuilder changes,
            string lcidField,
            string logNewField,
            string label,
            IOrganizationService service,
            ITracingService tracing)
        {
            if (!target.Contains(lcidField))
                return;

            var oldValue = preImage.GetAttributeValue<object>(lcidField);
            var newValue = target[lcidField];

            if (ValuesEqual(oldValue, newValue))
                return;

            log[logNewField] = ChoiceValueMapper.MapIfChoice(service, LcidEntity, lcidField, LcidActivityLogEntity, logNewField, newValue, tracing);
            changes.AppendLine($"{label}: {FormatValue(oldValue)} -> {FormatValue(newValue)}");
        }

        private static bool ValuesEqual(object oldValue, object newValue)
        {
            if (oldValue == null || newValue == null)
                return oldValue == null && newValue == null;

            if (oldValue is OptionSetValue oldOption && newValue is OptionSetValue newOption)
                return oldOption.Value == newOption.Value;

            if (oldValue is Money oldMoney && newValue is Money newMoney)
                return oldMoney.Value == newMoney.Value;

            if (oldValue is EntityReference oldReference && newValue is EntityReference newReference)
            {
                return oldReference.LogicalName == newReference.LogicalName &&
                       oldReference.Id == newReference.Id;
            }

            return oldValue.Equals(newValue);
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
