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
        MigratingOnly = Table.SelectRows(BufferedRuns, each [easi_migrationrunstatus] = 216640002),
        MigratingCount = Table.RowCount(MigratingOnly),
        ValidatedMigratingRun =
            if MigratingCount = 0 then
                error Error.Record("Migrating Migration guard", "No Migrating Migration Run was found. Start Migrate All Data before refreshing this dataflow.", [MigratingCount = MigratingCount])
            else if MigratingCount > 1 then
                error Error.Record("Migrating Migration guard", "More than one Migrating Migration Run was found. Leave exactly one Migration Run in the Migrating state before refreshing this dataflow.", [MigratingCount = MigratingCount])
            else
                MigratingOnly{0},
        MigratingBatchId = Record.FieldOrDefault(ValidatedMigratingRun, "easi_batchid", null),
        BatchId =
            if HasPopulatedValue(MigratingBatchId) then Text.Trim(Text.From(MigratingBatchId))
            else error Error.Record("Migrating Migration guard", "The Migrating Migration Run has a blank batch ID.", [MigratingCount = MigratingCount]),
        GuardedStage = if Text.Length(BatchId) > 0 then StagingRaw else error "Migrating Migration guard failed.",
        CurrentBatchStage = Table.SelectRows(
            GuardedStage,
            each
                let stageBatchId = Record.FieldOrDefault(_, "cr69a_batchid", null)
                in HasPopulatedValue(stageBatchId) and Text.Lower(Text.Trim(Text.From(stageBatchId))) = Text.Lower(BatchId)
        ),
        EligibleRequests = Table.SelectRows(
            CurrentBatchStage,
            each
                HasPopulatedValue(Record.FieldOrDefault(_, "cr69a_submitted_at", null))
                    and HasPopulatedValue(Record.FieldOrDefault(_, "cr69a_project_name", null))
        ),
        NormalizeId = (v as any) as nullable text =>
            if HasPopulatedValue(v) then Text.Lower(Text.Trim(Text.From(v))) else null,
        CurrentBatchRequests = Table.Buffer(
            Table.TransformColumns(
                Table.SelectColumns(
                    Table.SelectRows(
                        Dataverse{[Schema = "dbo", Item = "new_systemintake"]}[Data],
                        each
                            let requestBatchId = Record.FieldOrDefault(_, "cr69a_batchid", null)
                            in HasPopulatedValue(requestBatchId) and Text.Lower(Text.Trim(Text.From(requestBatchId))) = Text.Lower(BatchId)
                    ),
                    {"easi_external_id"},
                    MissingField.Error
                ),
                {{"easi_external_id", each NormalizeId(_), type nullable text}}
            )
        ),
        WithNormalizedRequestId = Table.AddColumn(
            EligibleRequests,
            "NormalizedRequestId",
            each NormalizeId(Record.FieldOrDefault(_, "cr69a_id", null)),
            type nullable text
        ),
        WithRequestMatch = Table.NestedJoin(
            WithNormalizedRequestId,
            {"NormalizedRequestId"},
            CurrentBatchRequests,
            {"easi_external_id"},
            "RequestMatch",
            JoinKind.Inner
        ),
        MatchedRequests = Table.RemoveColumns(WithRequestMatch, {"NormalizedRequestId", "RequestMatch"}),
        #"Filtered rows" = Table.SelectRows(MatchedRequests, each [cr69a_lcid] <> null and [cr69a_lcid] <> ""),
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
