section Section1;
shared new_stagecedarsystem = let
    Source = CommonDataService.Database(
        DataverseEnvironmentUrl,
        [CreateNavigationProperties = null]
    ),

    Stage = Source{[Schema = "dbo", Item = "new_stagecedarsystem"]}[Data],

    MigrationRuns = Source{[Schema = "dbo", Item = "easi_migrationrun"]}[Data],

    BufferedRuns = Table.Buffer(MigrationRuns),

    RunningOnly = Table.SelectRows(
        BufferedRuns,
        each [easi_migrationrunstatus] = 100000000
    ),

    Sorted = Table.Sort(RunningOnly, {{"easi_startedon", Order.Descending}}),

    Latest = Table.FirstN(Sorted, 1),

    BatchId =
        if Table.RowCount(Latest) > 0
        then Text.From(Latest{0}[easi_batchid])
        else "DATAFLOW_NO_RUNNING_BATCH",

    #"Selected Columns" = Table.SelectColumns(
        #"Stage",
        {
            "new_acronym",
            "new_atoeffectivedate",
            "new_atoexpirationdate",
            "new_batchid",
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

    #"Added ATO Effective Date" = Table.AddColumn(
        #"Selected Columns",
        "cr3ee_atoeffectivedate",
        each
            let d = try Date.FromText([new_atoeffectivedate]) otherwise null
            in if d <> null and d >= #date(1753, 1, 1) then d else null,
        type date
    ),

    #"Added ATO Expiration Date" = Table.AddColumn(
        #"Added ATO Effective Date",
        "cr3ee_atoexpirationdate",
        each
            let d = try Date.FromText([new_atoexpirationdate]) otherwise null
            in if d <> null and d >= #date(1753, 1, 1) then d else null,
        type date
    ),

    #"Added Version" = Table.AddColumn(
        #"Added ATO Expiration Date",
        "cr3ee_version",
        each try Int64.FromText(Text.From([new_version])) otherwise null,
        Int64.Type
    ),

    #"Added Cedar State" = Table.AddColumn(
        #"Added Version",
        "cr3ee_cedarstate",
        each
            let state = Text.Upper(Text.Trim(Text.From([new_state])))
            in
                if state = "ACTIVE" then 216640000
                else if state = "INACTIVE" then 216640001
                else null,
        Int64.Type
    ),

    #"From Value" = Table.FromValue(#"Added Cedar State"),

    #"Remove Complex Columns" = Table.RemoveColumns(
        #"From Value",
        Table.ColumnsOfType(
            #"From Value",
            {type table, type record, type list, type nullable binary, type binary, type function}
        )
    )

in
    #"Remove Complex Columns";
shared DataverseEnvironmentUrl = let
  DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text]
in
  DataverseEnvironmentUrl;
