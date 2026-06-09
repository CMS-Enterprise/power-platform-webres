section Section1;

shared cr69a_systemintakestaginglinkedsystems =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        #"Navigation 1" = Source{[Schema = "dbo", Item = "cr69a_systemintakestaginglinkedsystems"]}[Data],
        // =========================================
        // Choice mapping specs
        // =========================================
        ChoiceSpecs = {
            [
                source = "cr69a_relationshiptype",
                dest = "relationship_type_dataverse_format",
                map = [
                    PRIMARY_SUPPORT = 971270000,
                    PARTIAL_SUPPORT = 971270001,
                    USES_OR_IMPACTED_BY_SELECTED_SYSTEM = 971270002,
                    IMPACTS_SELECTED_SYSTEM = 971270003,
                    OTHER = 971270004
                ]
            ]
        },
        // =========================================
        // Helper: normalize source text -> enum key
        // "MIP Base" -> "MIP_BASE"
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
        // Multi-select helpers
        // Input: "{PRIMARY_SUPPORT,IMPACTS_SELECTED_SYSTEM}"
        // Output labels: {"PRIMARY_SUPPORT","IMPACTS_SELECTED_SYSTEM"}
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
        // Map labels -> ints -> "971270000,971270003"
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
        // - Adds <source>_raw column (original text)
        // - Adds <dest> column in Dataverse multi-select format ("1,2,3")
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
                    // 1) Preserve original value as text
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
                    // 2) Convert to Dataverse multi-select format (comma-separated ints)
                    WithChoice = Table.AddColumn(
                        WithRaw, dest, each MapMultiSelectToDataverseString(Record.Field(_, rawCol), map), type text
                    )
                in
                    WithChoice
        ),
        #"Remove Columns" = Table.RemoveColumns(
            ApplyAll,
            Table.ColumnsOfType(
                ApplyAll, {type table, type record, type list, type nullable binary, type binary, type function}
            )
        )
    in
        #"Remove Columns";
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
    IsParameterQuery = true,
    IsParameterQueryRequired = false,
    Type = type text
];
