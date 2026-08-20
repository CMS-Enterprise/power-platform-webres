section Section1;

shared RequestMultiSelectPreparation =
    let
        Source = CommonDataService.Database(DataverseEnvironmentUrl),
        StagingRaw = Source{[Schema = "dbo", Item = "cr69a_intakestaging"]}[Data],
        EnableQA = true,
        AcquisitionMethodMap = [
            CONTRACTOR_FURNISHED = 971270000,
            ELA_OR_INTERNAL = 971270001,
            FED_FURNISHED = 971270002,
            NOT_YET_DETERMINED = 971270003,
            OTHER = 971270004
        ],
        HasPopulatedValue = (value as any) as logical =>
            let
                textValue = if value = null then null else Text.Trim(Text.From(value))
            in
                textValue <> null and textValue <> "" and Text.Upper(textValue) <> "NULL",
        NormalizeKey = (value as any) as nullable text =>
            if not HasPopulatedValue(value) then
                null
            else
                Text.Upper(Text.Trim(Text.From(value))),
        ParseMultiSelectKeys = (value as any) as list =>
            if not HasPopulatedValue(value) then
                {}
            else
                let
                    textValue = Text.Trim(Text.From(value)),
                    withoutBraces = Text.Replace(Text.Replace(textValue, "{", ""), "}", ""),
                    keys = List.Transform(Text.Split(withoutBraces, ","), each NormalizeKey(_))
                in
                    List.Select(keys, each _ <> null and _ <> ""),
        FormatMultiSelect = (value as any, choiceMap as record) as nullable text =>
            let
                keys = ParseMultiSelectKeys(value),
                mappedValues = List.Transform(
                    keys, each if Record.HasFields(choiceMap, _) then Record.Field(choiceMap, _) else null
                ),
                validValues = List.RemoveNulls(mappedValues)
            in
                if List.IsEmpty(validValues) then
                    null
                else
                    Text.Combine(List.Transform(validValues, each Text.From(_)), ","),
        Staging = Table.SelectColumns(StagingRaw, {"cr69a_id", "cr69a_acquisition_methods"}, MissingField.Error),
        WithNormalizedRequestId = Table.TransformColumns(
            Staging,
            {
                {
                    "cr69a_id",
                    each if HasPopulatedValue(_) then Text.Lower(Text.Trim(Text.From(_))) else null,
                    type nullable text
                }
            }
        ),
        WithRequestId = Table.AddColumn(
            WithNormalizedRequestId, "new_systemintakeid", each [cr69a_id], type nullable text
        ),
        WithAcquisitionMethods = Table.AddColumn(
            WithRequestId,
            "acquisition_methods_dataverse_format",
            each FormatMultiSelect([cr69a_acquisition_methods], AcquisitionMethodMap),
            type nullable text
        ),
        WithQA =
            if not EnableQA then
                WithAcquisitionMethods
            else
                Table.AddColumn(
                    WithAcquisitionMethods,
                    "UnmappedIssues",
                    (row as record) =>
                        let
                            legacyId = Record.FieldOrDefault(row, "cr69a_id", null),
                            rawMethods = Record.FieldOrDefault(row, "cr69a_acquisition_methods", null),
                            keys = ParseMultiSelectKeys(rawMethods),
                            unknownKeys = List.Select(keys, each not Record.HasFields(AcquisitionMethodMap, _)),
                            issues = List.RemoveNulls(
                                {
                                    if not HasPopulatedValue(legacyId) then
                                        "cr69a_id is blank"
                                    else
                                        null,
                                    if List.IsEmpty(unknownKeys) then
                                        null
                                    else
                                        "cr69a_acquisition_methods=" & Text.Combine(unknownKeys, ",")
                                }
                            )
                        in
                            if List.IsEmpty(issues) then
                                null
                            else
                                Text.Combine(issues, "; "),
                    type nullable text
                ),
        RowsWithAcquisitionMethods = Table.SelectRows(WithQA, each HasPopulatedValue([cr69a_acquisition_methods])),
        Output = Table.SelectColumns(
            RowsWithAcquisitionMethods,
            {"new_systemintakeid", "cr69a_id", "acquisition_methods_dataverse_format", "UnmappedIssues"},
            MissingField.UseNull
        )
    in
        Output;

shared RequestMultiSelects =
    let
        ValidRows = Table.SelectRows(
            RequestMultiSelectPreparation, each [new_systemintakeid] <> null and [UnmappedIssues] = null
        ),
        Output = Table.SelectColumns(
            ValidRows, {"new_systemintakeid", "cr69a_id", "acquisition_methods_dataverse_format"}, MissingField.Error
        )
    in
        Output;

shared RequestMultiSelectQA =
    let
        Issues = Table.SelectRows(RequestMultiSelectPreparation, each [UnmappedIssues] <> null),
        Output = Table.SelectColumns(Issues, {"cr69a_id", "UnmappedIssues"}, MissingField.Error)
    in
        Output;

shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [
    IsParameterQuery = true,
    IsParameterQueryRequired = false,
    Type = type text
];
