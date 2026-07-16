using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;

namespace LCIDActivityLogs
{
    internal static class ChoiceValueMapper
    {
        internal static object MapIfChoice(
            IOrganizationService service,
            string sourceEntityName,
            string sourceFieldName,
            string targetEntityName,
            string targetFieldName,
            object sourceValue,
            ITracingService tracing)
        {
            var sourceChoice = sourceValue as OptionSetValue;
            if (sourceChoice == null)
                return sourceValue;

            var sourceMetadata = RetrievePicklistMetadata(service, sourceEntityName, sourceFieldName);
            var targetMetadata = RetrievePicklistMetadata(service, targetEntityName, targetFieldName);

            if (sourceMetadata == null || targetMetadata == null)
                return sourceValue;

            var sourceLabel = GetOptionLabel(sourceMetadata, sourceChoice.Value);
            if (string.IsNullOrWhiteSpace(sourceLabel))
                return sourceValue;

            var targetOption = targetMetadata.OptionSet.Options.FirstOrDefault(option =>
                string.Equals(GetOptionLabel(option), sourceLabel, StringComparison.OrdinalIgnoreCase));

            if (targetOption == null || !targetOption.Value.HasValue)
            {
                throw new InvalidPluginExecutionException(
                    $"Unable to map {sourceEntityName}.{sourceFieldName} choice '{sourceLabel}' to {targetEntityName}.{targetFieldName}.");
            }

            tracing?.Trace(
                "Mapped choice {0}.{1} value {2} ({3}) to {4}.{5} value {6}.",
                sourceEntityName,
                sourceFieldName,
                sourceChoice.Value,
                sourceLabel,
                targetEntityName,
                targetFieldName,
                targetOption.Value.Value);

            return new OptionSetValue(targetOption.Value.Value);
        }

        private static PicklistAttributeMetadata RetrievePicklistMetadata(
            IOrganizationService service,
            string entityName,
            string fieldName)
        {
            var request = new RetrieveAttributeRequest
            {
                EntityLogicalName = entityName,
                LogicalName = fieldName,
                RetrieveAsIfPublished = true
            };

            var response = (RetrieveAttributeResponse)service.Execute(request);
            return response.AttributeMetadata as PicklistAttributeMetadata;
        }

        private static string GetOptionLabel(PicklistAttributeMetadata metadata, int value)
        {
            var option = metadata.OptionSet.Options.FirstOrDefault(candidate => candidate.Value == value);
            return option == null ? null : GetOptionLabel(option);
        }

        private static string GetOptionLabel(OptionMetadata option)
        {
            if (option.Label == null)
                return null;

            if (option.Label.UserLocalizedLabel != null)
                return option.Label.UserLocalizedLabel.Label;

            var localizedLabel = option.Label.LocalizedLabels.FirstOrDefault();
            return localizedLabel == null ? null : localizedLabel.Label;
        }
    }
}
