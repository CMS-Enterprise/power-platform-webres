let
    Source = CommonDataService.Database("icpg-dev.crm9.dynamics.com"),
    #"Navigation 1" = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingcontact"]}[Data],
    // =========================================
    // Choice mapping specs
    // =========================================
    ChoiceSpecs = {
        [
            source = "cr69a_roles",
            dest = "roles_dataverse_format",
            map = [
                BUSINESS_OWNER = 100000000,
                PRODUCT_OWNER = 100000001,
                SYSTEM_OWNER = 100000002,
                SYSTEM_MAINTAINER = 100000003,
                CONTRACTING_OFFICERS_REPRESENTATIVE = 100000004,
                CLOUD_NAVIGATOR = 100000005,
                INFORMATION_SYSTEM_SECURITY_ADVISOR = 100000006,
                PRIVACY_ADVISOR = 100000007,
                CYBER_RISK_ADVISOR = 100000008,
                OTHER = 100000009,
                PRODUCT_MANAGER = 971270001,
                PROJECT_MANAGER = 971270002,
                SUBJECT_MATTER_EXPERT = 971270003,
                PLACE_HOLDER = 971270004
            ]
        ],
        [
            source = "cr69a_component",
            dest = "component_dataverse_format",
            map = [
                CENTER_FOR_CLINICAL_STANDARDS_AND_QUALITY_CCSQ = 971270000,
                CENTER_FOR_CONSUMER_INFORMATION_AND_INSURANCE_OVERSIGHT_CCIIO = 971270001,
                CENTER_FOR_MEDICARE_CM = 971270002,
                CENTER_FOR_MEDICAID_AND_CHIP_SERVICES_CMCS = 971270003,
                CENTER_FOR_MEDICARE_AND_MEDICAID_INNOVATION_CMMI = 971270004,
                OFFICE_OF_FINANCIAL_MANAGEMENT_OFM = 971270005,
                OFFICE_OF_INFORMATION_TECHNOLOGY_OIT = 971270006,
                OFFICE_OF_LEGISLATION = 971270007,
                CENTER_FOR_PROGRAM_INTEGRITY_CPI = 971270008,
                CMS_WIDE = 971270009,
                EMERGENCY_PREPAREDNESS_AND_RESPONSE_OPERATIONS_EPRO = 971270010,
                FEDERAL_COORDINATED_HEALTH_CARE_OFFICE = 971270011,
                OFFICE_OF_ACQUISITION_AND_GRANTS_MANAGEMENT_OAGM = 971270012,
                OFFICE_OF_HEALTHCARE_EXPERIENCE_AND_INTEROPERABILITY = 971270013,
                OFFICE_OF_COMMUNICATIONS_OC = 971270014,
                OFFICE_OF_ENTERPRISE_DATA_AND_ANALYTICS_OEDA = 971270015,
                OFFICE_OF_EQUAL_OPPORTUNITY_AND_CIVIL_RIGHTS = 971270016,
                OFFICE_OF_HUMAN_CAPITAL = 971270017,
                OFFICE_OF_MINORITY_HEALTH_OMH = 971270018,
                OFFICE_OF_PROGRAM_OPERATIONS_AND_LOCAL_ENGAGEMENT_OPOLE = 971270019,
                OFFICE_OF_SECURITY_FACILITIES_AND_LOGISTICS_OPERATIONS_OSFLO = 971270020,
                OFFICE_OF_STRATEGIC_OPERATIONS_AND_REGULATORY_AFFAIRS_OSORA = 971270021,
                OFFICE_OF_STRATEGY_PERFORMANCE_AND_RESULTS_OSPR = 971270022,
                OFFICE_OF_THE_ACTUARY_OACT = 971270023,
                OFFICE_OF_THE_ADMINISTRATOR = 971270024,
                OFFICES_OF_HEARINGS_AND_INQUIRIES = 971270025,
                OTHER = 971270026,
                CONSORTIUM_FOR_MEDICAID_AND_CHILDRENS_HEALTH = 971270027,
                CONSORTIUM_FOR_MEDICARE_HEALTH_PLANS_OPERATIONS = 971270028,
                OFFICE_OF_BURDEN_REDUCTION_AND_HEALTH_INFORMATICS = 971270029,
                OFFICE_OF_SUPPORT_SERVICES_AND_OPERATIONS = 971270030,
                PLACE_HOLDER = 971270031
            ]
        ]
    },
    // =========================================
    // Helper: normalize source text -> enum key
    // =========================================
    NormalizeChoiceKey = (v as any) as nullable text =>
        if v = null then
            null
        else
            let
                t0 = Text.From(v),
                t1 = Text.Upper(Text.Trim(t0)),
                t2 = Text.Replace(t1, " ", "_"),
                t3 = Text.Replace(t2, "(", ""),
                t4 = Text.Replace(t3, ")", ""),
                t5 = Text.Replace(t4, "-", "_"),
                t6 = Text.Replace(t5, "/", "_")
            in
                t6,
    // =========================================
    // Boolean cleaner
    // "TRUE", "Yes", "1" -> true
    // "FALSE", "No", "0" -> false
    // else -> null
    // =========================================
    NormalizeBoolean = (v as any) as nullable logical =>
        if v = null then
            null
        else
            let
                t = Text.Upper(Text.Trim(Text.From(v)))
            in
                if List.Contains({"TRUE", "T", "YES", "Y", "1"}, t) then
                    true
                else if List.Contains({"FALSE", "F", "NO", "N", "0"}, t) then
                    false
                else
                    null,
    // =========================================
    // Multi-select helpers
    // =========================================
    ParseMultiSelectLabels = (v as any) as list =>
        if v = null then
            {}
        else
            let
                t0 = Text.From(v),
                t1 = Text.Trim(t0),
                t2 = Text.Replace(t1, "{", ""),
                t3 = Text.Replace(t2, "}", ""),
                parts = List.Transform(Text.Split(t3, ","), each Text.Trim(_)),
                nonEmpty = List.Select(parts, each _ <> "")
            in
                nonEmpty,
    MapMultiSelectToDataverseString = (raw as any, map as record) as nullable text =>
        let
            labels = ParseMultiSelectLabels(raw),
            keys = List.Transform(labels, each NormalizeChoiceKey(_)),
            ints = List.Transform(
                keys, each if _ <> null and Record.HasFields(map, _) then Record.Field(map, _) else null
            ),
            good = List.RemoveNulls(ints),
            result = if List.Count(good) = 0 then null else Text.Combine(
                List.Transform(good, each Text.From(_)), ","
            )
        in
            result,
    // =========================================
    // Apply all choice mappings
    // =========================================
    ApplyAll = List.Accumulate(
        ChoiceSpecs,
        #"Navigation 1",
        (state as table, spec as record) =>
            let
                src = spec[source],
                dest = spec[dest],
                map = spec[map],
                rawCol = src & "_raw",
                WithRaw = Table.AddColumn(
                    state,
                    rawCol,
                    each
                        let
                            original = try Record.Field(_, src) otherwise null
                        in
                            if original = null then
                                null
                            else
                                Text.From(original),
                    type text
                ),
                WithChoice = Table.AddColumn(
                    WithRaw, dest, each MapMultiSelectToDataverseString(Record.Field(_, rawCol), map), type text
                )
            in
                WithChoice
    ),
    // =========================================
    // Apply boolean cleaning
    // =========================================
    WithBooleans = Table.TransformColumns(
        ApplyAll, {{"cr69a_isrequester", each NormalizeBoolean(_), type logical}}, MissingField.Ignore
    )
in
    WithBooleans
