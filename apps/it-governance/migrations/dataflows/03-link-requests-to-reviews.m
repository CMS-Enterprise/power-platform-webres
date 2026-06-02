section Section1;
shared StagingRaw = let
  Source = CommonDataService.Database(DataverseEnvironmentUrl),
  #"Navigation 1" = Source{[Schema = "dbo", Item = "cr69a_intakestaging"]}[Data],
  #"From Value" = Table.FromValue(#"Navigation 1"),
  #"Remove Columns" = Table.RemoveColumns(#"From Value", Table.ColumnsOfType(#"From Value", {type table, type record, type list, type nullable binary, type binary, type function}))
in
  #"Remove Columns";
shared DataverseEnvironmentUrl = let
  DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text]
in
  DataverseEnvironmentUrl;
