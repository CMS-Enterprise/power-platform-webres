section Section1;
shared StagingRaw = let
  Source = CommonDataService.Database(DataverseEnvironmentUrl),
  StagingRaw = Source{[Schema = "dbo", Item = "cr69a_intakestaging"]}[Data]
in
  StagingRaw;
shared LoadToFinal = let
  Source = CommonDataService.Database(DataverseEnvironmentUrl),

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
  GuardedStage = if Text.Length(BatchId) > 0 then StagingRaw else error "Running Migration guard failed.",

  // Migrate only staging rows stamped with the validated Running batch.
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
    let s = if v = null then null else Text.Lower(Text.Trim(Text.From(v))) in
      s = null or s = "" or s = "null" or s = "n/a" or s = "na" or s = "-" or s = "0" or s = "00000000-0000-0000-0000-000000000000",

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
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
