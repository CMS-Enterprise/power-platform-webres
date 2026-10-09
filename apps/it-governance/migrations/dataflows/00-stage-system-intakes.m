section Section1;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared SharePointSiteUrl = "https://cmsgovonline.sharepoint.com/" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared FolderPath = "sites/CMS-SharePoint-OIT-Classic/CIOCorner/EASi%20data%20migration/Development/" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared FileName = "system_intakes.csv" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared #"system_intakes 1" = let
	CsvUrl = SharePointSiteUrl & FolderPath & FileName,
    ExpectedColumns = Text.Split("id,eua_user_id,requester,component,business_owner,business_owner_component,product_manager,product_manager_component,isso,trb_collaborator,oit_security_collaborator,ea_collaborator,project_name,existing_funding,funding_source,business_need,solution,process_status,ea_support_request,existing_contract,updated_at,submitted_at,alfabet_id,created_at,grt_review_email_body,requester_email_address,decided_at,archived_at,cost_increase,cost_increase_amount,lcid,lcid_expires_at,lcid_scope,contractor,contract_vehicle,contract_start_month,contract_start_year,contract_end_month,contract_end_year,funding_number,request_type,project_acronym,grt_date,grb_date,rejection_reason,decision_next_steps,isso_name,trb_collaborator_name,oit_security_collaborator_name,ea_collaborator_name,admin_lead,contract_start_date,contract_end_date,lcid_cost_baseline,cedar_system_id,lcid_expiration_alert_ts,has_ui_changes,request_form_state,draft_business_case_state,final_business_case_state,decision_state,step,state,current_annual_spending,planned_year_one_spending,trb_follow_up_recommendation,lcid_retires_at,lcid_issued_at,contract_name,current_annual_spending_it_portion,planned_year_one_spending_it_portion,system_relation_type,uses_ai_tech,grb_review_started_at,using_software,acquisition_methods,grb_review_type,grb_review_async_reporting_date,grb_review_async_recording_time,grb_review_async_end_date,grb_presentation_deck_requester_reminder_email_sent_time,grb_review_async_manual_end_date,grb_review_reminder_last_sent,collaborator_508,collaborator_name_508,does_not_support_systems,governance_teams_is_present,digital_service_interaction,digital_service_interaction_description,protected_cms_data_accessed_outside,protected_cms_data_accessed_outside_description,current_estimated_cost,current_estimated_cost_it_portion,estimated_total_contract_value,estimated_total_contract_value_it_portion,lcid_type,lcid_is_low_it,lcid_is_shortened,lcid_component,priority_alignment", ","),
    Source =
        Csv.Document(
            Web.Contents(CsvUrl),
            [
                Delimiter = ",",
                Columns = List.Count(ExpectedColumns),
                QuoteStyle = QuoteStyle.Csv
            ]
        ),

    #"Promoted headers" =
        Table.PromoteHeaders(Source, [PromoteAllScalars = true]),

    #"Validated schema" =
        if Table.ColumnNames(#"Promoted headers") = ExpectedColumns
        then #"Promoted headers"
        else error Error.Record(
            "CSV schema mismatch",
            "system_intakes.csv columns do not match the migration query.",
            [Expected = ExpectedColumns, Actual = Table.ColumnNames(#"Promoted headers")]
        ),

    #"Replace NULLs" =
        Table.ReplaceValue(
            #"Validated schema",
            "NULL",
            null,
            Replacer.ReplaceValue,
            Table.ColumnNames(#"Validated schema")
        ),

    #"Changed column type" =
        Table.TransformColumnTypes(
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
                {"governance_teams_is_present", type logical},
                {"digital_service_interaction", type text},
                {"digital_service_interaction_description", type text},
                {"protected_cms_data_accessed_outside", type text},
                {"protected_cms_data_accessed_outside_description", type text},
                {"current_estimated_cost", type text},
                {"current_estimated_cost_it_portion", type text},
                {"estimated_total_contract_value", type text},
                {"estimated_total_contract_value_it_portion", type text},
                {"lcid_type", type text},
                {"lcid_is_low_it", type logical},
                {"lcid_is_shortened", type logical},
                {"lcid_component", type text},
                {"priority_alignment", type text}
            }
        ),

    // Dataverse DateTime fields do not support values before 1753-01-01.
    // The legacy export contains placeholder/test dates in earlier years, so
    // clear them after parsing but before loading the staging table.
    DataverseMinimumDate = #date(1753, 1, 1),
    DateTimeColumns = {
        "updated_at",
        "submitted_at",
        "created_at",
        "decided_at",
        "archived_at",
        "lcid_expires_at",
        "grt_date",
        "grb_date",
        "lcid_expiration_alert_ts",
        "lcid_retires_at",
        "lcid_issued_at",
        "grb_review_started_at",
        "grb_review_async_reporting_date",
        "grb_review_async_recording_time",
        "grb_review_async_end_date",
        "grb_presentation_deck_requester_reminder_email_sent_time",
        "grb_review_async_manual_end_date",
        "grb_review_reminder_last_sent"
    },
    DateColumns = {"contract_start_date", "contract_end_date"},
    DateTimeTransformations = List.Transform(
        DateTimeColumns,
        (columnName as text) =>
            {
                columnName,
                (value as nullable datetime) as nullable datetime =>
                    if value = null or Date.From(value) >= DataverseMinimumDate then value else null,
                type nullable datetime
            }
    ),
    DateTransformations = List.Transform(
        DateColumns,
        (columnName as text) =>
            {
                columnName,
                (value as nullable date) as nullable date =>
                    if value = null or value >= DataverseMinimumDate then value else null,
                type nullable date
            }
    ),
    #"Normalized Dataverse dates" = Table.TransformColumns(
        #"Changed column type",
        List.Combine({DateTimeTransformations, DateTransformations})
    ),

    // --- DATAVERSE LOOKUP FOR CURRENT BATCH ---
    Dv = CommonDataService.Database(DataverseEnvironmentUrl),

    MigrationRuns = Dv{[Name = "easi_migrationrun", Kind = "Table"]}[Data],

    // 100000000 is the Dataverse Choice value for the Running migration status.
    RunningOnly = Table.SelectRows(MigrationRuns, each [easi_migrationrunstatus] = 100000000),

    Sorted = Table.Sort(RunningOnly, {{"easi_startedon", Order.Descending}}),
    Latest = Table.FirstN(Sorted, 1),

    BatchId =
        if Table.RowCount(Latest) > 0
        then Text.From(Latest{0}[easi_batchid])
        else error "No Running MigrationRun found – check MigrationRun table.",

    // --- ADD BATCH ID TO OUTPUT ---
    #"Added Batch Id" = Table.AddColumn(#"Normalized Dataverse dates", "migrate_batch_id", each BatchId, type text)
in
    #"Added Batch Id";
