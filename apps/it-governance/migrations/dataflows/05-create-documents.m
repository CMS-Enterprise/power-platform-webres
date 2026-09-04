section Section1;

shared DocumentPreparation =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        StagingRaw = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingdocument"]}[Data],
        ExistingRequestsRaw = Source{[Schema = "dbo", Item = "new_systemintake"]}[Data],
        StagingColumnNames = Table.ColumnNames(StagingRaw),
        ResolveColumnName = (label as text, candidates as list) as text =>
            let
                matches = List.Select(candidates, each List.Contains(StagingColumnNames, _)),
                result = if List.IsEmpty(matches) then null else List.First(matches)
            in
                if result = null then
                    error "Document staging table is missing the " & label & " column. Expected one of: " & Text.Combine(candidates, ", ")
                else
                    result,
        RecordIdColumn = ResolveColumnName(
            "record ID",
            {"cr69a_documentid", "cr69a_recordid", "cr69a_id", "easi_documentid", "id"}
        ),
        RequestIdColumn = ResolveColumnName(
            "Request ID",
            {"cr69a_systemintakeid", "cr69a_system_intake_id", "cr69a_systemintake", "cr69a_requestid", "cr69a_request", "system_intake_id"}
        ),
        FileNameColumn = ResolveColumnName(
            "file name",
            {"cr69a_filename", "cr69a_file_name", "file_name"}
        ),
        BucketColumn = ResolveColumnName(
            "bucket",
            {"cr69a_storagebucket", "cr69a_bucket", "bucket"}
        ),
        S3KeyColumn = ResolveColumnName(
            "S3 key",
            {"cr69a_s3key", "cr69a_s3_key", "s3_key"}
        ),
        DocumentVersionColumn = ResolveColumnName(
            "document version",
            {"cr69a_documentversion", "cr69a_document_version", "document_version"}
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
        NormalizeChoiceKey = (value as any) as nullable text =>
            if not HasPopulatedValue(value) then
                null
            else
                let
                    t0 = Text.From(value),
                    t1 = Text.Upper(Text.Trim(t0)),
                    t2 = Text.Replace(t1, " ", "_"),
                    t3 = Text.Replace(t2, "(", ""),
                    t4 = Text.Replace(t3, ")", ""),
                    t5 = Text.Replace(t4, "-", "_"),
                    t6 = Text.Replace(t5, "/", "_")
                in
                    t6,
        ChoiceSpecs = {
            [
                source = "cr69a_documenttype",
                dest = "document_type_dataverse_format",
                map = [
                    SOO_SOW = 971270000,
                    ACQUISITION_PLAN_OR_STRATEGY = 971270001,
                    DRAFT_IGCE = 971270002,
                    REQUEST_FOR_ADDITIONAL_FUNDING = 971270003,
                    SOFTWARE_BILL_OF_MATERIALS = 971270004,
                    MEETING_MINUTES = 971270005,
                    OTHER = 971270006
                ]
            ],
            [
                source = "cr69a_uploaderrole",
                dest = "uploader_role_dataverse_format",
                map = [
                    REQUESTER = 971270000,
                    ADMIN = 971270001
                ]
            ]
        },
        WithChoices = List.Accumulate(
            ChoiceSpecs,
            StagingRaw,
            (state as table, spec as record) =>
                let
                    sourceColumn = spec[source],
                    destinationColumn = spec[dest],
                    choiceMap = spec[map],
                    rawColumn = sourceColumn & "_raw",
                    WithRaw = Table.AddColumn(
                        state,
                        rawColumn,
                        each
                            let
                                original = Record.FieldOrDefault(_, sourceColumn, null)
                            in
                                if original = null then null else Text.From(original),
                        type nullable text
                    ),
                    WithChoice = Table.AddColumn(
                        WithRaw,
                        destinationColumn,
                        each
                            let
                                key = NormalizeChoiceKey(Record.FieldOrDefault(_, rawColumn, null))
                            in
                                if key <> null and Record.HasFields(choiceMap, key) then
                                    Record.Field(choiceMap, key)
                                else
                                    null,
                        Int64.Type
                    )
                in
                    WithChoice
        ),
        WithNormalizedDocumentId = Table.AddColumn(
            WithChoices,
            "NormalizedDocumentRecordId",
            each NormalizeId(Record.Field(_, RecordIdColumn)),
            type nullable text
        ),
        WithNormalizedRequestId = Table.AddColumn(
            WithNormalizedDocumentId,
            "NormalizedRequestId",
            each NormalizeId(Record.Field(_, RequestIdColumn)),
            type nullable text
        ),
        DuplicateDocumentIds =
            let
                NonBlankIds = Table.SelectRows(
                    WithNormalizedRequestId,
                    each [NormalizedDocumentRecordId] <> null
                ),
                Grouped = Table.Group(
                    NonBlankIds,
                    {"NormalizedDocumentRecordId"},
                    {{"RecordCount", each Table.RowCount(_), Int64.Type}}
                ),
                Duplicates = Table.SelectRows(Grouped, each [RecordCount] > 1)
            in
                List.Buffer(Duplicates[NormalizedDocumentRecordId]),
        ExistingRequests = Table.Buffer(
            Table.TransformColumns(
                Table.SelectColumns(ExistingRequestsRaw, {"easi_external_id"}, MissingField.Error),
                {{"easi_external_id", each NormalizeId(_), type nullable text}}
            )
        ),
        WithRequestMatch = Table.NestedJoin(
            WithNormalizedRequestId,
            {"NormalizedRequestId"},
            ExistingRequests,
            {"easi_external_id"},
            "RequestMatch",
            JoinKind.LeftOuter
        ),
        WithQA = Table.AddColumn(
            WithRequestMatch,
            "UnmappedIssues",
            (row as record) =>
                let
                    recordId = Record.FieldOrDefault(row, "NormalizedDocumentRecordId", null),
                    requestId = Record.FieldOrDefault(row, "NormalizedRequestId", null),
                    requestMatch = Record.FieldOrDefault(row, "RequestMatch", #table({}, {})),
                    requestMatchCount = Table.RowCount(requestMatch),
                    choiceIssues = List.Transform(
                        ChoiceSpecs,
                        (spec as record) =>
                            let
                                sourceColumn = spec[source],
                                choiceMap = spec[map],
                                rawValue = Record.FieldOrDefault(row, sourceColumn & "_raw", null),
                                key = NormalizeChoiceKey(rawValue)
                            in
                                if key = null then
                                    sourceColumn & " is blank"
                                else if not Record.HasFields(choiceMap, key) then
                                    sourceColumn & "=" & Text.From(rawValue)
                                else
                                    null
                    ),
                    issues = List.RemoveNulls(
                        List.Combine(
                            {
                                {
                                    if recordId = null then RecordIdColumn & " is blank" else null,
                                    if requestId = null then RequestIdColumn & " is blank" else null,
                                    if not HasPopulatedValue(Record.FieldOrDefault(row, FileNameColumn, null)) then FileNameColumn & " is blank" else null,
                                    if not HasPopulatedValue(Record.FieldOrDefault(row, BucketColumn, null)) then BucketColumn & " is blank" else null,
                                    if not HasPopulatedValue(Record.FieldOrDefault(row, S3KeyColumn, null)) then S3KeyColumn & " is blank" else null,
                                    if not HasPopulatedValue(Record.FieldOrDefault(row, DocumentVersionColumn, null)) then DocumentVersionColumn & " is blank" else null,
                                    if recordId <> null and List.Contains(DuplicateDocumentIds, recordId) then "Duplicate document record ID=" & recordId else null,
                                    if requestId <> null and requestMatchCount = 0 then "No Request matched " & RequestIdColumn & "=" & requestId else null,
                                    if requestId <> null and requestMatchCount > 1 then "Multiple Requests matched " & RequestIdColumn & "=" & requestId else null
                                },
                                choiceIssues
                            }
                        )
                    )
                in
                    if List.IsEmpty(issues) then null else Text.Combine(issues, "; "),
            type nullable text
        )
    in
        WithQA;

shared DocumentQA =
    let
        Issues = Table.SelectRows(DocumentPreparation, each [UnmappedIssues] <> null),
        OutputColumns = List.Combine(
            {
                List.Intersect(
                    {
                        {
                            "cr69a_documentid", "cr69a_recordid", "cr69a_id", "easi_documentid", "id",
                            "cr69a_systemintakeid", "cr69a_system_intake_id", "cr69a_systemintake", "cr69a_requestid", "cr69a_request", "system_intake_id",
                            "cr69a_filename", "cr69a_file_name", "file_name",
                            "cr69a_documenttype", "cr69a_uploaderrole",
                            "cr69a_s3key", "cr69a_s3_key", "s3_key"
                        },
                        Table.ColumnNames(Issues)
                    }
                ),
                {"UnmappedIssues"}
            }
        ),
        Output = Table.SelectColumns(Issues, OutputColumns, MissingField.Error)
    in
        Output;

shared cr69a_systemintakestagingdocument =
    let
        ValidatedPreparation =
            if Table.RowCount(DocumentQA) > 0 then
                error "One or more Document rows is invalid or could not be matched to exactly one Request. Review DocumentQA before loading Documents."
            else
                DocumentPreparation,
        HelperColumns = {
            "NormalizedDocumentRecordId",
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
