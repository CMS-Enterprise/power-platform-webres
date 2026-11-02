section Section1;

shared new_stagecedarsystem =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl, [CreateNavigationProperties = null]),
        Stage = Source{[Schema = "dbo", Item = "new_stagecedarsystem"]}[Data],
        HasPopulatedValue = (v as any) as logical =>
            let
                textValue = if v = null then null else Text.Trim(Text.From(v))
            in
                textValue <> null and textValue <> "" and Text.Upper(textValue) <> "NULL",

        // Require exactly one Running Migration Run and a populated batch ID.
        // GuardedStage references the validated scalar so this check remains in
        // the loaded output's evaluation path, even though Stage is a separate table.
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
        GuardedStage = if Text.Length(BatchId) > 0 then Stage else error "Running Migration guard failed.",
        CurrentBatchStage = Table.SelectRows(
            GuardedStage,
            each
                let
                    stageBatchId = Record.FieldOrDefault(_, "new_batchid", null)
                in
                    HasPopulatedValue(stageBatchId)
                        and Text.Lower(Text.Trim(Text.From(stageBatchId))) = Text.Lower(BatchId)
        ),
        EnableQA = true,
        Normalize = (v as any) as nullable text =>
            if not HasPopulatedValue(v) then
                null
            else
                Text.Upper(Text.Trim(Text.From(v))),
        NormalizeDate = (v as any) as nullable date =>
            let
                parsed = if HasPopulatedValue(v) then try Date.From(v) otherwise null else null
            in
                if parsed <> null and parsed >= #date(1753, 1, 1) then
                    parsed
                else
                    null,
        NormalizeVersion = (v as any) as nullable number =>
            if HasPopulatedValue(v) then
                try Int64.From(v) otherwise null
            else
                null,
        CedarStateMap = [
            ACTIVE = 216640000,
            INACTIVE = 216640001,
            DEACTIVATED = 216640001
        ],
        #"Selected Columns" = Table.SelectColumns(
            CurrentBatchStage,
            {
                "new_acronym",
                "new_atoeffectivedate",
                "new_atoexpirationdate",
                "cr3ee_belongsto",
                "new_businessownerorg",
                "new_businessownerorgcomp",
                "new_cedarid",
                "new_cedaruuid",
                "new_description",
                "new_ictobjectid",
                "new_name",
                "new_oastatus",
                "new_state",
                "new_systemmaintainerorg",
                "new_systemmaintainerorgcomp",
                "new_version"
            },
            MissingField.Ignore
        ),
        #"Stamped Running Batch" = Table.AddColumn(
            #"Selected Columns", "cr3ee_batchid", each BatchId, type text
        ),
        #"Added ATO Effective Date" = Table.AddColumn(
            #"Stamped Running Batch", "cr3ee_atoeffectivedate", each NormalizeDate([new_atoeffectivedate]), type date
        ),
        #"Added ATO Expiration Date" = Table.AddColumn(
            #"Added ATO Effective Date",
            "cr3ee_atoexpirationdate",
            each NormalizeDate([new_atoexpirationdate]),
            type date
        ),
        #"Added Version" = Table.AddColumn(
            #"Added ATO Expiration Date", "cr3ee_version", each NormalizeVersion([new_version]), Int64.Type
        ),
        #"Added Cedar State" = Table.AddColumn(
            #"Added Version",
            "cr3ee_cedarstate",
            each
                let
                    state = Normalize([new_state])
                in
                    if state <> null and Record.HasFields(CedarStateMap, state) then
                        Record.Field(CedarStateMap, state)
                    else
                        null,
            Int64.Type
        ),
        #"Added QA Issues" =
            if not EnableQA then
                #"Added Cedar State"
            else
                Table.AddColumn(
                    #"Added Cedar State",
                    "UnmappedIssues",
                    (r as record) =>
                        let
                            effectiveRaw = Record.FieldOrDefault(r, "new_atoeffectivedate", null),
                            expirationRaw = Record.FieldOrDefault(r, "new_atoexpirationdate", null),
                            versionRaw = Record.FieldOrDefault(r, "new_version", null),
                            stateRaw = Record.FieldOrDefault(r, "new_state", null),
                            stateKey = Normalize(stateRaw),
                            issues = List.RemoveNulls(
                                {
                                    if HasPopulatedValue(effectiveRaw) and NormalizeDate(effectiveRaw) = null then
                                        "new_atoeffectivedate=" & Text.From(effectiveRaw)
                                    else
                                        null,
                                    if HasPopulatedValue(expirationRaw) and NormalizeDate(expirationRaw) = null then
                                        "new_atoexpirationdate=" & Text.From(expirationRaw)
                                    else
                                        null,
                                    if HasPopulatedValue(versionRaw) and NormalizeVersion(versionRaw) = null then
                                        "new_version=" & Text.From(versionRaw)
                                    else
                                        null,
                                    if stateKey <> null and not Record.HasFields(CedarStateMap, stateKey) then
                                        "new_state=" & Text.From(stateRaw)
                                    else
                                        null
                                }
                            )
                        in
                            if List.IsEmpty(issues) then
                                null
                            else
                                Text.Combine(issues, "; "),
                    type nullable text
                ),
        #"Remove Complex Columns" = Table.RemoveColumns(
            #"Added QA Issues",
            Table.ColumnsOfType(
                #"Added QA Issues",
                {type table, type record, type list, type nullable binary, type binary, type function}
            )
        )
    in
        #"Remove Complex Columns";
shared DataverseEnvironmentUrl =
    let
        DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
            IsParameterQuery = true,
            IsParameterQueryRequired = false,
            Type = type text
        ]
    in
        DataverseEnvironmentUrl;
