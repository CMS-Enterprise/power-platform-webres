using System;
using System.Collections.Generic;
using System.Globalization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace SystemIntake.Plugins
{
    internal static class LifecycleIdDisplayName
    {
        internal const string EntityName = "cr69a_lifecycleids";
        internal const string NameField = "cr69a_lcid";
        internal const string RawLcidField = "cr3ee_rawlcid";
        internal const string ComponentField = "new_lcidcomponent";
        internal const string TypeField = "new_lcidtype";
        internal const string IsShortenedField = "new_lcidisshortened";
        internal const string IsLowItField = "new_lcidislowit";

        private static readonly string[] DisplaySourceFields =
        {
            RawLcidField,
            ComponentField,
            TypeField,
            IsShortenedField,
            IsLowItField
        };

        internal static string Build(Entity values)
        {
            var rawLcid = GetText(values, RawLcidField);
            if (string.IsNullOrWhiteSpace(rawLcid))
                rawLcid = GetText(values, NameField);

            if (string.IsNullOrWhiteSpace(rawLcid))
                return null;

            var parts = new List<string> { rawLcid.Trim() };
            AddIfPresent(parts, NormalizeGenericSegment(GetDisplayText(values, ComponentField)));
            AddIfPresent(parts, NormalizeTypeSegment(GetDisplayText(values, TypeField)));

            if (GetBoolean(values, IsShortenedField))
                parts.Add("S");

            if (GetBoolean(values, IsLowItField))
                parts.Add("L");

            return string.Join("-", parts);
        }

        internal static Entity BuildValueSnapshot(Entity target, Entity existing)
        {
            var values = new Entity(EntityName, target.Id);

            foreach (var field in DisplaySourceFields)
                CopyValue(field, target, existing, values);

            CopyValue(NameField, target, existing, values);

            return values;
        }

        internal static ColumnSet ColumnSet()
        {
            return new ColumnSet(DisplaySourceFields);
        }

        private static void CopyValue(string field, Entity target, Entity existing, Entity values)
        {
            if (target != null && target.Contains(field))
            {
                values[field] = target[field];
                CopyFormattedValue(field, target, values);
                return;
            }

            if (existing != null && existing.Contains(field))
            {
                values[field] = existing[field];
                CopyFormattedValue(field, existing, values);
            }
        }

        private static void CopyFormattedValue(string field, Entity source, Entity destination)
        {
            if (source != null && source.FormattedValues.Contains(field))
                destination.FormattedValues[field] = source.FormattedValues[field];
        }

        private static void AddIfPresent(List<string> parts, string value)
        {
            if (!string.IsNullOrWhiteSpace(value))
                parts.Add(value);
        }

        private static string GetText(Entity values, string field)
        {
            if (values == null || !values.Contains(field) || values[field] == null)
                return null;

            return values[field] as string ?? values[field].ToString();
        }

        private static string GetDisplayText(Entity values, string field)
        {
            if (values == null || !values.Contains(field) || values[field] == null)
                return null;

            if (values.FormattedValues.Contains(field))
                return values.FormattedValues[field];

            if (values[field] is EntityReference reference)
                return reference.Name;

            if (values[field] is OptionSetValue option)
                return option.Value.ToString(CultureInfo.InvariantCulture);

            return values[field] as string ?? values[field].ToString();
        }

        private static bool GetBoolean(Entity values, string field)
        {
            if (values == null || !values.Contains(field) || values[field] == null)
                return false;

            if (values[field] is bool boolean)
                return boolean;

            return false;
        }

        private static string NormalizeGenericSegment(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            return value.Trim().Replace(" ", "_").ToUpperInvariant();
        }

        private static string NormalizeTypeSegment(string value)
        {
            var normalized = NormalizeGenericSegment(value);
            if (string.IsNullOrWhiteSpace(normalized))
                return null;

            if (string.Equals(normalized, "NEW_SYSTEM", StringComparison.OrdinalIgnoreCase))
                return "NEW";

            if (string.Equals(normalized, "RECOMPETE", StringComparison.OrdinalIgnoreCase))
                return "RC";

            return normalized;
        }
    }
}
