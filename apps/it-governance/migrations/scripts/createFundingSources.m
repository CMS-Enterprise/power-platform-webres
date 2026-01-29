let
    Prev = StagingRaw,
    // =========================================
    // Choice mapping specs
    // =========================================
    ChoiceSpecs = {
        [
            source = "cr69a_investment",
            dest = "investment_dataverse_format",
            map = [
                RECOVERY_AUDIT_CONTRACTORS = 971270000,
                ACA_3021 = 971270001,
                FED_ADMIN = 971270002,
                HITECH_MEDICAID = 971270003,
                HITECH_MEDICARE = 971270004,
                MIP_BASE = 971270005,
                PROG_OPS = 971270006,
                QIO = 971270007,
                DISC_PI_MEDICARE_MIP = 971270008,
                PART_D_COB_USER_FEES = 971270009,
                EXCHANGE = 971270010,
                USER_FEES = 971270011,
                RISK_ADJ = 971270012,
                DISC_PI_MEDICAID_MIP = 971270013,
                QIO_PROG_OPS = 971270014,
                RESEARCH = 971270015,
                SURVEY_AND_CERTIFICATION = 971270016,
                CLIA = 971270017,
                OTHER = 971270018,
                UNKNOWN = 971270019
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
                t6 = Text.Replace(t5, "/", "_")
            in
                t6,
    EnableQA = false,
    // set to true to see unmapped issues
    // =========================================
    // Apply all choice mappings
    // - Adds <source>_raw column (exact original)
    // - Adds <dest> column with Dataverse integer
    // =========================================
    ApplyAll = List.Accumulate(
        ChoiceSpecs,
        Prev,
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
    // =========================================
    // Optional QA: flag unmapped values
    // =========================================
    WithQA =
        if not EnableQA then
            ApplyAll
        else
            let
                AddIssues = Table.AddColumn(
                    ApplyAll,
                    "UnmappedIssues",
                    (r) =>
                        let
                            issues = List.Transform(
                                ChoiceSpecs,
                                (s) =>
                                    let
                                        src = s[source],
                                        map = s[map],
                                        raw = try Record.Field(r, src & "_raw") otherwise null,
                                        key = NormalizeChoiceKey(raw),
                                        bad = (key <> null) and (not Record.HasFields(map, key))
                                    in
                                        if bad then
                                            src & "=" & Text.From(raw)
                                        else
                                            null
                            ),
                            filtered = List.RemoveNulls(issues)
                        in
                            if List.IsEmpty(filtered) then
                                null
                            else
                                Text.Combine(filtered, "; "),
                    type text
                )
            in
                AddIssues
in
    WithQA
