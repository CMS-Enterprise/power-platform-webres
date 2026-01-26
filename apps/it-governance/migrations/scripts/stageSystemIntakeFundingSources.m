let
    Source = Csv.Document(
        Web.Contents(
            "https://cmsgovonline-my.sharepoint.com/personal/cooper_heinrichs_cms_hhs_gov/Documents/Apps/Power Query Online GCC-L2/Uploaded Files/system_intake_funding_sources.csv"
        ),
        [
            Delimiter = ",",
            Columns = 5,
            QuoteStyle = QuoteStyle.None
        ]
    ),
    #"Promoted headers" = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    #"Replace NULLs" = Table.ReplaceValue(
        #"Promoted headers", "NULL", null, Replacer.ReplaceValue, Table.ColumnNames(#"Promoted headers")
    ),
    #"Changed column type" = Table.TransformColumnTypes(
        #"Replace NULLs",
        {
            {"id", type text},
            {"system_intake_id", type text},
            {"investment", type text},
            {"project_number", Int64.Type},
            {"created_at", type datetime}
        }
    )
in
    #"Changed column type"
