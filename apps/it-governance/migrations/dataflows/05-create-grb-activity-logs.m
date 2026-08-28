section Section1;

// Historical GRB recommendations are stored in the same staging table as requester
// Edit Requests. This dataflow handles only GRB rows and creates inert historical
// Activity Logs. The Activity Log create plugins must bypass records with a populated
// cr3ee_batchid before this query is loaded.

shared StagingRaw =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        Navigation = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingeditrequests"]}[Data],
        Flat = Table.RemoveColumns(
            Navigation,
            Table.ColumnsOfType(
                Navigation,
                {type table, type record, type list, type nullable binary, type binary, type function}
            )
        )
    in
        Flat;

shared HistoricalGrbActivityLogPreparation =
    let
        NormalizeText = (value as any) as nullable text =>
            let
                textValue = if value = null then null else Text.Trim(Text.From(value))
            in
                if textValue = null or textValue = "" or Text.Upper(textValue) = "NULL" then null else textValue,
        NormalizeId = (value as any) as nullable text =>
            let
                textValue = NormalizeText(value)
            in
                if textValue = null then null else Text.Lower(textValue),
        ResolveColumn = (columns as list, candidates as list, label as text) as text =>
            let
                found = List.First(List.Select(candidates, each List.Contains(columns, _)), null)
            in
                if found = null then error "Missing " & label & ". Expected one of: " & Text.Combine(candidates, ", ") else found,
        TargetStepMap = [
            DRAFT_BUSINESS_CASE = 971270001,
            GRT_MEETING = 971270002,
            FINAL_BUSINESS_CASE = 971270003,
            GRB_MEETING = 971270004
        ],
        TargetFormMap = [
            INTAKE_REQUEST = 971270000,
            DRAFT_BUSINESS_CASE = 971270001,
            FINAL_BUSINESS_CASE = 971270002,
            NO_TARGET_PROVIDED = 971270003
        ],
        StagingColumns = Table.ColumnNames(StagingRaw),
        IdColumn = ResolveColumn(
            StagingColumns,
            {"cr69a_feedbackid", "cr69a_recordid", "cr69a_id", "id"},
            "staging feedback ID column"
        ),
        IntakeColumn = ResolveColumn(
            StagingColumns,
            {"cr69a_intakeid", "cr69a_intake_id", "cr69a_systemintakeid", "intake_id"},
            "staging intake ID column"
        ),
        FeedbackColumn = ResolveColumn(
            StagingColumns,
            {"cr69a_feedbackcontent", "cr69a_feedback", "feedback"},
            "staging feedback column"
        ),
        SourceActionColumn = ResolveColumn(
            StagingColumns, {"cr69a_sourceaction", "source_action"}, "staging source-action column"
        ),
        FeedbackTypeColumn = ResolveColumn(
            StagingColumns, {"cr69a_feedbacktype", "cr69a_type", "type"}, "staging feedback-type column"
        ),
        TargetFormColumn = ResolveColumn(
            StagingColumns, {"cr69a_targetform", "target_form"}, "staging target-form column"
        ),
        CreatedByColumn = ResolveColumn(
            StagingColumns, {"cr69a_createdby", "created_by"}, "staging created-by column"
        ),
        BatchColumn = ResolveColumn(StagingColumns, {"migrate_batch_id", "cr69a_batchid"}, "staging batch-ID column"),
        CreatedAtColumn = ResolveColumn(
            StagingColumns, {"cr69a_createdat", "created_at"}, "staging created-at column"
        ),
        WithNormalizedFields = Table.AddColumn(
            Table.AddColumn(
                Table.AddColumn(
                    Table.AddColumn(
                        Table.AddColumn(
                            StagingRaw,
                            "legacy_feedback_id",
                            each NormalizeId(Record.FieldOrDefault(_, IdColumn, null)),
                            type nullable text
                        ),
                        "legacy_intake_id",
                        each NormalizeId(Record.FieldOrDefault(_, IntakeColumn, null)),
                        type nullable text
                    ),
                    "feedback_text",
                    each NormalizeText(Record.FieldOrDefault(_, FeedbackColumn, null)),
                    type nullable text
                ),
                "source_action_key",
                each
                    let value = NormalizeText(Record.FieldOrDefault(_, SourceActionColumn, null))
                    in if value = null then null else Text.Upper(value),
                type nullable text
            ),
            "feedback_type_key",
            each
                let value = NormalizeText(Record.FieldOrDefault(_, FeedbackTypeColumn, null))
                in if value = null then null else Text.Upper(value),
            type nullable text
        ),
        WithHistoricalFields = Table.AddColumn(
            Table.AddColumn(
                WithNormalizedFields,
                "target_form_key",
                each
                    let value = NormalizeText(Record.FieldOrDefault(_, TargetFormColumn, null))
                    in if value = null then null else Text.Upper(value),
                type nullable text
            ),
            "legacy_created_by",
            each NormalizeText(Record.FieldOrDefault(_, CreatedByColumn, null)),
            type nullable text
        ),
        GrbRows = Table.SelectRows(WithHistoricalFields, each [feedback_type_key] = "GRB"),
        WithBatchId =
            if BatchColumn = "cr69a_batchid" then
                Table.TransformColumns(
                    GrbRows,
                    {{"cr69a_batchid", each NormalizeText(_), type nullable text}}
                )
            else
                Table.AddColumn(
                    GrbRows,
                    "cr69a_batchid",
                    each NormalizeText(Record.FieldOrDefault(_, BatchColumn, null)),
                    type nullable text
                ),
        WithoutStagingOverriddenCreatedOn =
            if List.Contains(Table.ColumnNames(WithBatchId), "overriddencreatedon") then
                Table.RemoveColumns(WithBatchId, {"overriddencreatedon"})
            else
                WithBatchId,
        WithCreatedOn = Table.AddColumn(
            WithoutStagingOverriddenCreatedOn,
            "overriddencreatedon",
            each try DateTime.From(Record.FieldOrDefault(_, CreatedAtColumn, null)) otherwise null,
            type nullable datetime
        ),
        WithTargetToken = Table.AddColumn(
            WithCreatedOn,
            "target_step_source_token",
            each
                let
                    feedback = [feedback_text],
                    upperFeedback = if feedback = null then null else Text.Upper(feedback),
                    delimiter = " PROGRESSING TO ",
                    token =
                        if upperFeedback = null or not Text.Contains(upperFeedback, delimiter) then
                            null
                        else
                            Text.Trim(Text.AfterDelimiter(upperFeedback, delimiter))
                in
                    token,
            type nullable text
        ),
        WithTargetStep = Table.AddColumn(
            WithTargetToken,
            "new_process_target_step",
            each
                let token = [target_step_source_token]
                in if token <> null and Record.HasFields(TargetStepMap, token) then Record.Field(TargetStepMap, token) else null,
            Int64.Type
        ),
        WithActivityFields = Table.AddColumn(
            Table.AddColumn(
                Table.AddColumn(
                    WithTargetStep,
                    "new_activitylogsid",
                    each [legacy_feedback_id],
                    type nullable text
                ),
                "cr3ee_activitytype",
                each 216640000,
                Int64.Type
            ),
            "new_activity",
            each
                if [target_step_source_token] = null then
                    "Historical GRB recommendation migrated from EASi"
                else
                    "Historical GRB recommendation: progress to " & [target_step_source_token],
            type text
        ),
        WithRecommendation = Table.AddColumn(
            WithActivityFields, "new_recommendationsforthegrb", each [feedback_text], type nullable text
        ),
        WithFormNeedsEdits = Table.AddColumn(
            WithRecommendation,
            "new_whichformneedsedits",
            each
                let key = [target_form_key]
                in if key <> null and Record.HasFields(TargetFormMap, key) then Record.Field(TargetFormMap, key) else null,
            Int64.Type
        ),
        WithAdditionalInformation = Table.AddColumn(
            WithFormNeedsEdits,
            "new_additionalinformation",
            each if [legacy_created_by] = null then null else "Legacy created by: " & [legacy_created_by],
            type nullable text
        ),
        WithDestinationBatchId = Table.AddColumn(
            WithAdditionalInformation, "cr3ee_batchid", each [cr69a_batchid], type nullable text
        ),
        Dataverse = CommonDataService.Database(DataverseEnvironmentUrl),
        RequestsRaw = Dataverse{[Schema = "dbo", Item = "new_systemintake"]}[Data],
        ReviewsRaw = Dataverse{[Schema = "dbo", Item = "cr69a_systemintakeadmin"]}[Data],
        RequestExternalIds = Table.Distinct(
            Table.TransformColumns(
                Table.SelectColumns(RequestsRaw, {"easi_external_id"}, MissingField.Error),
                {{"easi_external_id", each NormalizeId(_), type nullable text}}
            )
        ),
        ReviewExternalIds = Table.Distinct(
            Table.TransformColumns(
                Table.SelectColumns(ReviewsRaw, {"cr3ee_external_id"}, MissingField.Error),
                {{"cr3ee_external_id", each NormalizeId(_), type nullable text}}
            )
        ),
        WithRequestMatch = Table.NestedJoin(
            WithDestinationBatchId,
            {"legacy_intake_id"},
            RequestExternalIds,
            {"easi_external_id"},
            "RequestMatch",
            JoinKind.LeftOuter
        ),
        ExpandedRequest = Table.ExpandTableColumn(
            WithRequestMatch, "RequestMatch", {"easi_external_id"}, {"easi_external_id"}
        ),
        WithReviewMatch = Table.NestedJoin(
            ExpandedRequest,
            {"legacy_intake_id"},
            ReviewExternalIds,
            {"cr3ee_external_id"},
            "ReviewMatch",
            JoinKind.LeftOuter
        ),
        ExpandedReview = Table.ExpandTableColumn(
            WithReviewMatch, "ReviewMatch", {"cr3ee_external_id"}, {"cr3ee_external_id"}
        ),
        IdCounts = Table.Group(
            ExpandedReview,
            {"legacy_feedback_id"},
            {{"legacy_feedback_id_count", each Table.RowCount(_), Int64.Type}}
        ),
        WithIdCounts = Table.NestedJoin(
            ExpandedReview,
            {"legacy_feedback_id"},
            IdCounts,
            {"legacy_feedback_id"},
            "IdCount",
            JoinKind.LeftOuter
        ),
        ExpandedIdCounts = Table.ExpandTableColumn(
            WithIdCounts, "IdCount", {"legacy_feedback_id_count"}, {"legacy_feedback_id_count"}
        ),
        WithIssues = Table.AddColumn(
            ExpandedIdCounts,
            "UnmappedIssues",
            each
                Text.Combine(
                    List.RemoveNulls({
                        if [legacy_feedback_id] = null then "blank feedback ID" else null,
                        if [legacy_feedback_id_count] <> 1 then "duplicate feedback ID=" & Text.From([legacy_feedback_id]) else null,
                        if [legacy_intake_id] = null then "blank intake ID" else null,
                        if [feedback_text] = null then "blank GRB recommendation" else null,
                        if [source_action_key] <> "PROGRESS_TO_NEW_STEP" then
                            "source_action=" & (if [source_action_key] = null then "<blank>" else [source_action_key])
                        else
                            null,
                        if [target_form_key] = null or not Record.HasFields(TargetFormMap, [target_form_key]) then
                            "target_form=" & (if [target_form_key] = null then "<blank>" else [target_form_key])
                        else
                            null,
                        if [target_step_source_token] = null then
                            "missing progress target in feedback"
                        else if [new_process_target_step] = null then
                            "target_step=" & [target_step_source_token]
                        else
                            null,
                        if [cr3ee_batchid] = null then "blank migration batch ID" else null,
                        if [overriddencreatedon] = null then "invalid created-at timestamp" else null,
                        if [easi_external_id] = null then "unmatched Request external ID=" & Text.From([legacy_intake_id]) else null,
                        if [cr3ee_external_id] = null then "unmatched Review external ID=" & Text.From([legacy_intake_id]) else null
                    }),
                    "; "
                ),
            type text
        )
    in
        WithIssues;

shared HistoricalGrbActivityLogQA =
    let
        Issues = Table.SelectRows(HistoricalGrbActivityLogPreparation, each [UnmappedIssues] <> ""),
        Output = Table.SelectColumns(
            Issues,
            {
                "legacy_feedback_id",
                "legacy_intake_id",
                "source_action_key",
                "target_form_key",
                "target_step_source_token",
                "feedback_text",
                "legacy_created_by",
                "UnmappedIssues"
            },
            MissingField.Error
        )
    in
        Output;

shared HistoricalGrbActivityLogs =
    let
        QaCount = Table.RowCount(HistoricalGrbActivityLogQA),
        FeedbackTypeQaCount = Table.RowCount(FeedbackTypeQA),
        ValidRows =
            if FeedbackTypeQaCount > 0 then
                error "Historical GRB Activity Log migration blocked: FeedbackTypeQA contains "
                    & Text.From(FeedbackTypeQaCount)
                    & " unexpected feedback type row(s)."
            else if QaCount > 0 then
                error "Historical GRB Activity Log migration blocked: HistoricalGrbActivityLogQA contains "
                    & Text.From(QaCount)
                    & " row(s)."
            else
                Table.SelectRows(HistoricalGrbActivityLogPreparation, each [UnmappedIssues] = ""),
        Output = Table.SelectColumns(
            ValidRows,
            {
                "new_activitylogsid",
                "easi_external_id",
                "cr3ee_external_id",
                "cr3ee_activitytype",
                "new_process_target_step",
                "new_activity",
                "new_recommendationsforthegrb",
                "new_whichformneedsedits",
                "new_additionalinformation",
                "cr3ee_batchid",
                "overriddencreatedon"
            },
            MissingField.Error
        )
    in
        Output;

shared FeedbackTypeQA =
    let
        Columns = Table.ColumnNames(StagingRaw),
        FeedbackTypeColumn =
            List.First(List.Select({"cr69a_feedbacktype", "cr69a_type", "type"}, each List.Contains(Columns, _)), null),
        Checked =
            if FeedbackTypeColumn = null then
                error "Missing staging feedback-type column."
            else
                Table.AddColumn(
                    StagingRaw,
                    "feedback_type_qa",
                    each
                        let
                            raw = Record.FieldOrDefault(_, FeedbackTypeColumn, null),
                            normalized = if raw = null then null else Text.Upper(Text.Trim(Text.From(raw)))
                        in
                            normalized,
                    type nullable text
                ),
        Unexpected = Table.SelectRows(
            Checked, each [feedback_type_qa] = null or not List.Contains({"REQUESTER", "GRB"}, [feedback_type_qa])
        )
    in
        Unexpected;

shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
    IsParameterQuery = true,
    IsParameterQueryRequired = false,
    Type = type text
];
