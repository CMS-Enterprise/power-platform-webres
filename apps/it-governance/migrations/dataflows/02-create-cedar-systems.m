section Section1;

shared new_stagecedarsystem =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl, [CreateNavigationProperties = null]),
        Stage = Source{[Schema = "dbo", Item = "new_stagecedarsystem"]}[Data],
        MigrationRuns = Source{[Schema = "dbo", Item = "easi_migrationrun"]}[Data],
        BufferedRuns = Table.Buffer(MigrationRuns),
        RunningOnly = Table.SelectRows(BufferedRuns, each [easi_migrationrunstatus] = 100000000),
        Sorted = Table.Sort(RunningOnly, {{"easi_startedon", Order.Descending}}),
        Latest = Table.FirstN(Sorted, 1),
        BatchId = if Table.RowCount(Latest) > 0 then Text.From(Latest{0}[easi_batchid]) else "DATAFLOW_NO_RUNNING_BATCH",
        EnableQA = true,
        HasPopulatedValue = (v as any) as logical =>
            let
                textValue = if v = null then null else Text.Trim(Text.From(v))
            in
                textValue <> null and textValue <> "" and Text.Upper(textValue) <> "NULL",
        Normalize = (v as any) as nullable text =>
            if not HasPopulatedValue(v) then
                null
            else
                Text.Upper(Text.Trim(Text.From(v))),
        NormalizeDate = (v as any) as nullable date =>
            let
                parsed = if HasPopulatedValue(v) then try Date.From(v) otherwise null else null
            in
                if parsed <> null and parsed >= #date(1753, 1, 1) then
                    parsed
                else
                    null,
        NormalizeVersion = (v as any) as nullable number =>
            if HasPopulatedValue(v) then
                try Int64.From(v) otherwise null
            else
                null,
        CedarStateMap = [
            ACTIVE = 216640000,
            INACTIVE = 216640001,
            DEACTIVATED = 216640001
        ],
        #"Selected Columns" = Table.SelectColumns(
            #"Stage",
            {
                "new_acronym",
                "new_atoeffectivedate",
                "new_atoexpirationdate",
                "new_batchid",
                "cr3ee_belongsto",
                "new_businessownerorg",
                "new_businessownerorgcomp",
                "new_cedarid",
                "new_cedaruuid",
                "new_description",
                "new_ictobjectid",
                "new_name",
                "new_oastatus",
                "new_state",
                "new_systemmaintainerorg",
                "new_systemmaintainerorgcomp",
                "new_version"
            },
            MissingField.Ignore
        ),
        #"Added ATO Effective Date" = Table.AddColumn(
            #"Selected Columns", "cr3ee_atoeffectivedate", each NormalizeDate([new_atoeffectivedate]), type date
        ),
        #"Added ATO Expiration Date" = Table.AddColumn(
            #"Added ATO Effective Date",
            "cr3ee_atoexpirationdate",
            each NormalizeDate([new_atoexpirationdate]),
            type date
        ),
        #"Added Version" = Table.AddColumn(
            #"Added ATO Expiration Date", "cr3ee_version", each NormalizeVersion([new_version]), Int64.Type
        ),
        #"Added Cedar State" = Table.AddColumn(
            #"Added Version",
            "cr3ee_cedarstate",
            each
                let
                    state = Normalize([new_state])
                in
                    if state <> null and Record.HasFields(CedarStateMap, state) then
                        Record.Field(CedarStateMap, state)
                    else
                        null,
            Int64.Type
        ),
        #"Added QA Issues" =
            if not EnableQA then
                #"Added Cedar State"
            else
                Table.AddColumn(
                    #"Added Cedar State",
                    "UnmappedIssues",
                    (r as record) =>
                        let
                            effectiveRaw = Record.FieldOrDefault(r, "new_atoeffectivedate", null),
                            expirationRaw = Record.FieldOrDefault(r, "new_atoexpirationdate", null),
                            versionRaw = Record.FieldOrDefault(r, "new_version", null),
                            stateRaw = Record.FieldOrDefault(r, "new_state", null),
                            stateKey = Normalize(stateRaw),
                            issues = List.RemoveNulls(
                                {
                                    if HasPopulatedValue(effectiveRaw) and NormalizeDate(effectiveRaw) = null then
                                        "new_atoeffectivedate=" & Text.From(effectiveRaw)
                                    else
                                        null,
                                    if HasPopulatedValue(expirationRaw) and NormalizeDate(expirationRaw) = null then
                                        "new_atoexpirationdate=" & Text.From(expirationRaw)
                                    else
                                        null,
                                    if HasPopulatedValue(versionRaw) and NormalizeVersion(versionRaw) = null then
                                        "new_version=" & Text.From(versionRaw)
                                    else
                                        null,
                                    if stateKey <> null and not Record.HasFields(CedarStateMap, stateKey) then
                                        "new_state=" & Text.From(stateRaw)
                                    else
                                        null
                                }
                            )
                        in
                            if List.IsEmpty(issues) then
                                null
                            else
                                Text.Combine(issues, "; "),
                    type nullable text
                ),
        #"Remove Complex Columns" = Table.RemoveColumns(
            #"Added QA Issues",
            Table.ColumnsOfType(
                #"Added QA Issues",
                {type table, type record, type list, type nullable binary, type binary, type function}
            )
        )
    in
        #"Remove Complex Columns";
shared DataverseEnvironmentUrl =
    let
        DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
            IsParameterQuery = true,
            IsParameterQueryRequired = false,
            Type = type text
        ]
    in
        DataverseEnvironmentUrl;
