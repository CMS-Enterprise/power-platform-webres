let
    Source = CommonDataService.Database("icpg-dev.crm9.dynamics.com"),
    #"Navigation 1" = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingbusinesscase"]}[Data],
    ChoiceSpecs = {
        [
            source = "cr69a_status",
            dest = "status_dataverse_format",
            map = [
                DRAFT = 971270000,
                SUBMITTED = 971270001,
                REVIEWED = 971270002,
                REJECTED = 971270003,
                ARCHIVED = 971270004,
                OPEN = 971270005,
                CLOSED = 971270006
            ]
        ]
    },
    // Helper: normalize source text -> enum key
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
    // Apply all choice mappings starting from the actual table
    ApplyAll = List.Accumulate(
        ChoiceSpecs,
        #"Navigation 1",
        // 🔹 start from your staging table, not Source
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
    // Return the transformed table
    Custom = ApplyAll
in
    Custom
