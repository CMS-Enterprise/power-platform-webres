section Section1;
shared ContractNumberPreparation = let
    Source = CommonDataService.Database(DataverseEnvironmentUrl),
    StagingRaw = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingcontractnumber"]}[Data],
    ExistingRequestsRaw = Source{[Schema = "dbo", Item = "new_systemintake"]}[Data],
    StagingColumnNames = Table.ColumnNames(StagingRaw),
    ResolveColumnName = (label as text, candidates as list) as text =>
        let
            matches = List.Select(candidates, each List.Contains(StagingColumnNames, _)),
            result = if List.IsEmpty(matches) then null else List.First(matches)
        in
            if result = null then
                error "Contract Number staging table is missing the " & label & " column."
            else
                result,
    RecordIdColumn = ResolveColumnName(
        "record ID",
        {"cr69a_recordid", "cr69a_id", "easi_contractnumberid"}
    ),
    RequestIdColumn = ResolveColumnName(
        "Request ID",
        {"cr69a_systemintakeid", "cr69a_system_intake_id", "cr69a_systemintake", "cr69a_requestid", "cr69a_request"}
    ),
    ContractNumberColumn = ResolveColumnName(
        "contract number",
        {"cr69a_contractnumber", "easi_contractnumber", "cr69a_contract_number"}
    ),
    HasPopulatedValue = (value as any) as logical =>
        let
            textValue = if value = null then null else Text.Trim(Text.From(value))
        in
            textValue <> null and textValue <> "" and Text.Upper(textValue) <> "NULL",
    NormalizeId = (value as any) as nullable text =>
        if not HasPopulatedValue(value) then
            null
        else
            Text.Lower(Text.Trim(Text.From(value))),
    WithNormalizedRecordId = Table.AddColumn(
        StagingRaw,
        "NormalizedContractRecordId",
        each NormalizeId(Record.Field(_, RecordIdColumn)),
        type nullable text
    ),
    WithNormalizedRequestId = Table.AddColumn(
        WithNormalizedRecordId,
        "NormalizedRequestId",
        each NormalizeId(Record.Field(_, RequestIdColumn)),
        type nullable text
    ),
    DuplicateRecordIds = let
        NonBlankIds = Table.SelectRows(
            WithNormalizedRequestId,
            each [NormalizedContractRecordId] <> null
        ),
        Grouped = Table.Group(
            NonBlankIds,
            {"NormalizedContractRecordId"},
            {{"RecordCount", each Table.RowCount(_), Int64.Type}}
        ),
        Duplicates = Table.SelectRows(Grouped, each [RecordCount] > 1)
    in
        List.Buffer(Duplicates[NormalizedContractRecordId]),
    ExistingRequests = Table.TransformColumns(
        Table.SelectColumns(ExistingRequestsRaw, {"new_systemintakeid"}, MissingField.Error),
        {{"new_systemintakeid", each NormalizeId(_), type nullable text}}
    ),
    WithRequestMatch = Table.NestedJoin(
        WithNormalizedRequestId,
        {"NormalizedRequestId"},
        ExistingRequests,
        {"new_systemintakeid"},
        "RequestMatch",
        JoinKind.LeftOuter
    ),
    WithQA = Table.AddColumn(
        WithRequestMatch,
        "UnmappedIssues",
        (row as record) =>
            let
                recordId = Record.FieldOrDefault(row, "NormalizedContractRecordId", null),
                requestId = Record.FieldOrDefault(row, "NormalizedRequestId", null),
                contractNumber = Record.FieldOrDefault(row, ContractNumberColumn, null),
                requestMatch = Record.FieldOrDefault(row, "RequestMatch", #table({}, {})),
                issues = List.RemoveNulls(
                    {
                        if recordId = null then
                            RecordIdColumn & " is blank"
                        else
                            null,
                        if requestId = null then
                            RequestIdColumn & " is blank"
                        else
                            null,
                        if not HasPopulatedValue(contractNumber) then
                            ContractNumberColumn & " is blank"
                        else
                            null,
                        if recordId <> null and List.Contains(DuplicateRecordIds, recordId) then
                            "Duplicate contract record ID=" & recordId
                        else
                            null,
                        if requestId = null or not Table.IsEmpty(requestMatch) then
                            null
                        else
                            "No Request matched " & RequestIdColumn & "=" & requestId
                    }
                )
            in
                if List.IsEmpty(issues) then null else Text.Combine(issues, "; "),
        type nullable text
    )
in
    WithQA;
shared ContractNumberQA = let
    Issues = Table.SelectRows(ContractNumberPreparation, each [UnmappedIssues] <> null),
    Output = Table.SelectColumns(
        Issues,
        List.Combine(
            {
                List.Intersect(
                    {
                        {"cr69a_recordid", "cr69a_id", "easi_contractnumberid", "cr69a_systemintakeid", "cr69a_system_intake_id", "cr69a_systemintake", "cr69a_requestid", "cr69a_request", "cr69a_contractnumber", "easi_contractnumber", "cr69a_contract_number"},
                        Table.ColumnNames(Issues)
                    }
                ),
                {"UnmappedIssues"}
            }
        ),
        MissingField.Error
    )
in
    Output;
shared ContractNumbers = let
    ValidatedPreparation =
        if Table.RowCount(ContractNumberQA) > 0 then
            error "One or more Contract Number rows is invalid or could not be matched to a Request. Review ContractNumberQA before loading Contract Numbers."
        else
            ContractNumberPreparation,
    HelperColumns = {
        "NormalizedContractRecordId",
        "NormalizedRequestId",
        "RequestMatch",
        "UnmappedIssues"
    },
    Output = Table.RemoveColumns(ValidatedPreparation, HelperColumns, MissingField.Ignore),
    WithoutComplexColumns = Table.RemoveColumns(
        Output,
        Table.ColumnsOfType(
            Output,
            {type table, type record, type list, type nullable binary, type binary, type function}
        )
    )
in
    WithoutComplexColumns;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
    IsParameterQuery = true,
    IsParameterQueryRequired = false,
    Type = type text
];
