section Section1;
shared MaxDataverseCurrencyValue = 922337203685477;
shared NormalizeLegacyBusinessCaseId = (value as any) as nullable text =>
  if value = null then
      null
  else
      let
          normalized = Text.Upper(Text.Trim(Text.From(value)))
      in
          if normalized = "" or normalized = "NULL" then null else normalized;
shared EstimatedLifecycleCostPreparation = let
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

    HasPopulatedValue = (value as any) as logical =>
        let
            textValue = if value = null then null else Text.Trim(Text.From(value))
        in
            textValue <> null and textValue <> "" and Text.Upper(textValue) <> "NULL",

    WithKeys =
        Table.AddColumn(
            StagingRaw,
            "LegacyBusinessCaseId",
            each NormalizeLegacyBusinessCaseId([cr69a_businesscase]),
            type nullable text
        ),

    WithSolutionType =
        Table.AddColumn(
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
            type nullable number
        ),

    WithCost =
        Table.AddColumn(
            WithSolutionType,
            "CostValue",
            each try Number.From([cr69a_cost]) otherwise null,
            type nullable number
        ),

    WithYear =
        Table.AddColumn(
            WithCost,
            "YearNumber",
            each try Number.From([cr69a_year]) otherwise null,
            type nullable number
        ),

    WithValidationIssues =
        Table.AddColumn(
            WithYear,
            "InvalidSourceIssues",
            (row as record) =>
                let
                    rawBusinessCaseId = Record.FieldOrDefault(row, "cr69a_businesscase", null),
                    rawSolution = Record.FieldOrDefault(row, "cr69a_solution", null),
                    rawYear = Record.FieldOrDefault(row, "cr69a_year", null),
                    rawCost = Record.FieldOrDefault(row, "cr69a_cost", null),
                    solutionKey = NormalizeChoiceKey(rawSolution),
                    issues = List.RemoveNulls(
                        {
                            if Record.Field(row, "LegacyBusinessCaseId") = null then
                                "cr69a_businesscase is blank"
                            else
                                null,
                            if not HasPopulatedValue(rawSolution) then
                                "cr69a_solution is blank"
                            else if solutionKey = null or not Record.HasFields(SolutionTypeMap, solutionKey) then
                                "cr69a_solution=" & Text.From(rawSolution)
                            else
                                null,
                            if not HasPopulatedValue(rawYear) then
                                "cr69a_year is blank"
                            else if Record.Field(row, "YearNumber") = null or
                                not List.Contains({1, 2, 3, 4, 5}, Record.Field(row, "YearNumber")) then
                                "cr69a_year=" & Text.From(rawYear)
                            else
                                null,
                            if not HasPopulatedValue(rawCost) then
                                "cr69a_cost is blank"
                            else if Record.Field(row, "CostValue") = null then
                                "cr69a_cost=" & Text.From(rawCost)
                            else
                                null
                        }
                    )
                in
                    if List.IsEmpty(issues) then null else Text.Combine(issues, "; "),
            type nullable text
        )
in
    WithValidationIssues;
shared InvalidSourceRows = let
    InvalidRows = Table.SelectRows(EstimatedLifecycleCostPreparation, each [InvalidSourceIssues] <> null),
    SelectedColumns = Table.SelectColumns(
        InvalidRows,
        {
            "cr69a_id",
            "cr69a_businesscase",
            "cr69a_solution",
            "cr69a_year",
            "cr69a_cost",
            "InvalidSourceIssues"
        },
        MissingField.UseNull
    )
in
    SelectedColumns;
shared EstimatedLifecycleCosts = let

    ValidRows =
        Table.SelectRows(
            EstimatedLifecycleCostPreparation,
            each [InvalidSourceIssues] = null
        ),

    Grouped =
        Table.Group(
            ValidRows,
            {"LegacyBusinessCaseId", "solution_type_dataverse", "YearNumber"},
            {{"YearCost", each List.Sum([CostValue]), type number}}
        ),

    WithYearColumn =
        Table.AddColumn(
            Grouped,
            "YearColumn",
            each "new_fy" & Text.From([YearNumber]) & "costperyear",
            type text
        ),

    Pivoted =
        Table.Pivot(
            Table.SelectColumns(
                WithYearColumn,
                {
                    "LegacyBusinessCaseId",
                    "solution_type_dataverse",
                    "YearColumn",
                    "YearCost"
                }
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

    WithMissingYearColumns =
        List.Accumulate(
            YearCostColumns,
            Pivoted,
            (state as table, columnName as text) =>
                if Table.HasColumns(state, columnName) then
                    state
                else
                    Table.AddColumn(state, columnName, each 0, type number)
        ),

    WithMissingYearDefaults =
        Table.TransformColumns(
            WithMissingYearColumns,
            List.Transform(
                YearCostColumns,
                each {_, each if _ = null then 0 else _, type number}
            )
        )
in
    WithMissingYearDefaults;
shared InvalidCostRows = let
    // Dataverse currency fields cannot store values outside +/- 922,337,203,685,477.
    // Lifecycle costs are migrated as dollars, not cents; values above this limit are treated as bad source data.
    YearCostColumns = {
        "new_fy1costperyear",
        "new_fy2costperyear",
        "new_fy3costperyear",
        "new_fy4costperyear",
        "new_fy5costperyear"
    },
    Unpivoted =
        Table.Unpivot(
            EstimatedLifecycleCosts,
            YearCostColumns,
            "FiscalYearCostField",
            "CostValue"
        ),
    InvalidRows =
        Table.SelectRows(
            Unpivoted,
            each Number.Abs([CostValue]) > MaxDataverseCurrencyValue
        ),
    SelectedColumns =
        Table.SelectColumns(
            InvalidRows,
            {
                "LegacyBusinessCaseId",
                "solution_type_dataverse",
                "FiscalYearCostField",
                "CostValue"
            }
        )
in
    SelectedColumns;
shared ExistingRequests = let
    Source = CommonDataService.Database(DataverseEnvironmentUrl),
    Requests = Source{[Schema = "dbo", Item = "new_systemintake"]}[Data],

    SelectedColumns =
        Table.SelectColumns(
            Requests,
            {
                "new_systemintakeid",
                "new_legacybusinesscaseid"
            },
            MissingField.Error
        ),

    WithNormalizedLegacyId =
        Table.TransformColumns(
            SelectedColumns,
            {{"new_legacybusinesscaseid", each NormalizeLegacyBusinessCaseId(_), type nullable text}}
        )
in
    WithNormalizedLegacyId;
shared DuplicateRequestLegacyBusinessCaseIds = let
    NonBlankRequests =
        Table.SelectRows(
            ExistingRequests,
            each [new_legacybusinesscaseid] <> null and [new_legacybusinesscaseid] <> ""
        ),
    Grouped =
        Table.Group(
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
shared EstimatedLifecycleCostIdsWithoutRequestIds = let
    LifecycleIds =
        Table.Distinct(
            Table.SelectRows(
                Table.SelectColumns(EstimatedLifecycleCosts, {"LegacyBusinessCaseId"}),
                each [LegacyBusinessCaseId] <> null and [LegacyBusinessCaseId] <> ""
            )
        ),
    RequestIds =
        Table.Distinct(
            Table.SelectRows(
                Table.SelectColumns(ExistingRequests, {"new_legacybusinesscaseid"}),
                each [new_legacybusinesscaseid] <> null and [new_legacybusinesscaseid] <> ""
            )
        ),
    Joined =
        Table.NestedJoin(
            LifecycleIds,
            {"LegacyBusinessCaseId"},
            RequestIds,
            {"new_legacybusinesscaseid"},
            "RequestMatch",
            JoinKind.LeftOuter
        ),
    Missing = Table.SelectRows(Joined, each Table.IsEmpty([RequestMatch])),
    SelectedColumns = Table.RemoveColumns(Missing, {"RequestMatch"})
in
    SelectedColumns;
shared ExistingSolutions = let
    Source = CommonDataService.Database(DataverseEnvironmentUrl),
    Solutions = Source{[Schema = "dbo", Item = "cr69a_businesscasesolution"]}[Data],

    SelectedColumns =
        Table.SelectColumns(
            Solutions,
            {
                "cr69a_businesscasesolutionid",
                "new_request",
                "cr69a_solution_type",
                "cr69a_batchid"
            },
            MissingField.Error
        )
in
    SelectedColumns;
shared EstimatedLifecycleCostsWithRequests = let
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
shared EstimatedLifecycleCostsWithoutRequest = let
  MissingRequests = Table.SelectRows(EstimatedLifecycleCostsWithRequests, each [new_systemintakeid] = null)
in
  MissingRequests;
shared EstimatedLifecycleCostsWithSolutions = let
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
      Joined,
      "SolutionMatch",
      {"cr69a_businesscasesolutionid", "new_request", "cr69a_batchid"},
      {"cr69a_businesscasesolutionid", "new_request", "cr69a_batchid"}
  )
in
  Expanded;
shared EstimatedLifecycleCostsWithoutSolution = let
    MissingSolutions = Table.SelectRows(
        EstimatedLifecycleCostsWithSolutions, each [cr69a_businesscasesolutionid] = null
    )
in
    MissingSolutions;
shared Query = let
    ValidatedEstimatedLifecycleCosts =
        if Table.RowCount(InvalidSourceRows) > 0 then
            error
                "One or more lifecycle cost source rows has an invalid business case ID, solution, year, or cost. Review InvalidSourceRows before loading solution costs."
        else if Table.RowCount(InvalidCostRows) > 0 then
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
            "new_request",
            "cr69a_batchid",
            "new_fy1costperyear",
            "new_fy2costperyear",
            "new_fy3costperyear",
            "new_fy4costperyear",
            "new_fy5costperyear"
        }
    ),
    WithCurrencyTypes = Table.TransformColumnTypes(
        UpdateColumns,
        {
            {"new_fy1costperyear", Currency.Type},
            {"new_fy2costperyear", Currency.Type},
            {"new_fy3costperyear", Currency.Type},
            {"new_fy4costperyear", Currency.Type},
            {"new_fy5costperyear", Currency.Type}
        }
    )
in
    WithCurrencyTypes;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
