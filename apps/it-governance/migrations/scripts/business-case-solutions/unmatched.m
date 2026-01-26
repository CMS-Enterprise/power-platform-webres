let
    Source = CommonDataService.Database("icpg-dev.crm9.dynamics.com"),
    StagingRaw = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingestimatedlifecycleco"]}[Data],
    // 1. Start from your Solutions query (the one that already worked)
    SolutionsKey = Table.SelectColumns(StagingRaw,
    // your existing Solutions query name
    {
        "Legacy Business Case ID",
        // text
        "Solution Type"
        // choice numeric
    }),
    // 2. Start from your ELC staging query
    ELC = YourELCQuery,
    // replace with actual query name
    // 3. Join ELC to Solutions on the composite key
    Joined = Table.NestedJoin(
        ELC,
        {"LegacyBusinessCaseId", "solution_type_dataverse"},
        // columns in ELC query
        SolutionsKey,
        {"Legacy Business Case ID", "Solution Type"},
        // columns in Solution
        "SolutionMatch",
        JoinKind.LeftOuter
    ),
    // 4. Keep only rows where no Solution was found
    Unmatched = Table.SelectRows(Joined, each Table.IsEmpty([SolutionMatch]))
in
    Unmatched
