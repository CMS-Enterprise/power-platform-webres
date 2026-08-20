section Section1;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared SharePointSiteUrl = "https://cmsgovonline.sharepoint.com/" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared FolderPath = "sites/CMS-SharePoint-OIT-Classic/CIOCorner/EASi%20data%20migration/Development/" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared FileName = "system_intake_funding_sources.csv" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared #"system_intake_funding_sources 4" = let
	CsvUrl = SharePointSiteUrl & FolderPath & FileName,
    Source = Csv.Document(
        Web.Contents(CsvUrl),
        [
            Delimiter = ",",
            Columns = 5,
            QuoteStyle = QuoteStyle.None
        ]
    ),
    #"Promoted headers" = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    #"Replace NULLs" = Table.ReplaceValue(
        #"Promoted headers", "NULL", null, Replacer.ReplaceValue, Table.ColumnNames(#"Promoted headers")
    ),
    #"Changed column type" = Table.TransformColumnTypes(
        #"Replace NULLs",
        {
            {"id", type text},
            {"system_intake_id", type text},
            {"investment", type text},
            {"project_number", Int64.Type},
            {"created_at", type datetime}
        }
    ),

    // --- DATAVERSE LOOKUP FOR CURRENT BATCH ---
    Dv = CommonDataService.Database(DataverseEnvironmentUrl),

    // Update this table name to your actual MigrationRun logical name
    MigrationRuns = Dv{[Name = "easi_migrationrun", Kind = "Table"]}[Data],

    // If cr69a_status is an option set numeric, this filter will need adjusting
    RunningOnly = Table.SelectRows(MigrationRuns, each [easi_migrationrunstatus] = 100000000),

    Sorted = Table.Sort(RunningOnly, {{"easi_startedon", Order.Descending}}),
    Latest = Table.FirstN(Sorted, 1),

    BatchId =
        if Table.RowCount(Latest) > 0
        then Text.From(Latest{0}[easi_batchid])
        else error "No Running MigrationRun found – check MigrationRun table.",

    // --- ADD BATCH ID TO OUTPUT ---
    #"Added Batch Id" = Table.AddColumn(#"Changed column type", "migrate_batch_id", each BatchId, type text)
in
    #"Added Batch Id";
