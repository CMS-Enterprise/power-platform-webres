section Section1;

shared MaxDataverseCurrencyValue = 922337203685477;
shared EstimatedLifecycleCosts =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        StagingRaw = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingestimatedlifecycleco"]}[Data],
        NormalizeChoiceKey = (value as any) as nullable text =>
            if value = null then
                null
            else
                let
                    textValue = Text.Upper(Text.Trim(Text.From(value))),
                    normalizedSpaces = Text.Replace(textValue, " ", "_"),
                    withoutOpenParen = Text.Replace(normalizedSpaces, "(", ""),
                    withoutCloseParen = Text.Replace(withoutOpenParen, ")", ""),
                    withoutDash = Text.Replace(withoutCloseParen, "-", "_"),
                    withoutSlash = Text.Replace(withoutDash, "/", "_"),
                    withoutComma = Text.Replace(withoutSlash, ",", "")
                in
                    withoutComma,
        SolutionTypeMap = [
            PREFERRED = 971270000,
            A = 971270001,
            B = 971270002
        ],
        WithKeys = Table.AddColumn(
            StagingRaw,
            "LegacyBusinessCaseId",
            each if [cr69a_businesscase] = null then null else Text.Trim(Text.From([cr69a_businesscase])),
            type nullable text
        ),
        WithSolutionType = Table.AddColumn(
            WithKeys,
            "solution_type_dataverse",
            each
                let
                    key = NormalizeChoiceKey([cr69a_solution])
                in
                    if key = null or not Record.HasFields(SolutionTypeMap, key) then
                        null
                    else
                        Record.Field(SolutionTypeMap, key),
            Int64.Type
        ),
        WithCost = Table.AddColumn(
            WithSolutionType, "CostValue", each try Number.From([cr69a_cost]) otherwise 0, Currency.Type
        ),
        WithYear = Table.AddColumn(
            WithCost, "YearNumber", each try Number.From([cr69a_year]) otherwise null, Int64.Type
        ),
        ValidRows = Table.SelectRows(
            WithYear,
            each
                [LegacyBusinessCaseId] <> null
                and [LegacyBusinessCaseId] <> ""
                and [solution_type_dataverse] <> null
                and List.Contains({1, 2, 3, 4, 5}, [YearNumber])
        ),
        Grouped = Table.Group(
            ValidRows,
            {"LegacyBusinessCaseId", "solution_type_dataverse", "YearNumber"},
            {{"YearCost", each List.Sum([CostValue]), Currency.Type}}
        ),
        WithYearColumn = Table.AddColumn(
            Grouped, "YearColumn", each "new_fy" & Text.From([YearNumber]) & "costperyear", type text
        ),
        Pivoted = Table.Pivot(
            Table.SelectColumns(
                WithYearColumn, {"LegacyBusinessCaseId", "solution_type_dataverse", "YearColumn", "YearCost"}
            ),
            {
                "new_fy1costperyear",
                "new_fy2costperyear",
                "new_fy3costperyear",
                "new_fy4costperyear",
                "new_fy5costperyear"
            },
            "YearColumn",
            "YearCost",
            List.Sum
        ),
        YearCostColumns = {
            "new_fy1costperyear",
            "new_fy2costperyear",
            "new_fy3costperyear",
            "new_fy4costperyear",
            "new_fy5costperyear"
        },
        WithMissingYearColumns = List.Accumulate(
            YearCostColumns,
            Pivoted,
            (state as table, columnName as text) =>
                if Table.HasColumns(state, columnName) then
                    state
                else
                    Table.AddColumn(state, columnName, each 0, Currency.Type)
        ),
        WithMissingYearDefaults = Table.TransformColumns(
            WithMissingYearColumns,
            List.Transform(YearCostColumns, each {_, each if _ = null then 0 else _, Currency.Type})
        )
    in
        WithMissingYearDefaults;
shared InvalidCostRows =
    let
        // Dataverse currency fields cannot store values outside +/- 922,337,203,685,477.
        // Lifecycle costs are migrated as dollars, not cents; values above this limit are treated as bad source data.
        YearCostColumns = {
            "new_fy1costperyear",
            "new_fy2costperyear",
            "new_fy3costperyear",
            "new_fy4costperyear",
            "new_fy5costperyear"
        },
        Unpivoted = Table.Unpivot(EstimatedLifecycleCosts, YearCostColumns, "FiscalYearCostField", "CostValue"),
        InvalidRows = Table.SelectRows(Unpivoted, each Number.Abs([CostValue]) > MaxDataverseCurrencyValue),
        SelectedColumns = Table.SelectColumns(
            InvalidRows, {"LegacyBusinessCaseId", "solution_type_dataverse", "FiscalYearCostField", "CostValue"}
        )
    in
        SelectedColumns;
shared ExistingRequests =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        Requests = Source{[Schema = "dbo", Item = "new_systemintake"]}[Data],
        SelectedColumns = Table.SelectColumns(
            Requests, {"new_systemintakeid", "new_legacybusinesscaseid"}, MissingField.Error
        ),
        WithNormalizedLegacyId = Table.TransformColumns(
            SelectedColumns,
            {{"new_legacybusinesscaseid", each if _ = null then null else Text.Trim(Text.From(_)), type nullable text}}
        )
    in
        WithNormalizedLegacyId;
shared DuplicateRequestLegacyBusinessCaseIds =
    let
        NonBlankRequests = Table.SelectRows(
            ExistingRequests, each [new_legacybusinesscaseid] <> null and [new_legacybusinesscaseid] <> ""
        ),
        Grouped = Table.Group(
            NonBlankRequests,
            {"new_legacybusinesscaseid"},
            {
                {"RequestCount", each Table.RowCount(_), Int64.Type},
                {"RequestIds", each Text.Combine(List.Transform([new_systemintakeid], Text.From), ", "), type text}
            }
        ),
        Duplicates = Table.SelectRows(Grouped, each [RequestCount] > 1)
    in
        Duplicates;
shared ExistingSolutions =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        Solutions = Source{[Schema = "dbo", Item = "cr69a_businesscasesolution"]}[Data],
        SelectedColumns = Table.SelectColumns(
            Solutions, {"cr69a_businesscasesolutionid", "new_request", "cr69a_solution_type"}, MissingField.Error
        )
    in
        SelectedColumns;
shared EstimatedLifecycleCostsWithRequests =
    let
        Joined = Table.NestedJoin(
            EstimatedLifecycleCosts,
            {"LegacyBusinessCaseId"},
            ExistingRequests,
            {"new_legacybusinesscaseid"},
            "RequestMatch",
            JoinKind.LeftOuter
        ),
        Expanded = Table.ExpandTableColumn(Joined, "RequestMatch", {"new_systemintakeid"}, {"new_systemintakeid"})
    in
        Expanded;
shared EstimatedLifecycleCostsWithoutRequest =
    let
        MissingRequests = Table.SelectRows(EstimatedLifecycleCostsWithRequests, each [new_systemintakeid] = null)
    in
        MissingRequests;
shared EstimatedLifecycleCostsWithSolutions =
    let
        MatchedRequests = Table.SelectRows(EstimatedLifecycleCostsWithRequests, each [new_systemintakeid] <> null),
        Joined = Table.NestedJoin(
            MatchedRequests,
            {"new_systemintakeid", "solution_type_dataverse"},
            ExistingSolutions,
            {"new_request", "cr69a_solution_type"},
            "SolutionMatch",
            JoinKind.LeftOuter
        ),
        Expanded = Table.ExpandTableColumn(
            Joined, "SolutionMatch", {"cr69a_businesscasesolutionid"}, {"cr69a_businesscasesolutionid"}
        )
    in
        Expanded;
shared EstimatedLifecycleCostsWithoutSolution =
    let
        MissingSolutions = Table.SelectRows(
            EstimatedLifecycleCostsWithSolutions, each [cr69a_businesscasesolutionid] = null
        )
    in
        MissingSolutions;
shared Query =
    let
        ValidatedEstimatedLifecycleCosts =
            if Table.RowCount(InvalidCostRows) > 0 then
                error
                    "One or more grouped fiscal year costs exceeds the Dataverse currency maximum. Review InvalidCostRows before loading solution costs."
            else if Table.RowCount(DuplicateRequestLegacyBusinessCaseIds) > 0 then
                error
                    "One or more legacy business case IDs maps to multiple Requests. Review DuplicateRequestLegacyBusinessCaseIds before loading solution costs."
            else if Table.RowCount(EstimatedLifecycleCostsWithoutRequest) > 0 then
                error
                    "One or more lifecycle cost groups could not be matched to a Request. Review EstimatedLifecycleCostsWithoutRequest before loading solution costs."
            else if Table.RowCount(EstimatedLifecycleCostsWithoutSolution) > 0 then
                error
                    "One or more lifecycle cost groups could not be matched to a Solution. Review EstimatedLifecycleCostsWithoutSolution before loading solution costs."
            else
                EstimatedLifecycleCostsWithSolutions,
        UpdateColumns = Table.SelectColumns(
            ValidatedEstimatedLifecycleCosts,
            {
                "cr69a_businesscasesolutionid",
                "new_fy1costperyear",
                "new_fy2costperyear",
                "new_fy3costperyear",
                "new_fy4costperyear",
                "new_fy5costperyear"
            }
        )
    in
        UpdateColumns;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
    IsParameterQuery = true,
    IsParameterQueryRequired = false,
    Type = type text
];
