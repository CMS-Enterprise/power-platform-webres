let
    Source = Csv.Document(
        Web.Contents(
            "https://cmsgovonline-my.sharepoint.com/personal/cooper_heinrichs_cms_hhs_gov/Documents/Apps/Power Query Online GCC-L2/Uploaded Files/system_intake_contacts.csv"
        ),
        [
            Delimiter = ",",
            Columns = 10,
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
            {"component", type text},
            {"created_at", type datetime},
            {"modified_at", type text},
            {"user_id", type text},
            {"roles", type text},
            {"is_requester", type logical},
            {"created_by", type text},
            {"modified_by", type text}
        }
    )
in
    #"Changed column type"
