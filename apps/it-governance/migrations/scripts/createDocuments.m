let
    Source = CommonDataService.Database("icpg-dev.crm9.dynamics.com"),
    #"Navigation 1" = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingdocument"]}[Data],
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
