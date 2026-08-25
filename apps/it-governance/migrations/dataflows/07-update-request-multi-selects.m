section Section1;
shared RequestMultiSelectPreparation = let
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
            WithNormalizedRequestId,
            "new_systemintakeid",
            each [cr69a_id],
            type nullable text
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
            {
                "new_systemintakeid",
                "cr69a_id",
                "acquisition_methods_dataverse_format",
                "UnmappedIssues"
            },
            MissingField.UseNull
        )
    in
        Output;
shared DataverseEnvironmentUrl = "itgovernancedev.crm9.dynamics.com" meta [IsParameterQuery = true, IsParameterQueryRequired = false, Type = type text];
shared RequestMultiSelects = let
    ValidRows = Table.SelectRows(RequestMultiSelectPreparation, each [new_systemintakeid] <> null and [UnmappedIssues] = null),
    Output = Table.SelectColumns(
        ValidRows, {"new_systemintakeid", "cr69a_id", "acquisition_methods_dataverse_format"}, MissingField.Error
    )
in
    Output;
shared RequestMultiSelectQA = let
    Issues = Table.SelectRows(RequestMultiSelectPreparation, each [UnmappedIssues] <> null),
    Output = Table.SelectColumns(Issues, {"cr69a_id", "UnmappedIssues"}, MissingField.Error)
in
    Output;
shared ContactRolePreparation = let
    Source = CommonDataService.Database(DataverseEnvironmentUrl),
    StagingRaw = Source{[Schema = "dbo", Item = "cr69a_systemintakestagingcontact"]}[Data],
    ExistingContactsRaw = Source{[Schema = "dbo", Item = "cr69a_additionalcontact"]}[Data],
    ContactRoleMap = [
        BUSINESS_OWNER = 100000000,
        PRODUCT_OWNER = 100000001,
        SYSTEM_OWNER = 100000002,
        SYSTEM_MAINTAINER = 100000003,
        CONTRACTING_OFFICERS_REPRESENTATIVE = 100000004,
        CLOUD_NAVIGATOR = 100000005,
        INFORMATION_SYSTEM_SECURITY_ADVISOR = 100000006,
        PRIVACY_ADVISOR = 100000007,
        CYBER_RISK_ADVISOR = 100000008,
        OTHER = 100000009,
        PROJECT_MANAGER = 971270001,
        PRODUCT_MANAGER = 971270002,
        SUBJECT_MATTER_EXPERT = 971270003,
        PLACE_HOLDER = 971270004,
        NONE_SPECIFIED = 216640001
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
    NormalizeId = (value as any) as nullable text =>
        if not HasPopulatedValue(value) then
            null
        else
            Text.Lower(Text.Trim(Text.From(value))),
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
    FormatMultiSelect = (keys as list, choiceMap as record) as nullable text =>
        let
            mappedValues = List.Transform(
                keys, each if Record.HasFields(choiceMap, _) then Record.Field(choiceMap, _) else null
            ),
            validValues = List.RemoveNulls(mappedValues)
        in
            if List.IsEmpty(validValues) then
                null
            else
                Text.Combine(List.Transform(validValues, each Text.From(_)), ","),
    StagingColumns = Table.SelectColumns(
        StagingRaw,
        {"cr69a_recordid", "cr69a_roles"},
        MissingField.Error
    ),
    Staging = Table.RenameColumns(
        StagingColumns,
        {{"cr69a_recordid", "cr69a_id"}},
        MissingField.Error
    ),
    WithNormalizedContactId = Table.TransformColumns(
        Staging,
        {{"cr69a_id", each NormalizeId(_), type nullable text}}
    ),
    WithRoleKeys = Table.AddColumn(
        WithNormalizedContactId,
        "RoleKeys",
        each ParseMultiSelectKeys([cr69a_roles]),
        type list
    ),
    WithFormattedRoles = Table.AddColumn(
        WithRoleKeys,
        "roles_dataverse_format",
        each FormatMultiSelect([RoleKeys], ContactRoleMap),
        type nullable text
    ),
    ExistingContacts = Table.TransformColumns(
        Table.SelectColumns(ExistingContactsRaw, {"cr69a_additionalcontactid"}, MissingField.Error),
        {{"cr69a_additionalcontactid", each NormalizeId(_), type nullable text}}
    ),
    WithDestinationMatch = Table.NestedJoin(
        WithFormattedRoles,
        {"cr69a_id"},
        ExistingContacts,
        {"cr69a_additionalcontactid"},
        "DestinationMatch",
        JoinKind.LeftOuter
    ),
    WithQA = Table.AddColumn(
        WithDestinationMatch,
        "UnmappedIssues",
        (row as record) =>
            let
                contactId = Record.FieldOrDefault(row, "cr69a_id", null),
                rawRoles = Record.FieldOrDefault(row, "cr69a_roles", null),
                roleKeys = Record.FieldOrDefault(row, "RoleKeys", {}),
                formattedRoles = Record.FieldOrDefault(row, "roles_dataverse_format", null),
                destinationMatch = Record.FieldOrDefault(row, "DestinationMatch", #table({}, {})),
                unknownKeys = List.Select(roleKeys, each not Record.HasFields(ContactRoleMap, _)),
                issues = List.RemoveNulls(
                    {
                        if not HasPopulatedValue(contactId) then
                            "cr69a_id is blank"
                        else
                            null,
                        if List.IsEmpty(unknownKeys) then
                            null
                        else
                            "cr69a_roles=" & Text.Combine(unknownKeys, ","),
                        if HasPopulatedValue(rawRoles) and not HasPopulatedValue(formattedRoles) then
                            "cr69a_roles produced no Dataverse selections"
                        else
                            null,
                        if not HasPopulatedValue(contactId) or not Table.IsEmpty(destinationMatch) then
                            null
                        else
                            "No Additional Contact matched cr69a_id"
                    }
                )
            in
                if List.IsEmpty(issues) then null else Text.Combine(issues, "; "),
        type nullable text
    ),
    RowsWithRoles = Table.SelectRows(WithQA, each HasPopulatedValue([cr69a_roles])),
    Output = Table.SelectColumns(
        RowsWithRoles,
        {"cr69a_id", "cr69a_roles", "roles_dataverse_format", "UnmappedIssues"},
        MissingField.Error
    )
in
    Output;
shared ContactRoleQA = let
    Issues = Table.SelectRows(ContactRolePreparation, each [UnmappedIssues] <> null),
    Output = Table.SelectColumns(
        Issues,
        {"cr69a_id", "cr69a_roles", "roles_dataverse_format", "UnmappedIssues"},
        MissingField.Error
    )
in
    Output;
shared ContactRoles = let
    ValidatedPreparation =
        if Table.RowCount(ContactRoleQA) > 0 then
            error "One or more contact roles is invalid or could not be matched to an Additional Contact. Review ContactRoleQA before loading roles."
        else
            ContactRolePreparation,
    WithContactId = Table.AddColumn(
        ValidatedPreparation,
        "cr69a_additionalcontactid",
        each [cr69a_id],
        type nullable text
    ),
    Output = Table.SelectColumns(
        WithContactId,
        {"cr69a_additionalcontactid", "cr69a_id", "roles_dataverse_format"},
        MissingField.Error
    )
in
    Output;
