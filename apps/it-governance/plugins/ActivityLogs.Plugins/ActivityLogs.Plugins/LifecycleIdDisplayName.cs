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
            {
                var existingName = GetText(values, NameField);
                return string.IsNullOrWhiteSpace(existingName) ? null : existingName.Trim();
            }

            var parts = new List<string> { rawLcid.Trim() };
            AddIfPresent(parts, GetComponentAcronym(values));
            AddIfPresent(parts, GetTypeAbbreviation(values));

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
            var columns = new ColumnSet(DisplaySourceFields);
            columns.AddColumn(NameField);
            return columns;
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

            if (values.FormattedValues.Contains(field))
            {
                var label = NormalizeGenericSegment(values.FormattedValues[field]);
                if (string.Equals(label, "YES", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(label, "TRUE", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (string.Equals(label, "NO", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(label, "FALSE", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
            }

            if (values[field] is OptionSetValue option)
                return option.Value == 1 || option.Value == 100000000;

            return false;
        }

        private static string GetComponentAcronym(Entity values)
        {
            if (values == null || !values.Contains(ComponentField) || values[ComponentField] == null)
                return null;

            if (values[ComponentField] is OptionSetValue option)
            {
                switch (option.Value)
                {
                    case 971270000: return "CCSQ";
                    case 971270001: return "CCIIO";
                    case 971270002: return "CM";
                    case 971270003: return "CMCS";
                    case 971270004: return "CMMI";
                    case 971270005: return "OFM";
                    case 971270006: return "OIT";
                    case 971270007: return "OL";
                    case 971270008: return "CPI";
                    case 971270009: return "CMS";
                    case 971270010: return "EPRO";
                    case 971270011: return "FCHCO";
                    case 971270012: return "OAGM";
                    case 971270013: return "OHEI";
                    case 971270014: return "OC";
                    case 971270015: return "OEDA";
                    case 971270016: return "OEOCR";
                    case 971270017: return "OHC";
                    case 971270018: return "OMH";
                    case 971270019: return "OPOLE";
                    case 971270020: return "OSFLO";
                    case 971270021: return "OSORA";
                    case 971270022: return "OSPR";
                    case 971270023: return "OACT";
                    case 971270024: return "OA";
                    case 971270025: return "OHI";
                    case 971270026: return "OTHER";
                    case 971270027: return "CMCH";
                    case 971270028: return "CMHPO";
                    case 971270029: return "OBRHI";
                    case 971270030: return "OSSO";
                    case 971270031:
                    case 216640001:
                        return null;
                }
            }

            return NormalizeGenericSegment(GetDisplayText(values, ComponentField));
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

        private static string GetTypeAbbreviation(Entity values)
        {
            if (values == null || !values.Contains(TypeField) || values[TypeField] == null)
                return null;

            if (values[TypeField] is OptionSetValue option)
            {
                switch (option.Value)
                {
                    case 100000000: return "NEW";
                    case 100000001: return "RC";
                }
            }

            return NormalizeTypeSegment(GetDisplayText(values, TypeField));
        }
    }
}
