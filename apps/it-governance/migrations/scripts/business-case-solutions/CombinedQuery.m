let
    Combined = Table.Combine({CreatePreferredSolution, CreateAlternativeA, CreateAlternativeB}),
    // Convert TRUE/FALSE → 1/0
    Normalized = Table.TransformColumns(Combined, {{"Security Approved", each if _ = true then 1 else 0, Int64.Type}}),
    PreviewOnly = Table.SelectColumns(
        Combined,
        {
            "cr69a_id",
            "Title",
            "Summary",
            "Acquisition Approach",
            "Pros",
            "Cons",
            "Cost Savings",
            "Hosting Type",
            "Hosting Location",
            "Hosting Cloud Service Type",
            "Has UI",
            "Security Approved",
            "Security Currently Under Review",
            "Contract Award Date",
            "Target Completion Date",
            "Zero Trust Alignment",
            "Hosting Cloud Strategy",
            "Workforce Training Requirements",
            "SolutionType"
        }
    )
in
    PreviewOnly
