let
    Source = CommonDataService.Database("icpg-dev.crm9.dynamics.com"),
    StagingRaw = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingestimatedlifecycleco"]}[Data],
    // =========================================
    // Choice mapping specs
    // =========================================
    ChoiceSpecs = {
        [
            source = "cr69a_phase",
            dest = "lifecycle_cost_phase_dataverse",
            map = [
                DEVELOPMENT = 971270000,
                OPERATIONS_AND_MAINTENANCE = 971270001,
                HELP_DESK_CALL_CENTER = 971270002,
                SOFTWARE_LICENSES = 971270003,
                PLANNING_SUPPORT_AND_PROFESSIONAL_SERVICES = 971270004,
                INFRASTRUCTURE = 971270005,
                OIT_SERVICES_TOOLS_AND_PILOTS = 971270006,
                OTHER = 971270007
            ]
        ],
        [
            source = "cr69a_year",
            dest = "year_dataverse",
            map = [
                #"1" = 971270000,
                #"2" = 971270001,
                #"3" = 971270002,
                #"4" = 971270003,
                #"5" = 971270004
            ]
        ],
        [
            source = "cr69a_solution",
            dest = "solution_type_dataverse",
            map = [
                PREFERRED = 971270000,
                A = 971270001,
                B = 971270002
            ]
        ]
    },
    // =========================================
    // Helper: normalize source text -> enum key
    // "MIP Base" -> "MIP_BASE"
    // "Disc PI Medicare (MIP)" -> "DISC_PI_MEDICARE_MIP"
    // =========================================
    NormalizeChoiceKey = (v as any) as nullable text =>
        if v = null then
            null
        else
            let
                t0 = Text.From(v),
                t1 = Text.Upper(Text.Trim(t0)),
                t2 = Text.Replace(t1, " ", "_"),
                t3 = Text.Replace(t2, "(", ""),
                t4 = Text.Replace(t3, ")", ""),
                t5 = Text.Replace(t4, "-", "_"),
                t6 = Text.Replace(t5, "/", "_"),
                t7 = Text.Replace(t6, ",", "")
            in
                t7,
    // set to true to see unmapped issues
    // =========================================
    // Apply all choice mappings
    // - Adds <source>_raw column (exact original)
    // - Adds <dest> column with Dataverse integer
    // =========================================
    ApplyAll = List.Accumulate(
        ChoiceSpecs,
        StagingRaw,
        (state as table, spec as record) =>
            let
                src = spec[source],
                dest = spec[dest],
                map = spec[map],
                rawCol = src & "_raw",
                // 1) Add raw column preserving original value as text
                WithRaw = Table.AddColumn(
                    state,
                    rawCol,
                    each
                        let
                            original = try Record.Field(_, src) otherwise null
                        in
                            if original = null then
                                null
                            else
                                Text.From(original),
                    type text
                ),
                // 2) Add Dataverse choice column using normalized key
                WithChoice = Table.AddColumn(
                    WithRaw,
                    dest,
                    each
                        let
                            raw = Record.Field(_, rawCol), key = NormalizeChoiceKey(raw)
                        in
                            if key = null then
                                null
                            else if Record.HasFields(map, key) then
                                Record.Field(map, key)
                            else
                                null,
                    Int64.Type
                )
            in
                WithChoice
    ),
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
    ELC = ApplyAll,
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
