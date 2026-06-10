section Section1;
shared StagingRaw = let
  Source = CommonDataService.Database(DataverseEnvironmentUrl),
  StagingRaw = Source{[Schema = "dbo", Item = "cr69a_intakestaging"]}[Data]
in
  StagingRaw;
shared LoadToFinal = let
  Prev = StagingRaw,

  // Treat null / empty / whitespace / "null" / zero-GUID as missing
  IsNullishLCID = (v as any) as logical =>
    let s = if v = null then null else Text.Lower(Text.Trim(Text.From(v))) in
      s = null or s = "" or s = "null" or s = "n/a" or s = "na" or s = "-" or s = "0" or s = "00000000-0000-0000-0000-000000000000",

  // Filter out rows with missing LCIDs
  #"Filtered Null LCIDs" = Table.SelectRows(Prev, each not IsNullishLCID([cr69a_lcid])),
  #"Remove Columns" = Table.RemoveColumns(
    #"Filtered Null LCIDs",
    Table.ColumnsOfType(
        #"Filtered Null LCIDs",
        {type table, type record, type list, type nullable binary, type binary, type function}
    )
  )
in
  #"Remove Columns";
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
