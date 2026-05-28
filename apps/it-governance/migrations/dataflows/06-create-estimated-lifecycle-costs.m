section Section1;
shared ELCKeys = let
    Source = CommonDataService.Database(DataverseEnvironmentUrl),
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

    ApplyAll =
        List.Accumulate(
            ChoiceSpecs,
            StagingRaw,
            (state as table, spec as record) =>
                let
                    src = spec[source],
                    dest = spec[dest],
                    map = spec[map],
                    rawCol = src & "_raw",
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
                    WithChoice = Table.AddColumn(
                        WithRaw,
                        dest,
                        each
                            let
                                raw = Record.Field(_, rawCol),
                                key = NormalizeChoiceKey(raw)
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

    WithLegacyBusinessCaseId =
        Table.AddColumn(
            ApplyAll,
            "LegacyBusinessCaseId",
            each Text.Trim(Text.From([cr69a_businesscase])),   // <-- swap this source field if needed
            type text
        ),
  #"From Value" = Table.FromValue(WithLegacyBusinessCaseId),
  #"Remove Columns" = Table.RemoveColumns(#"From Value", Table.ColumnsOfType(#"From Value", {type table, type record, type list, type nullable binary, type binary, type function}))
in
    #"Remove Columns";
shared ExistingSolutions = let
    Source = CommonDataService.Database(DataverseEnvironmentUrl),
    #"Navigation 1" = Source{[Schema = "dbo", Item = "cr69a_businesscasesolution"]}[Data],

    // Select only the key columns from the actual Solutions table
    SelectedColumns = Table.SelectColumns(
        #"Navigation 1",
        {
            "cr69a_legacybusinesscaseid",   // name of your Legacy BC ID column
            "cr69a_solution_type"           // schema name of Solution Type option set
        },
        MissingField.Ignore                  // prevents errors if you mis-type a column
    )
in
    SelectedColumns;
shared Query = let
    // Aliases for readability
    ELC = ELCKeys,                    // query #1 (with LegacyBusinessCaseId + solution_type_dataverse)
    Solutions = ExistingSolutions,    // query #2 (from Dataverse)

    Joined =
        Table.NestedJoin(
            ELC,
            {"LegacyBusinessCaseId", "solution_type_dataverse"},
            Solutions,
            {"cr69a_legacybusinesscaseid", "cr69a_solution_type"},
            "SolutionMatch",
            JoinKind.LeftOuter
        ),

    // Keep only rows where no Solution was matched
    Unmatched =
        Table.SelectRows(
            Joined,
            each Table.IsEmpty([SolutionMatch])
        ),

    // Optional: Only keep a few columns to make it easier to read
    Preview =
        Table.SelectColumns(
            Unmatched,
            {
                "LegacyBusinessCaseId",
                "solution_type_dataverse",
                "cr69a_caseid",
                "cr69a_businesscase",
                "cr69a_phase",
                "cr69a_year",
                "cr69a_cost"
            },
            MissingField.Ignore
        )
in
    Unmatched;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
