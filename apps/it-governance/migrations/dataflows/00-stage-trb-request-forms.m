section Section1;
shared trb_request_forms = let
  Source = Csv.Document(Web.Contents("https://cmsgovonline-my.sharepoint.com/personal/wyatt_emme_cms_hhs_gov/Documents/TRB%20Mapping%20File/trb_request_forms.csv"), [Delimiter = ",", Columns = 28, QuoteStyle = QuoteStyle.None]),
  #"Promoted headers" = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
  #"Replace NULLs" = Table.ReplaceValue(
      #"Promoted headers", "NULL", null, Replacer.ReplaceValue, Table.ColumnNames(#"Promoted headers")
  ),
  #"Changed column type" = Table.TransformColumnTypes(
    #"Replace NULLs", 
    {
      {"id", type text}, 
      {"trb_request_id", type text}, 
      {"status", type text}, 
      {"component", type text}, 
      {"needs_assistance_with", type text}, 
      {"has_solution_in_mind", type logical}, 
      {"proposed_solution", type text}, 
      {"where_in_process", type text}, 
      {"where_in_process_other", type text}, 
      {"has_expected_start_end_dates", type logical}, 
      {"expected_start_date", type datetime}, 
      {"expected_end_date", type datetime}, 
      {"collab_groups", type text}, 
      {"collab_date_security", type text}, 
      {"collab_date_enterprise_architecture", type text}, 
      {"collab_date_cloud", type text}, 
      {"collab_date_privacy_advisor", type text}, 
      {"collab_date_governance_review_board", type text}, 
      {"collab_date_other", type text}, 
      {"collab_group_other", type text}, 
      {"created_by", type text}, 
      {"created_at", type datetime}, 
      {"modified_by", type text}, 
      {"modified_at", type datetime}, 
      {"submitted_at", type datetime}, 
      {"collab_grb_consult_requested", type logical}, 
      {"subject_area_options", type text}, 
      {"subject_area_option_other", type text}
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
