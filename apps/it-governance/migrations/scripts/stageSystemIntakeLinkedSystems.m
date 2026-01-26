let
    Source = Csv.Document(
        Web.Contents(
            "https://cmsgovonline-my.sharepoint.com/personal/cooper_heinrichs_cms_hhs_gov/Documents/Apps/Power Query Online GCC-L2/Uploaded Files/system_intake_systems.csv"
        ),
        [
            Delimiter = ",",
            Columns = 9,
            QuoteStyle = QuoteStyle.None
        ]
    ),
    #"Promoted headers" = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    // Replace "NULL" text values with actual nulls
    #"Replace NULLs" = Table.ReplaceValue(
        #"Promoted headers", "NULL", null, Replacer.ReplaceValue, Table.ColumnNames(#"Promoted headers")
    ),
    #"Changed column type" = Table.TransformColumnTypes(
        #"Replace NULLs",
        {
            {"id", type text},
            {"system_intake_id", type text},
            {"system_id", type text},
            {"created_by", type text},
            {"created_at", type datetime},
            {"modified_by", type text},
            {"modified_at", type datetime},
            {"relationship_type", type text},
            {"other_system_relationship_description", type text}
        }
    )
in
    #"Changed column type"
