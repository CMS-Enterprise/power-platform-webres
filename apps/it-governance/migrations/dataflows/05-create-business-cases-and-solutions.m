section Section1;

shared BusinessCases =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        #"Navigation 1" = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingbusinesscase"]}[Data],
        ChoiceSpecs = {
            [
                source = "cr69a_status",
                dest = "status_dataverse_format",
                map = [
                    DRAFT = 971270000,
                    SUBMITTED = 971270001,
                    REVIEWED = 971270002,
                    REJECTED = 971270003,
                    ARCHIVED = 971270004,
                    OPEN = 971270005,
                    CLOSED = 971270006
                ]
            ]
        },
        // Helper: normalize source text -> enum key
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
        EnableQA = true,
        // Apply all choice mappings starting from the actual table
        ApplyAll = List.Accumulate(
            ChoiceSpecs,
            #"Navigation 1",
            // 🔹 start from your staging table, not Source
            (state as table, spec as record) =>
                let
                    src = spec[source],
                    dest = spec[dest],
                    map = spec[map],
                    rawCol = src & "_raw",
                    // 1) Add raw column preserving original value as text
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
                    // 2) Add Dataverse choice column using normalized key
                    WithChoice = Table.AddColumn(
                        WithRaw,
                        dest,
                        each
                            let
                                raw = Record.Field(_, rawCol), key = NormalizeChoiceKey(raw)
                            in
                                if key = null then
                                    null
                                else if Record.HasFields(map, key) then
                                    Record.Field(map, key)
                                else
                                    null,
                        Int64.Type
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
                    "UnmappedIssues",
                    (r as record) =>
                        let
                            issues = List.Transform(
                                ChoiceSpecs,
                                (spec as record) =>
                                    let
                                        src = spec[source],
                                        map = spec[map],
                                        raw = Record.FieldOrDefault(r, src & "_raw", null),
                                        key = NormalizeChoiceKey(raw),
                                        bad = key <> null and not Record.HasFields(map, key)
                                    in
                                        if bad then
                                            src & "=" & Text.From(raw)
                                        else
                                            null
                            ),
                            filtered = List.RemoveNulls(issues)
                        in
                            if List.IsEmpty(filtered) then
                                null
                            else
                                Text.Combine(filtered, "; "),
                    type nullable text
                ),
        // Return the transformed table
        Custom = WithQA,
        #"Remove Columns" = Table.RemoveColumns(
            Custom,
            Table.ColumnsOfType(
                Custom, {type table, type record, type list, type nullable binary, type binary, type function}
            )
        )
    in
        #"Remove Columns";
shared CreatePreferredSolution =
    let
        Source = BusinessCases,
        Rename = Table.RenameColumns(
            Source,
            {
                {"cr69a_system_intake", "Request ID"},
                {"cr69a_preferred_title", "Title"},
                {"cr69a_preferred_summary", "Summary"},
                {"cr69a_preferred_acquisition_approach", "Acquisition Approach"},
                {"cr69a_preferred_pros", "Pros"},
                {"cr69a_preferred_cons", "Cons"},
                {"cr69a_preferred_cost_savings", "Cost Savings"},
                {"cr69a_preferred_hosting_type", "Hosting Type"},
                {"cr69a_preferred_hosting_location", "Hosting Location"},
                {"cr69a_preferred_hosting_cloud_service_type", "Hosting Cloud Service Type"},
                {"cr69a_preferred_has_ui", "Has UI"},
                {"cr69a_preferred_security_is_approved", "Security Approved"},
                {"cr69a_preferred_security_is_being_reviewed", "Security Currently Under Review"},
                {"cr69a_preferred_target_contract_award_date", "Contract Award Date"},
                {"cr69a_preferred_target_completion_date", "Target Completion Date"},
                {"cr69a_preferred_zero_trust_alignment", "Zero Trust Alignment"},
                {"cr69a_preferred_hosting_cloud_strategy", "Hosting Cloud Strategy"},
                {"cr69a_preferred_workforce_training_reqs", "Workforce Training Requirements"},
                {"cr69a_batchid", "Batch ID"}
            }
        ),
        WithDefaults = Table.TransformColumns(
            Rename,
            {
                {"Title", each if _ = null or _ = "" then "Preferred Solution (placeholder)" else _, type text},
                {"Summary", each if _ = null then "" else _, type text},
                {"Acquisition Approach", each if _ = null then "" else _, type text},
                {"Pros", each if _ = null then "" else _, type text},
                {"Cons", each if _ = null then "" else _, type text},
                {"Cost Savings", each if _ = null then 0 else _, Int64.Type}
            }
        ),
        WithSolutionType = Table.AddColumn(WithDefaults, "SolutionType", each 971270000, Int64.Type)
    in
        WithSolutionType;
shared CreateAlternativeA =
    let
        Source = BusinessCases,
        RenamedColumns = Table.RenameColumns(
            Source,
            {
                {"cr69a_system_intake", "Request ID"},
                {"cr69a_alternative_a_title", "Title"},
                {"cr69a_alternative_a_summary", "Summary"},
                {"cr69a_alternative_a_acquisition_approach", "Acquisition Approach"},
                {"cr69a_alternative_a_pros", "Pros"},
                {"cr69a_alternative_a_cons", "Cons"},
                {"cr69a_alternative_a_cost_savings", "Cost Savings"},
                {"cr69a_alternative_a_hosting_type", "Hosting Type"},
                {"cr69a_alternative_a_hosting_location", "Hosting Location"},
                {"cr69a_alternative_a_hosting_cloud_service_typ", "Hosting Cloud Service Type"},
                {"cr69a_alternative_a_has_ui", "Has UI"},
                {"cr69a_alternative_a_security_is_approved", "Security Approved"},
                {"cr69a_alternative_a_security_is_being_reviewe", "Security Currently Under Review"},
                {"cr69a_alternative_a_target_contract_award_dat", "Contract Award Date"},
                {"cr69a_alternative_a_target_completion_date", "Target Completion Date"},
                {"cr69a_alternative_a_zero_trust_alignment", "Zero Trust Alignment"},
                {"cr69a_alternative_a_hosting_cloud_strategy", "Hosting Cloud Strategy"},
                {"cr69a_alternative_a_workforce_training_reqs", "Workforce Training Requirements"},
                {"cr69a_batchid", "Batch ID"}
            }
        ),
        // 🔥 Fill in required / important fields with safe defaults so we can create shell solutions
        WithDefaults = Table.TransformColumns(
            RenamedColumns,
            {
                // Title: give a clear placeholder if empty/null
                {"Title", each if _ = null or _ = "" then "Alternative A (placeholder)" else _, type text},
                // Text fields: default to empty string instead of null
                {"Summary", each if _ = null then "" else _, type text},
                {"Acquisition Approach", each if _ = null then "" else _, type text},
                {"Pros", each if _ = null then "" else _, type text},
                {"Cons", each if _ = null then "" else _, type text},
                {"Hosting Type", each if _ = null then "" else _, type text},
                {"Hosting Location", each if _ = null then "" else _, type text},
                {"Hosting Cloud Service Type", each if _ = null then "" else _, type text},
                {"Zero Trust Alignment", each if _ = null then "" else _, type text},
                {"Hosting Cloud Strategy", each if _ = null then "" else _, type text},
                {"Workforce Training Requirements", each if _ = null then "" else _, type text},
                // Numeric field: default cost to 0 instead of null
                {"Cost Savings", each if _ = null then 0 else _, Int64.Type},
                // Booleans: default to false if null
                {"Has UI", each if _ = null then false else _, type logical},
                {"Security Approved", each if _ = null then false else _, type logical},
                {"Security Currently Under Review", each if _ = null then false else _, type logical}
            }
        ),
        // Add solution type for Alternative A
        SolutionTypeAdded = Table.AddColumn(WithDefaults, "SolutionType", each 971270001, Int64.Type)
    in
        SolutionTypeAdded;
shared CreateAlternativeB =
    let
        Source = BusinessCases,
        RenamedColumns = Table.RenameColumns(
            Source,
            {
                {"cr69a_system_intake", "Request ID"},
                {"cr69a_alternative_b_title", "Title"},
                {"cr69a_alternative_b_summary", "Summary"},
                {"cr69a_alternative_b_acquisition_approach", "Acquisition Approach"},
                {"cr69a_alternative_b_pros", "Pros"},
                {"cr69a_alternative_b_cons", "Cons"},
                {"cr69a_alternative_b_cost_savings", "Cost Savings"},
                {"cr69a_alternative_b_hosting_type", "Hosting Type"},
                {"cr69a_alternative_b_hosting_location", "Hosting Location"},
                {"cr69a_alternative_b_hosting_cloud_service_typ", "Hosting Cloud Service Type"},
                {"cr69a_alternative_b_has_ui", "Has UI"},
                {"cr69a_alternative_b_security_is_approved", "Security Approved"},
                {"cr69a_alternative_b_security_is_being_reviewe", "Security Currently Under Review"},
                {"cr69a_alternative_b_target_contract_award_dat", "Contract Award Date"},
                {"cr69a_alternative_b_target_completion_date", "Target Completion Date"},
                {"cr69a_alternative_b_zero_trust_alignment", "Zero Trust Alignment"},
                {"cr69a_alternative_b_hosting_cloud_strategy", "Hosting Cloud Strategy"},
                {"cr69a_alternative_b_workforce_training_reqs", "Workforce Training Requirements"},
                {"cr69a_batchid", "Batch ID"}
            }
        ),
        // Fill required/important fields with safe placeholders so shell solutions can be created
        WithDefaults = Table.TransformColumns(
            RenamedColumns,
            {
                // Title: placeholder when null/empty
                {"Title", each if _ = null or _ = "" then "Alternative B (placeholder)" else _, type text},
                // Text fields → "" instead of null
                {"Summary", each if _ = null then "" else _, type text},
                {"Acquisition Approach", each if _ = null then "" else _, type text},
                {"Pros", each if _ = null then "" else _, type text},
                {"Cons", each if _ = null then "" else _, type text},
                {"Hosting Type", each if _ = null then "" else _, type text},
                {"Hosting Location", each if _ = null then "" else _, type text},
                {"Hosting Cloud Service Type", each if _ = null then "" else _, type text},
                {"Zero Trust Alignment", each if _ = null then "" else _, type text},
                {"Hosting Cloud Strategy", each if _ = null then "" else _, type text},
                {"Workforce Training Requirements", each if _ = null then "" else _, type text},
                // Numbers → 0 instead of null
                {"Cost Savings", each if _ = null then 0 else _, Int64.Type},
                // Booleans → false when null
                {"Has UI", each if _ = null then false else _, type logical},
                {"Security Approved", each if _ = null then false else _, type logical},
                {"Security Currently Under Review", each if _ = null then false else _, type logical}
            }
        ),
        SolutionTypeAdded = Table.AddColumn(WithDefaults, "SolutionType", each 971270002, Int64.Type)
    in
        SolutionTypeAdded;
shared BusinessCaseSolutionPreparation =
    let
        Combined = Table.Combine({CreatePreferredSolution, CreateAlternativeA, CreateAlternativeB}),
        // Convert TRUE/FALSE → 1/0
        Normalized = Table.TransformColumns(Combined, {{"Security Approved", each if _ = true then 1 else 0,
        Int64.Type}}),
        NormalizeId = (value as any) as nullable text =>
            if value = null then
                null
            else
                let
                    normalized = Text.Lower(Text.Trim(Text.From(value)))
                in
                    if normalized = "" or Text.Upper(normalized) = "NULL" then null else normalized,
        WithNormalizedBusinessCaseId = Table.AddColumn(
            Normalized,
            "NormalizedBusinessCaseId",
            each NormalizeId([cr69a_id]),
            type nullable text
        ),
        WithNormalizedRequestId = Table.AddColumn(
            WithNormalizedBusinessCaseId,
            "NormalizedRequestId",
            each NormalizeId([Request ID]),
            type nullable text
        ),
        BusinessCaseCounts = Table.Buffer(
            Table.Group(
                Table.SelectRows(
                    WithNormalizedRequestId,
                    each [NormalizedBusinessCaseId] <> null
                ),
                {"NormalizedBusinessCaseId"},
                {{"SolutionRowCount", each Table.RowCount(_), Int64.Type}}
            )
        ),
        WithBusinessCaseCount = Table.NestedJoin(
            WithNormalizedRequestId,
            {"NormalizedBusinessCaseId"},
            BusinessCaseCounts,
            {"NormalizedBusinessCaseId"},
            "BusinessCaseCountMatch",
            JoinKind.LeftOuter
        ),
        ExpandedBusinessCaseCount = Table.ExpandTableColumn(
            WithBusinessCaseCount,
            "BusinessCaseCountMatch",
            {"SolutionRowCount"},
            {"SolutionRowCount"}
        ),
        Dataverse = CommonDataService.Database(DataverseEnvironmentUrl),
        ExistingRequestsRaw = Dataverse{[Schema = "dbo", Item = "new_systemintake"]}[Data],
        ExistingRequests = Table.Buffer(
            Table.TransformColumns(
                Table.SelectColumns(ExistingRequestsRaw, {"easi_external_id"}, MissingField.Error),
                {{"easi_external_id", each NormalizeId(_), type nullable text}}
            )
        ),
        WithRequestMatch = Table.NestedJoin(
            ExpandedBusinessCaseCount,
            {"NormalizedRequestId"},
            ExistingRequests,
            {"easi_external_id"},
            "RequestMatch",
            JoinKind.LeftOuter
        ),
        WithValidationIssues = Table.AddColumn(
            WithRequestMatch,
            "BusinessCaseSolutionIssues",
            (row as record) =>
                let
                    existingIssuesRaw = Record.FieldOrDefault(row, "UnmappedIssues", null),
                    existingIssues =
                        if existingIssuesRaw = null or Text.Trim(Text.From(existingIssuesRaw)) = "" then
                            null
                        else
                            Text.From(existingIssuesRaw),
                    businessCaseId = Record.FieldOrDefault(row, "NormalizedBusinessCaseId", null),
                    requestId = Record.FieldOrDefault(row, "NormalizedRequestId", null),
                    batchId = NormalizeId(Record.FieldOrDefault(row, "Batch ID", null)),
                    solutionRowCount = Record.FieldOrDefault(row, "SolutionRowCount", null),
                    requestMatches = Record.FieldOrDefault(row, "RequestMatch", #table({}, {})),
                    requestMatchCount = Table.RowCount(requestMatches),
                    issues = List.RemoveNulls(
                        {
                            existingIssues,
                            if businessCaseId = null then "Business Case ID is blank" else null,
                            if requestId = null then "Request ID is blank" else null,
                            if requestId <> null and requestMatchCount = 0 then "No Request matched Request ID=" & requestId else null,
                            if requestId <> null and requestMatchCount > 1 then "Multiple Requests matched Request ID=" & requestId else null,
                            if batchId = null then "Batch ID is blank" else null,
                            if solutionRowCount = null then "Expected 3 solution rows; found no count" else if solutionRowCount <> 3 then "Expected 3 solution rows; found " & Text.From(solutionRowCount) else null,
                            if not List.Contains({971270000, 971270001, 971270002}, Record.FieldOrDefault(row, "SolutionType", null)) then "Invalid SolutionType" else null
                        }
                    )
                in
                    if List.IsEmpty(issues) then null else Text.Combine(issues, "; "),
            type nullable text
        ),
        OutputColumns = {
            "Request ID",
            "cr69a_id",
            "Title",
            "Summary",
            "Acquisition Approach",
            "Pros",
            "Cons",
            "Cost Savings",
            "Hosting Type",
            "Hosting Location",
            "Hosting Cloud Service Type",
            "Has UI",
            "Security Approved",
            "Security Currently Under Review",
            "Contract Award Date",
            "Target Completion Date",
            "Zero Trust Alignment",
            "Hosting Cloud Strategy",
            "Workforce Training Requirements",
            "SolutionType",
            "Batch ID",
            "UnmappedIssues",
            "NormalizedBusinessCaseId",
            "NormalizedRequestId",
            "SolutionRowCount",
            "RequestMatch",
            "BusinessCaseSolutionIssues"
        },
        PreviewOnly = Table.SelectColumns(WithValidationIssues, OutputColumns, MissingField.UseNull)
    in
        PreviewOnly;
shared BusinessCaseSolutionQA =
    let
        Issues = Table.SelectRows(
            BusinessCaseSolutionPreparation,
            each
                if [BusinessCaseSolutionIssues] = null then
                    false
                else
                    Text.Trim(Text.From([BusinessCaseSolutionIssues])) <> ""
        ),
        Output = Table.SelectColumns(
            Issues,
            {
                "cr69a_id",
                "Request ID",
                "Title",
                "SolutionType",
                "Batch ID",
                "BusinessCaseSolutionIssues"
            },
            MissingField.UseNull
        )
    in
        Output;
shared Query =
    let
        BufferedQA = Table.Buffer(BusinessCaseSolutionQA),
        QARowCount = Table.RowCount(BufferedQA),
        QASample =
            if QARowCount = 0 then
                null
            else
                Text.Combine(
                    List.Transform(
                        Table.ToRecords(Table.FirstN(BufferedQA, 5)),
                        each
                            Text.From(Record.FieldOrDefault(_, "cr69a_id", "unknown Business Case"))
                                & ": "
                                & Text.From(Record.FieldOrDefault(_, "BusinessCaseSolutionIssues", "unknown issue"))
                    ),
                    " | "
                ),
        ValidatedPreparation =
            if QARowCount > 0 then
                error "BusinessCaseSolutionQA contains " & Text.From(QARowCount) & " invalid row(s). Sample: " & QASample
            else
                BusinessCaseSolutionPreparation,
        HelperColumns = {
            "NormalizedBusinessCaseId",
            "NormalizedRequestId",
            "SolutionRowCount",
            "RequestMatch",
            "BusinessCaseSolutionIssues"
        },
        Output = Table.RemoveColumns(ValidatedPreparation, HelperColumns, MissingField.Ignore),
        WithoutComplexColumns = Table.RemoveColumns(
            Output,
            Table.ColumnsOfType(
                Output,
                {type table, type record, type list, type nullable binary, type binary, type function}
            )
        )
    in
        WithoutComplexColumns;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
    IsParameterQuery = true,
    IsParameterQueryRequired = false,
    Type = type text
];
