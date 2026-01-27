let
    Source = Csv.Document(
        Web.Contents(
            "https://cmsgovonline-my.sharepoint.com/personal/cooper_heinrichs_cms_hhs_gov/Documents/Apps/Power Query Online GCC-L2/Uploaded Files/system_intake_documents.csv"
        ),
        [
            Delimiter = ",",
            Columns = 13,
            QuoteStyle = QuoteStyle.None
        ]
    ),
    #"Promoted headers" = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    // Replace "NULL" text values with actual nulls
    #"Replace NULLs" = Table.ReplaceValue(
        #"Promoted headers", "NULL", null, Replacer.ReplaceValue, Table.ColumnNames(#"Promoted headers")
    ),
    #"Changed column type" = Table.TransformColumnTypes(
        #"Replace NULLs",
        {
            {"id", type text},
            {"system_intake_id", type text},
            {"file_name", type text},
            {"document_type", type text},
            {"other_type", type text},
            {"bucket", type text},
            {"s3_key", type text},
            {"created_by", type text},
            {"created_at", type datetime},
            {"modified_by", type text},
            {"modified_at", type datetime},
            {"uploader_role", type text},
            {"document_version", type text}
        }
    ),
    // --- DATAVERSE LOOKUP FOR CURRENT BATCH ---
    Dv = CommonDataService.Database("icpg-dev.crm9.dynamics.com"),
    // Update this table name to your actual MigrationRun logical name
    MigrationRuns = Dv{[Name = "easi_migrationrun", Kind = "Table"]}[Data],
    // If cr69a_status is an option set numeric, this filter will need adjusting
    RunningOnly = Table.SelectRows(MigrationRuns, each [easi_migrationrunstatus] = 100000000),
    Sorted = Table.Sort(RunningOnly, {{"easi_startedon", Order.Descending}}),
    Latest = Table.FirstN(Sorted, 1),
    BatchId =
        if Table.RowCount(Latest) > 0 then
            Text.From(Latest{0}[easi_batchid])
        else
            error "No Running MigrationRun found – check MigrationRun table.",
    // --- ADD BATCH ID TO OUTPUT ---
    #"Added Batch Id" = Table.AddColumn(#"Changed column type", "migrate_batch_id", each BatchId, type text)
in
    #"Added Batch Id"
