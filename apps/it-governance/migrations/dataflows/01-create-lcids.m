section Section1;

shared StagingRaw =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        StagingRaw = Source{[Schema = "dbo", Item = "cr69a_intakestaging"]}[Data]
    in
        StagingRaw;
shared LoadToFinal =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        HasPopulatedValue = (v as any) as logical =>
            let
                textValue = if v = null then null else Text.Trim(Text.From(v))
            in
                textValue <> null and textValue <> "" and Text.Upper(textValue) <> "NULL",
        // Require exactly one Migrating Migration Run and a populated batch ID.
        MigrationRuns = Source{[Schema = "dbo", Item = "easi_migrationrun"]}[Data],
        BufferedRuns = Table.Buffer(MigrationRuns),
        MigratingOnly = Table.SelectRows(BufferedRuns, each [easi_migrationrunstatus] = 216640002),
        MigratingCount = Table.RowCount(MigratingOnly),
        ValidatedMigratingRun =
            if MigratingCount = 0 then
                error
                    Error.Record(
                        "Migrating Migration guard",
                        "No Migrating Migration Run was found. Start Migrate All Data before refreshing this dataflow.",
                        [
                            MigratingCount = MigratingCount
                        ]
                    )
            else if MigratingCount > 1 then
                error
                    Error.Record(
                        "Migrating Migration guard",
                        "More than one Migrating Migration Run was found. Leave exactly one Migration Run in the Migrating state before refreshing this dataflow.",
                        [
                            MigratingCount = MigratingCount
                        ]
                    )
            else
                MigratingOnly{0},
        MigratingBatchId = Record.FieldOrDefault(ValidatedMigratingRun, "easi_batchid", null),
        BatchId =
            if HasPopulatedValue(MigratingBatchId) then
                Text.Trim(Text.From(MigratingBatchId))
            else
                error
                    Error.Record(
                        "Migrating Migration guard",
                        "The Migrating Migration Run has a blank batch ID.",
                        [
                            MigratingCount = MigratingCount
                        ]
                    ),
        GuardedStage = if Text.Length(BatchId) > 0 then StagingRaw else error "Migrating Migration guard failed.",
        // Migrate only staging rows stamped with the validated Migrating batch.
        CurrentBatchStage = Table.SelectRows(
            GuardedStage,
            each
                let
                    stageBatchId = Record.FieldOrDefault(_, "cr69a_batchid", null)
                in
                    HasPopulatedValue(stageBatchId)
                    and Text.Lower(Text.Trim(Text.From(stageBatchId))) = Text.Lower(BatchId)
        ),
        // Treat null / empty / whitespace / "null" / zero-GUID as missing
        IsNullishLCID = (v as any) as logical =>
            let
                s = if v = null then null else Text.Lower(Text.Trim(Text.From(v)))
            in
                s = null
                or s = ""
                or s = "null"
                or s = "n/a"
                or s = "na"
                or s = "-"
                or s = "0"
                or s = "00000000-0000-0000-0000-000000000000",
        // Filter out rows with missing LCIDs
        #"Filtered Null LCIDs" = Table.SelectRows(CurrentBatchStage, each not IsNullishLCID([cr69a_lcid])),
        #"Removed Staging Batch ID" = Table.RemoveColumns(#"Filtered Null LCIDs", {"cr69a_batchid"}),
        #"Stamped Running Batch" = Table.AddColumn(
            #"Removed Staging Batch ID", "cr69a_batchid", each BatchId, type text
        ),
        #"Remove Columns" = Table.RemoveColumns(
            #"Stamped Running Batch",
            Table.ColumnsOfType(
                #"Stamped Running Batch",
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
