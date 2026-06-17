section Section1;
shared trb_guidance_letters = let
  Source = Csv.Document(Web.Contents("https://cmsgovonline-my.sharepoint.com/personal/wyatt_emme_cms_hhs_gov/Documents/TRB%20Mapping%20File/trb_guidance_letters.csv"), [Delimiter = ",", Columns = 12, QuoteStyle = QuoteStyle.None]),
  #"Promoted headers" = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
  #"Replace NULLs" = Table.ReplaceValue(
      #"Promoted headers", "NULL", null, Replacer.ReplaceValue, Table.ColumnNames(#"Promoted headers")
  ),
  #"Changed column type" = Table.TransformColumnTypes(
    #"Replace NULLs", 
    {
      {"id", type text}, 
      {"trb_request_id", type text}, 
      {"created_by", type text},
      {"created_at", type datetime}, 
      {"modified_by", type text}, 
      {"modified_at", type datetime}, 
      {"status", type text}, 
      {"meeting_summary", type text}, 
      {"next_steps", type text}, 
      {"is_followup_recommended", type logical}, 
      {"followup_point", type text}, 
      {"date_sent", type datetime}
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
  #"Added Batch Id";
