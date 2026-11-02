section Section1;

shared StagingRaw =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        #"Navigation 1" = Source{[Schema = "dbo", Item = "cr69a_intakestaging"]}[Data]
    in
        #"Navigation 1";
shared Query =
    let
        Dataverse = CommonDataService.Database(DataverseEnvironmentUrl),
        HasPopulatedValue = (v as any) as logical =>
            let textValue = if v = null then null else Text.Trim(Text.From(v))
            in textValue <> null and textValue <> "" and Text.Upper(textValue) <> "NULL",
        MigrationRuns = Dataverse{[Schema = "dbo", Item = "easi_migrationrun"]}[Data],
        BufferedRuns = Table.Buffer(MigrationRuns),
        RunningOnly = Table.SelectRows(BufferedRuns, each [easi_migrationrunstatus] = 100000000),
        RunningCount = Table.RowCount(RunningOnly),
        ValidatedRunningRun =
            if RunningCount = 0 then
                error Error.Record("Running Migration guard", "No Running Migration Run was found. Start exactly one Migration Run before refreshing this dataflow.", [RunningCount = RunningCount])
            else if RunningCount > 1 then
                error Error.Record("Running Migration guard", "More than one Running Migration Run was found. Leave exactly one Migration Run in the Running state before refreshing this dataflow.", [RunningCount = RunningCount])
            else
                RunningOnly{0},
        RunningBatchId = Record.FieldOrDefault(ValidatedRunningRun, "easi_batchid", null),
        BatchId =
            if HasPopulatedValue(RunningBatchId) then Text.Trim(Text.From(RunningBatchId))
            else error Error.Record("Running Migration guard", "The Running Migration Run has a blank batch ID.", [RunningCount = RunningCount]),
        GuardedStage = if Text.Length(BatchId) > 0 then StagingRaw else error "Running Migration guard failed.",
        CurrentBatchStage = Table.SelectRows(
            GuardedStage,
            each
                let stageBatchId = Record.FieldOrDefault(_, "cr69a_batchid", null)
                in HasPopulatedValue(stageBatchId) and Text.Lower(Text.Trim(Text.From(stageBatchId))) = Text.Lower(BatchId)
        ),
        #"Filtered rows" = Table.SelectRows(CurrentBatchStage, each [cr69a_lcid] <> null and [cr69a_lcid] <> ""),
        #"Removed Staging Batch ID" = Table.RemoveColumns(#"Filtered rows", {"cr69a_batchid"}),
        #"Stamped Running Batch" = Table.AddColumn(#"Removed Staging Batch ID", "cr69a_batchid", each BatchId, type text),
        #"Remove Columns" = Table.RemoveColumns(
            #"Stamped Running Batch",
            Table.ColumnsOfType(
                #"Stamped Running Batch",
                {type table, type record, type list, type nullable binary, type binary, type function}
            )
        )
    in
        #"Remove Columns";
shared ReviewLinks = let Source = Query in Source;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
    IsParameterQuery = true,
    IsParameterQueryRequired = false,
    Type = type text
];
