let
    Source = BusinessCases,
    Rename = Table.RenameColumns(
        Source,
        {
            {"cr69a_preferred_title", "Title"},
            {"cr69a_preferred_summary", "Summary"},
            {"cr69a_preferred_acquisition_approach", "Acquisition Approach"},
            {"cr69a_preferred_pros", "Pros"},
            {"cr69a_preferred_cons", "Cons"},
            {"cr69a_preferred_cost_savings", "Cost Savings"},
            {"cr69a_preferred_hosting_type", "Hosting Type"},
            {"cr69a_preferred_hosting_location", "Hosting Location"},
            {"cr69a_preferred_hosting_cloud_service_type", "Hosting Cloud Service Type"},
            {"cr69a_preferred_has_ui", "Has UI"},
            {"cr69a_preferred_security_is_approved", "Security Approved"},
            {"cr69a_preferred_security_is_being_reviewed", "Security Currently Under Review"},
            {"cr69a_preferred_target_contract_award_date", "Contract Award Date"},
            {"cr69a_preferred_target_completion_date", "Target Completion Date"},
            {"cr69a_preferred_zero_trust_alignment", "Zero Trust Alignment"},
            {"cr69a_preferred_hosting_cloud_strategy", "Hosting Cloud Strategy"},
            {"cr69a_preferred_workforce_training_reqs", "Workforce Training Requirements"}
        }
    ),
    WithDefaults = Table.TransformColumns(
        Rename,
        {
            {"Title", each if _ = null or _ = "" then "Preferred Solution (placeholder)" else _, type text},
            {"Summary", each if _ = null then "" else _, type text},
            {"Acquisition Approach", each if _ = null then "" else _, type text},
            {"Pros", each if _ = null then "" else _, type text},
            {"Cons", each if _ = null then "" else _, type text},
            {"Cost Savings", each if _ = null then 0 else _, Int64.Type}
        }
    ),
    WithSolutionType = Table.AddColumn(WithDefaults, "SolutionType", each 971270000, Int64.Type)
in
    WithSolutionType
