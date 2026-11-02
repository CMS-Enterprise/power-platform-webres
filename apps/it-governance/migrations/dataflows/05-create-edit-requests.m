section Section1;

shared cr69a_systemintakestagingeditrequests =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        DataSource = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingeditrequests"]}[Data],
        HasPopulatedValue = (v as any) as logical =>
            let
                textValue = if v = null then null else Text.Trim(Text.From(v))
            in
                textValue <> null and textValue <> "" and Text.Upper(textValue) <> "NULL",

        // Require exactly one Running Migration Run and a populated batch ID.
        MigrationRuns = Source{[Schema = "dbo", Item = "easi_migrationrun"]}[Data],
        BufferedRuns = Table.Buffer(MigrationRuns),
        RunningOnly = Table.SelectRows(BufferedRuns, each [easi_migrationrunstatus] = 100000000),
        RunningCount = Table.RowCount(RunningOnly),
        ValidatedRunningRun =
            if RunningCount = 0 then
                error Error.Record(
                    "Running Migration guard",
                    "No Running Migration Run was found. Start exactly one Migration Run before refreshing this dataflow.",
                    [RunningCount = RunningCount]
                )
            else if RunningCount > 1 then
                error Error.Record(
                    "Running Migration guard",
                    "More than one Running Migration Run was found. Leave exactly one Migration Run in the Running state before refreshing this dataflow.",
                    [RunningCount = RunningCount]
                )
            else
                RunningOnly{0},
        RunningBatchId = Record.FieldOrDefault(ValidatedRunningRun, "easi_batchid", null),
        BatchId =
            if HasPopulatedValue(RunningBatchId) then
                Text.Trim(Text.From(RunningBatchId))
            else
                error Error.Record(
                    "Running Migration guard",
                    "The Running Migration Run has a blank batch ID.",
                    [RunningCount = RunningCount]
                ),
        GuardedStage = if Text.Length(BatchId) > 0 then DataSource else error "Running Migration guard failed.",
        CurrentBatchStage = Table.SelectRows(
            GuardedStage,
            each
                let
                    stageBatchId = Record.FieldOrDefault(_, "cr69a_batchid", null)
                in
                    HasPopulatedValue(stageBatchId)
                        and Text.Lower(Text.Trim(Text.From(stageBatchId))) = Text.Lower(BatchId)
        ),
        #"Removed Staging Batch ID" = Table.RemoveColumns(CurrentBatchStage, {"cr69a_batchid"}),
        #"Stamped Running Batch" = Table.AddColumn(
            #"Removed Staging Batch ID", "cr69a_batchid", each BatchId, type text
        ),
        ChoiceSpecs = {
            [
                source = "cr69a_targetform",
                dest = "target_form_dataverse_format",
                map = [
                    NO_TARGET_PROVIDED = 971270003,
                    INTAKE_REQUEST = 971270000,
                    DRAFT_BUSINESS_CASE = 971270001,
                    FINAL_BUSINESS_CASE = 971270002
                ]
            ]
        },
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
            #"Stamped Running Batch",
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
                                        if bad then src & "=" & Text.From(raw) else null
                            ),
                            filtered = List.RemoveNulls(issues)
                        in
                            if List.IsEmpty(filtered) then null else Text.Combine(filtered, "; "),
                    type nullable text
                ),
        // Expose the replacement multiline staging field under a stable output
        // name for the Edit Request destination mapping. The original
        // cr69a_feedbackcontent field is limited to 100 characters.
        WithRequesterFeedback = Table.AddColumn(
            WithQA,
            "requester_feedback_dataverse_format",
            each Record.FieldOrDefault(_, "new_requesterfeedbackmultitext", null),
            type nullable text
        ),
        // Return the transformed table
        Custom = WithRequesterFeedback,
        #"Filtered rows" = Table.SelectRows(Custom, each [cr69a_feedbacktype] = "REQUESTER"),
        #"Remove Columns" = Table.RemoveColumns(
            #"Filtered rows",
            Table.ColumnsOfType(
                #"Filtered rows",
                {type table, type record, type list, type nullable binary, type binary, type function}
            )
        )
    in
        #"Remove Columns";
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
    IsParameterQuery = true,
    IsParameterQueryRequired = false,
    Type = type text
];
