section Section1;

shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared SharePointSiteUrl = "https://cmsgovonline.sharepoint.com/" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared FolderPath = "sites/CMS-SharePoint-OIT-Classic/CIOCorner/EASi%20data%20migration/Development/" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared FileName = "notes.csv" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];

// Convert literal NULLs, blanks, and whitespace-only values to null while
// preserving all other source text exactly.
shared NormalizeNoteText = (value as any) as nullable text =>
    let
        TextValue = if value = null then null else Text.From(value),
        Trimmed = if TextValue = null then null else Text.Trim(TextValue)
    in
        if Trimmed = null or Trimmed = "" or Text.Upper(Trimmed) = "NULL"
        then null
        else TextValue;

shared ParseNoteDateTime = (value as any) as nullable datetime =>
    let
        TextValue = NormalizeNoteText(value),
        Parsed = if TextValue = null then null else try DateTimeZone.FromText(TextValue),
        Result =
            if Parsed = null or Parsed[HasError]
            then null
            else DateTimeZone.RemoveZone(DateTimeZone.ToUtc(Parsed[Value]))
    in
        Result;

shared ParseNoteBoolean = (value as any) as nullable logical =>
    let
        TextValue = NormalizeNoteText(value),
        Normalized = if TextValue = null then null else Text.Lower(Text.Trim(TextValue))
    in
        if Normalized = "true" then true
        else if Normalized = "false" then false
        else null;

shared NotesSource = let
    CsvUrl = SharePointSiteUrl & FolderPath & FileName,
    Source = Csv.Document(
        Web.Contents(CsvUrl),
        [
            Delimiter = ",",
            Columns = 9,
            Encoding = 65001,
            QuoteStyle = QuoteStyle.Csv
        ]
    ),
    PromotedHeaders = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    WithSourceRow = Table.AddIndexColumn(PromotedHeaders, "SourceRowNumber", 2, 1, Int64.Type),
    RequiredColumns = {
        "id",
        "system_intake",
        "created_at",
        "eua_user_id",
        "author_name",
        "content",
        "modified_by",
        "modified_at",
        "is_archived",
        "SourceRowNumber"
    },
    SelectedColumns = Table.SelectColumns(WithSourceRow, RequiredColumns, MissingField.Error)
in
    SelectedColumns;

shared NotesPreparation = let
    TextColumns = {
        "id",
        "system_intake",
        "created_at",
        "eua_user_id",
        "author_name",
        "content",
        "modified_by",
        "modified_at",
        "is_archived"
    },
    NormalizedText = Table.TransformColumns(
        NotesSource,
        List.Transform(TextColumns, each {_, NormalizeNoteText, type nullable text})
    ),
    DuplicateCounts = Table.Group(
        Table.SelectRows(NormalizedText, each [id] <> null),
        {"id"},
        {
            {
                "LegacyNoteIdCount",
                (noteGroup as table) as number => Table.RowCount(noteGroup),
                Int64.Type
            }
        }
    ),
    WithDuplicateCounts = Table.NestedJoin(
        NormalizedText,
        {"id"},
        DuplicateCounts,
        {"id"},
        "DuplicateMatch",
        JoinKind.LeftOuter
    ),
    ExpandedDuplicateCounts = Table.ExpandTableColumn(
        WithDuplicateCounts,
        "DuplicateMatch",
        {"LegacyNoteIdCount"},
        {"LegacyNoteIdCount"}
    ),
    WithCreatedAtParsed = Table.AddColumn(
        ExpandedDuplicateCounts,
        "CreatedAtParsed",
        each ParseNoteDateTime([created_at]),
        type nullable datetime
    ),
    WithModifiedAtParsed = Table.AddColumn(
        WithCreatedAtParsed,
        "ModifiedAtParsed",
        each ParseNoteDateTime([modified_at]),
        type nullable datetime
    ),
    WithIsArchivedParsed = Table.AddColumn(
        WithModifiedAtParsed,
        "IsArchivedParsed",
        each ParseNoteBoolean([is_archived]),
        type nullable logical
    ),
    WithSuspiciousContent = Table.AddColumn(
        WithIsArchivedParsed,
        "HasSuspiciousContent",
        each
            let
                Combined = Text.Lower(Text.Combine(List.RemoveNulls({[author_name], [content]}), " "))
            in
                Text.Contains(Combined, "@webservice")
                    or Text.Contains(Combined, "javascript:")
                    or Text.Contains(Combined, "<script")
                    or Text.Contains(Combined, "<a ")
                    or Text.Contains(Combined, "\u00"),
        type logical
    ),
    WithUnmappedIssues = Table.AddColumn(
        WithSuspiciousContent,
        "UnmappedIssues",
        each
            let
                Issues = List.RemoveNulls({
                    if [id] = null then "blank legacy Note ID" else null,
                    if [LegacyNoteIdCount] <> null and [LegacyNoteIdCount] > 1 then "duplicate legacy Note ID" else null,
                    if [system_intake] = null then "blank legacy System Intake ID" else null,
                    if [created_at] = null then "blank created timestamp"
                    else if [CreatedAtParsed] = null then "invalid created timestamp"
                    else if Date.Year([CreatedAtParsed]) < 1753 then "created timestamp before 1753"
                    else null,
                    if [modified_at] <> null and [ModifiedAtParsed] = null then "invalid modified timestamp" else null,
                    if [is_archived] = null then "blank archived indicator"
                    else if [IsArchivedParsed] = null then "invalid archived indicator"
                    else null
                })
            in
                if List.IsEmpty(Issues) then null else Text.Combine(Issues, "; "),
        type nullable text
    ),
    WithQAWarnings = Table.AddColumn(
        WithUnmappedIssues,
        "QAWarnings",
        each
            let
                Warnings = List.RemoveNulls({
                    if [content] = null then "blank Note content" else null,
                    if [IsArchivedParsed] = true then "archived legacy Note" else null,
                    if [HasSuspiciousContent] then "potentially unsafe or encoded content" else null
                })
            in
                if List.IsEmpty(Warnings) then null else Text.Combine(Warnings, "; "),
        type nullable text
    ),

    // --- DATAVERSE LOOKUP FOR CURRENT BATCH ---
    Dv = CommonDataService.Database(DataverseEnvironmentUrl),
    MigrationRuns = Dv{[Name = "easi_migrationrun", Kind = "Table"]}[Data],
    RunningOnly = Table.SelectRows(MigrationRuns, each [easi_migrationrunstatus] = 100000000),
    Sorted = Table.Sort(RunningOnly, {{"easi_startedon", Order.Descending}}),
    Latest = Table.FirstN(Sorted, 1),
    BatchId =
        if Table.RowCount(Latest) > 0
        then Text.From(Latest{0}[easi_batchid])
        else error "No Running MigrationRun found - check MigrationRun table.",
    WithBatchId = Table.AddColumn(WithQAWarnings, "migrate_batch_id", each BatchId, type text)
in
    WithBatchId;

shared NotesQA = let
    Issues = Table.SelectRows(
        NotesPreparation,
        each [UnmappedIssues] <> null or [QAWarnings] <> null
    ),
    Output = Table.SelectColumns(
        Issues,
        {
            "SourceRowNumber",
            "id",
            "system_intake",
            "eua_user_id",
            "author_name",
            "content",
            "created_at",
            "modified_at",
            "is_archived",
            "UnmappedIssues",
            "QAWarnings"
        },
        MissingField.Error
    )
in
    Output;

shared #"notes 1" = let
    LoadableRows = Table.SelectRows(NotesPreparation, each [id] <> null),
    SelectedColumns = Table.SelectColumns(
        LoadableRows,
        {
            "id",
            "system_intake",
            "CreatedAtParsed",
            "eua_user_id",
            "author_name",
            "content",
            "modified_by",
            "ModifiedAtParsed",
            "IsArchivedParsed",
            "migrate_batch_id"
        },
        MissingField.Error
    ),
    DestinationNames = Table.RenameColumns(
        SelectedColumns,
        {
            {"CreatedAtParsed", "created_at"},
            {"ModifiedAtParsed", "modified_at"},
            {"IsArchivedParsed", "is_archived"}
        }
    )
in
    DestinationNames;
