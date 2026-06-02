section Section1;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared SharePointSiteUrl = "https://cmsgovonline-my.sharepoint.com/" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared FolderPath = "personal/cooper_heinrichs_cms_hhs_gov/Documents/Apps/IT_Governance/Data_Migrations/Dev/" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared FileName = "governance_request_feedback.csv" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared #"governance_request_feedback 2" = let
	CsvUrl = SharePointSiteUrl & FolderPath & FileName,
    Source = Csv.Document(
        Web.Contents(CsvUrl),
        [
            Delimiter = ",",
            Columns = 10,
            QuoteStyle = QuoteStyle.None
        ]
    ),
    #"Promoted headers" = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    // Replace "NULL" text values with actual nulls across all columns
    #"Replace NULLs" = Table.ReplaceValue(
        #"Promoted headers", "NULL", null, Replacer.ReplaceValue, Table.ColumnNames(#"Promoted headers")
    ),
    #"Changed column type" = Table.TransformColumnTypes(
        #"Replace NULLs",
        {
            {"id", type text},
            {"intake_id", type text},
            {"feedback", type text},
            {"source_action", type text},
            {"target_form", type text},
            {"created_by", type text},
            {"created_at", type datetime},
            {"modified_by", type text},
            {"modified_at", type datetime},
            {"type", type text}
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
    #"Added Batch Id" = Table.AddColumn(#"Changed column type", "migrate_batch_id", each BatchId, type text),
    #"Filtered rows" = Table.SelectRows(#"Added Batch Id", each ([type] = "REQUESTER"))
in
    #"Filtered rows";
