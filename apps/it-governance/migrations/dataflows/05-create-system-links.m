section Section1;

shared SystemLinkPreparation =
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
        EnableQA = true,
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
        WithQA =
            if not EnableQA then
                ApplyAll
            else
                Table.AddColumn(
                    ApplyAll,
                    "ChoiceMappingIssues",
                    (r as record) =>
                        let
                            issues = List.Transform(
                                ChoiceSpecs,
                                (spec as record) =>
                                    let
                                        src = spec[source],
                                        map = spec[map],
                                        raw = Record.FieldOrDefault(r, src & "_raw", null),
                                        labels = ParseMultiSelectLabels(raw),
                                        unknownLabels = List.Select(
                                            labels,
                                            each
                                                let
                                                    key = NormalizeChoiceKey(_)
                                                in
                                                    key <> null and not Record.HasFields(map, key)
                                        )
                                    in
                                        if List.IsEmpty(unknownLabels) then
                                            null
                                        else
                                            src & "=" & Text.Combine(unknownLabels, ",")
                            ),
                            filtered = List.RemoveNulls(issues)
                        in
                            if List.IsEmpty(filtered) then
                                null
                            else
                                Text.Combine(filtered, "; "),
                    type nullable text
                ),
        #"Remove Columns" = Table.RemoveColumns(
            WithQA,
            Table.ColumnsOfType(
                WithQA, {type table, type record, type list, type nullable binary, type binary, type function}
            )
        )
    in
        #"Remove Columns";
shared SystemLinkValidation = let
    Source = CommonDataService.Database(DataverseEnvironmentUrl),
    RequestsRaw = Source{[Schema = "dbo", Item = "new_systemintake"]}[Data],
    CedarSystemsRaw = Source{[Schema = "dbo", Item = "new_cedarsystem"]}[Data],
    HasPopulatedValue = (v as any) as logical =>
        let
            textValue = if v = null then null else Text.Trim(Text.From(v))
        in
            textValue <> null and textValue <> "" and Text.Upper(textValue) <> "NULL",
    NormalizeId = (v as any) as nullable text =>
        if not HasPopulatedValue(v) then
            null
        else
            Text.Lower(
                Text.Replace(
                    Text.Replace(Text.Trim(Text.From(v)), "{", ""),
                    "}",
                    ""
                )
            ),
    PreparedLinks = Table.TransformColumns(
        SystemLinkPreparation,
        {
            {"cr69a_systemintakeid", each NormalizeId(_), type nullable text},
            {"cr69a_systemid", each NormalizeId(_), type nullable text}
        }
    ),
    ExistingRequests = Table.TransformColumns(
        Table.SelectColumns(
            RequestsRaw,
            {"new_systemintakeid", "easi_external_id"},
            MissingField.Error
        ),
        {{"easi_external_id", each NormalizeId(_), type nullable text}}
    ),
    ExistingCedarSystems = Table.TransformColumns(
        Table.SelectColumns(
            CedarSystemsRaw,
            {"new_cedarsystemid", "new_externalid"},
            MissingField.Error
        ),
        {{"new_externalid", each NormalizeId(_), type nullable text}}
    ),
    WithRequestMatch = Table.NestedJoin(
        PreparedLinks,
        {"cr69a_systemintakeid"},
        ExistingRequests,
        {"easi_external_id"},
        "RequestMatch",
        JoinKind.LeftOuter
    ),
    WithRequestId = Table.ExpandTableColumn(
        WithRequestMatch,
        "RequestMatch",
        {"new_systemintakeid"},
        {"MatchedRequestId"}
    ),
    WithCedarSystemMatch = Table.NestedJoin(
        WithRequestId,
        {"cr69a_systemid"},
        ExistingCedarSystems,
        {"new_externalid"},
        "CedarSystemMatch",
        JoinKind.LeftOuter
    ),
    WithCedarSystemId = Table.ExpandTableColumn(
        WithCedarSystemMatch,
        "CedarSystemMatch",
        {"new_cedarsystemid"},
        {"MatchedCedarSystemId"}
    ),
    WithQA = Table.AddColumn(
        WithCedarSystemId,
        "UnmappedIssues",
        (row as record) =>
            let
                choiceMappingIssues = Record.FieldOrDefault(row, "ChoiceMappingIssues", null),
                issues = List.RemoveNulls(
                    {
                        if HasPopulatedValue(choiceMappingIssues) then
                            Text.From(choiceMappingIssues)
                        else
                            null,
                        if not HasPopulatedValue(Record.FieldOrDefault(row, "cr69a_systemintakeid", null)) then
                            "cr69a_systemintakeid is blank"
                        else if Record.FieldOrDefault(row, "MatchedRequestId", null) = null then
                            "No Request matched cr69a_systemintakeid=" & Text.From(row[cr69a_systemintakeid])
                        else
                            null,
                        if not HasPopulatedValue(Record.FieldOrDefault(row, "cr69a_systemid", null)) then
                            "cr69a_systemid is blank"
                        else if Record.FieldOrDefault(row, "MatchedCedarSystemId", null) = null then
                            "No CEDAR System matched cr69a_systemid=" & Text.From(row[cr69a_systemid])
                        else
                            null
                    }
                )
            in
                if List.IsEmpty(issues) then null else Text.Combine(issues, "; "),
        type nullable text
    )
in
    WithQA;
shared SystemLinkQA = let
    Issues = Table.SelectRows(SystemLinkValidation, each [UnmappedIssues] <> null),
    Output = Table.SelectColumns(
        Issues,
        {
            "cr69a_systemintakestaginglinkedsystemsid",
            "cr69a_recordid",
            "cr69a_systemintakeid",
            "cr69a_systemid",
            "UnmappedIssues"
        },
        MissingField.Ignore
    )
in
    Output;
shared cr69a_systemintakestaginglinkedsystems = let
    ValidRows = Table.SelectRows(SystemLinkValidation, each [UnmappedIssues] = null),
    Output = Table.RemoveColumns(
        ValidRows,
        {"MatchedRequestId", "MatchedCedarSystemId", "ChoiceMappingIssues", "UnmappedIssues"},
        MissingField.Ignore
    )
in
    Output;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
    IsParameterQuery = true,
    IsParameterQueryRequired = false,
    Type = type text
];
