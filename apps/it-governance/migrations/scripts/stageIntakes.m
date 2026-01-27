let
    Source = Csv.Document(
        Web.Contents(
            "https://cmsgovonline-my.sharepoint.com/personal/cooper_heinrichs_cms_hhs_gov/Documents/Apps/Power Query Online GCC-L2/Uploaded Files/system_intakes.csv"
        ),
        [
            Delimiter = ",",
            Columns = 87,
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
            {"eua_user_id", type text},
            {"requester", type text},
            {"component", type text},
            {"business_owner", type text},
            {"business_owner_component", type text},
            {"product_manager", type text},
            {"product_manager_component", type text},
            {"isso", type text},
            {"trb_collaborator", type text},
            {"oit_security_collaborator", type text},
            {"ea_collaborator", type text},
            {"project_name", type text},
            {"existing_funding", type logical},
            {"funding_source", type text},
            {"business_need", type text},
            {"solution", type text},
            {"process_status", type text},
            {"ea_support_request", type logical},
            {"existing_contract", type text},
            {"updated_at", type datetime},
            {"submitted_at", type datetime},
            {"alfabet_id", type text},
            {"created_at", type datetime},
            {"grt_review_email_body", type text},
            {"requester_email_address", type text},
            {"decided_at", type datetime},
            {"archived_at", type datetime},
            {"cost_increase", type text},
            {"cost_increase_amount", type text},
            {"lcid", type text},
            {"lcid_expires_at", type datetime},
            {"lcid_scope", type text},
            {"contractor", type text},
            {"contract_vehicle", type text},
            {"contract_start_month", type text},
            {"contract_start_year", type text},
            {"contract_end_month", type text},
            {"contract_end_year", type text},
            {"funding_number", type text},
            {"request_type", type text},
            {"project_acronym", type text},
            {"grt_date", type datetime},
            {"grb_date", type datetime},
            {"rejection_reason", type text},
            {"decision_next_steps", type text},
            {"isso_name", type text},
            {"trb_collaborator_name", type text},
            {"oit_security_collaborator_name", type text},
            {"ea_collaborator_name", type text},
            {"admin_lead", type text},
            {"contract_start_date", type date},
            {"contract_end_date", type date},
            {"lcid_cost_baseline", type text},
            {"cedar_system_id", type text},
            {"lcid_expiration_alert_ts", type datetime},
            {"has_ui_changes", type logical},
            {"request_form_state", type text},
            {"draft_business_case_state", type text},
            {"final_business_case_state", type text},
            {"decision_state", type text},
            {"step", type text},
            {"state", type text},
            {"current_annual_spending", type text},
            {"planned_year_one_spending", type text},
            {"trb_follow_up_recommendation", type text},
            {"lcid_retires_at", type datetime},
            {"lcid_issued_at", type datetime},
            {"contract_name", type text},
            {"current_annual_spending_it_portion", type text},
            {"planned_year_one_spending_it_portion", type text},
            {"system_relation_type", type text},
            {"uses_ai_tech", type logical},
            {"grb_review_started_at", type datetime},
            {"using_software", type text},
            {"acquisition_methods", type text},
            {"grb_review_type", type text},
            {"grb_review_async_reporting_date", type datetime},
            {"grb_review_async_recording_time", type datetime},
            {"grb_review_async_end_date", type datetime},
            {"grb_presentation_deck_requester_reminder_email_sent_time", type datetime},
            {"grb_review_async_manual_end_date", type datetime},
            {"grb_review_reminder_last_sent", type datetime},
            {"collaborator_508", type text},
            {"collaborator_name_508", type text},
            {"does_not_support_systems", type logical},
            {"governance_teams_is_present", type logical}
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
