section Section1;

shared StagingRaw =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        #"Navigation 1" = Source{[Schema = "dbo", Item = "cr69a_intakestaging"]}[Data]
    in
        #"Navigation 1";
shared Query =
    let
        Source = StagingRaw,
        #"Filtered rows" = Table.SelectRows(Source, each [cr69a_lcid] <> null and [cr69a_lcid] <> ""),
        #"Remove Columns" = Table.RemoveColumns(
            #"Filtered rows",
            Table.ColumnsOfType(
                #"Filtered rows",
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
