let
    Prev = StagingRaw,
    // Map to Dataverse-style two-option codes:
    NormalizeTwoOption = (v as any) as nullable number =>
        let
            fromBool = if Value.Is(v, type logical) then (if v then 971270000 else 971270001) else null,
            s = if v = null then null else Text.Lower(Text.Trim(Text.From(v))),
            fromText =
                if s = null or s = "" then
                    null
                else if List.Contains({"t", "true", "1", "yes", "y"}, s) then
                    971270000
                else if List.Contains({"f", "false", "0", "no", "n"}, s) then
                    971270001
                else
                    null,
            result = if fromBool <> null then fromBool else fromText
        in
            result,
    TwoOptionCols = {
        "cr69a_existing_funding",
        "cr69a_ea_support_request",
        "cr69a_has_ui_changes",
        "cr69a_uses_ai_tech",
        "cr69a_governance_teams_is_present"
    },
    ColsPresent = List.Intersect({TwoOptionCols, Table.ColumnNames(Prev)}),
    Transformers = List.Transform(ColsPresent, each {_, each NormalizeTwoOption(_), Int64.Type}),
    FixedBools = Table.TransformColumns(Prev, Transformers),
    WithAdminTask = Table.AddColumn(FixedBools, "cr69a_admingovernancetasklist", each 971270009, Int64.Type),
    // Normalize Yes/No to logical true/false (nullable)
    NormalizeYesNo = (v as any) as nullable logical =>
        if Value.Is(v, type logical) then
            v
        else
            let
                s = if v = null then null else Text.Lower(Text.Trim(Text.From(v)))
            in
                if s = null or s = "" then
                    null
                else if List.Contains({"t", "true", "1", "yes", "y"}, s) then
                    true
                else if List.Contains({"f", "false", "0", "no", "n"}, s) then
                    false
                else
                    null,
    // 🔁 List your Dynamics Yes/No columns here
    YesNoCols = {"cr69a_does_not_support_systems"},
    // Apply only to columns that actually exist
    ColsPresentYN = List.Intersect({YesNoCols, Table.ColumnNames(WithAdminTask)}),
    YNTransformers = List.Transform(ColsPresentYN, each {_, each NormalizeYesNo(_), type logical}),
    FixedYesNo = Table.TransformColumns(WithAdminTask, YNTransformers),
    EnableQA = false,
    // set to false to suppress QA columns
    // 1) Specs
    ChoiceSpecs = {
        [
            source = "cr69a_request_type",
            dest = "request_type_dataverse_format",
            map = [
                NEW = 971270000,
                MAJOR_CHANGES = 971270001,
                MAJOR_CHAGES = 971270001,
                RECOMPETE = 971270002,
                SHUTDOWN = 100000001,
                OTHER = 100000002
            ]
        ],
        [
            source = "cr69a_request_form_state",
            dest = "request_form_state_dataverse_format",
            map = [
                NOT_STARTED = 100000000,
                IN_PROGRESS = 100000001,
                EDITS_REQUESTED = 100000002,
                SUBMITTED = 100000003
            ]
        ],
        [
            source = "cr69a_draft_business_case_state",
            dest = "draft_business_case_state_dataverse_format",
            map = [
                NOT_STARTED = 100000000,
                IN_PROGRESS = 100000001,
                EDITS_REQUESTED = 100000002,
                SUBMITTED = 100000003
            ]
        ],
        [
            source = "cr69a_final_business_case_state",
            dest = "final_business_case_state_dataverse_format",
            map = [
                NOT_STARTED = 100000000,
                IN_PROGRESS = 100000001,
                EDITS_REQUESTED = 100000002,
                SUBMITTED = 100000003
            ]
        ],
        [
            source = "cr69a_decision_state",
            dest = "decision_state_dataverse_format",
            map = [
                NO_DECISION = 971270003,
                LCID_ISSUED = 971270000,
                NOT_APPROVED = 971270002,
                NOT_GOVERNANCE = 971270001
            ]
        ],
        [
            source = "cr69a_step",
            dest = "step_dataverse_format",
            map = [
                INITIAL_REQUEST_FORM = 971270000,
                DRAFT_BUSINESS_CASE = 971270001,
                GRT_MEETING = 971270002,
                GRB_MEETING = 971270004,
                FINAL_BUSINESS_CASE = 971270003,
                DECISION_AND_NEXT_STEPS = 971270005
            ]
        ],
        [
            source = "cr69a_state",
            dest = "state_dataverse_format",
            map = [
                OPEN = 100000001,
                CLOSED = 100000000
            ]
        ],
        [
            source = "cr69a_trb_follow_up_recommendation",
            dest = "trb_follow_up_recommendation_dataverse_format",
            map = [
                STRONGLY_RECOMMENDED = 971270000,
                RECOMMENDED_BUT_NOT_CRITICAL = 971270001,
                NOT_RECOMMENDED = 971270002
            ]
        ],
        [
            source = "cr69a_system_relation_type",
            dest = "system_relation_type_dataverse_format",
            map = [
                NEW_SYSTEM = 100000000,
                EXISTING_SYSTEM = 100000001,
                EXISTING_SERVICE = 100000002
            ]
        ],
        [
            source = "cr69a_grb_review_type",
            dest = "grb_review_type_dataverse_format",
            map = [
                STANDARD = 971270000,
                ASYNC = 971270001
            ]
        ],
        [
            source = "cr69a_acquisition_methods",
            //Maps to cr69a_howwillthesoftwarebeacquired
            dest = "acquisition_methods_dataverse_format",
            map = [
                CONTRACTOR_FURNISHED = 971270000,
                ELA_OR_INTERNAL = 971270001,
                FED_FURNISHED = 971270002,
                NOT_YET_DETERMINED = 971270003,
                OTHER = 971270004
            ]
        ]
    },
    // 2) Helper: normalize enum text
    Normalize = (v as any) as nullable text => if v = null then null else Text.Upper(Text.Trim(Text.From(v))),
    // 3) Apply all mappings
    ApplyAll = List.Accumulate(
        ChoiceSpecs,
        FixedYesNo,
        (state as table, spec as record) =>
            let
                src = spec[source],
                dest = spec[dest],
                map = spec[map],
                // clean the source column
                Cleaned = Table.TransformColumns(state, {{src, each if _ = null then null else Normalize(_), type text}}),
                // add the dataverse choice column (null-safe)
                WithChoice = Table.AddColumn(
                    Cleaned,
                    dest,
                    each
                        let
                            v = Record.Field(_, src)
                        in
                            if v = null then
                                null
                            else if Record.HasFields(map, v) then
                                Record.Field(map, v)
                            else
                                null,
                    Int64.Type
                )
            in
                WithChoice
    ),
    // 4) Optional consolidated QA
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
                                        val = Record.FieldOrDefault(r, src, null),
                                        bad = (val <> null) and (not Record.HasFields(map, val))
                                    in
                                        if bad then
                                            src & "=" & val
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
