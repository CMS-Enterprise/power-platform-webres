let
    Source = BusinessCases,
    RenamedColumns = Table.RenameColumns(
        Source,
        {
            {"cr69a_alternative_b_title", "Title"},
            {"cr69a_alternative_b_summary", "Summary"},
            {"cr69a_alternative_b_acquisition_approach", "Acquisition Approach"},
            {"cr69a_alternative_b_pros", "Pros"},
            {"cr69a_alternative_b_cons", "Cons"},
            {"cr69a_alternative_b_cost_savings", "Cost Savings"},
            {"cr69a_alternative_b_hosting_type", "Hosting Type"},
            {"cr69a_alternative_b_hosting_location", "Hosting Location"},
            {"cr69a_alternative_b_hosting_cloud_service_typ", "Hosting Cloud Service Type"},
            {"cr69a_alternative_b_has_ui", "Has UI"},
            {"cr69a_alternative_b_security_is_approved", "Security Approved"},
            {"cr69a_alternative_b_security_is_being_reviewe", "Security Currently Under Review"},
            {"cr69a_alternative_b_target_contract_award_dat", "Contract Award Date"},
            {"cr69a_alternative_b_target_completion_date", "Target Completion Date"},
            {"cr69a_alternative_b_zero_trust_alignment", "Zero Trust Alignment"},
            {"cr69a_alternative_b_hosting_cloud_strategy", "Hosting Cloud Strategy"},
            {"cr69a_alternative_b_workforce_training_reqs", "Workforce Training Requirements"}
        }
    ),
    // Fill required/important fields with safe placeholders so shell solutions can be created
    WithDefaults = Table.TransformColumns(
        RenamedColumns,
        {
            // Title: placeholder when null/empty
            {"Title", each if _ = null or _ = "" then "Alternative B (placeholder)" else _, type text},
            // Text fields → "" instead of null
            {"Summary", each if _ = null then "" else _, type text},
            {"Acquisition Approach", each if _ = null then "" else _, type text},
            {"Pros", each if _ = null then "" else _, type text},
            {"Cons", each if _ = null then "" else _, type text},
            {"Hosting Type", each if _ = null then "" else _, type text},
            {"Hosting Location", each if _ = null then "" else _, type text},
            {"Hosting Cloud Service Type", each if _ = null then "" else _, type text},
            {"Zero Trust Alignment", each if _ = null then "" else _, type text},
            {"Hosting Cloud Strategy", each if _ = null then "" else _, type text},
            {"Workforce Training Requirements", each if _ = null then "" else _, type text},
            // Numbers → 0 instead of null
            {"Cost Savings", each if _ = null then 0 else _, Int64.Type},
            // Booleans → false when null
            {"Has UI", each if _ = null then false else _, type logical},
            {"Security Approved", each if _ = null then false else _, type logical},
            {"Security Currently Under Review", each if _ = null then false else _, type logical}
        }
    ),
    SolutionTypeAdded = Table.AddColumn(WithDefaults, "SolutionType", each 971270002, Int64.Type)
in
    SolutionTypeAdded
