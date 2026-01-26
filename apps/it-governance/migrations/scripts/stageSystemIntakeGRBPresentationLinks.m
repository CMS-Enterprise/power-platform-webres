let
    // Your source step (you will already have this above)
    Source = Csv.Document(
        Web.Contents(
            "https://cmsgovonline-my.sharepoint.com/personal/cooper_heinrichs_cms_hhs_gov/Documents/Apps/Power Query Online GCC-L2/Uploaded Files/system_intake_grb_presentation_links.csv"
        ),
        [
            Delimiter = ",",
            Columns = 13,
            QuoteStyle = QuoteStyle.None
        ]
    ),
    #"Promoted headers" = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    // Replace literal "NULL" strings with actual null values
    #"Replace NULLs" = Table.ReplaceValue(
        #"Promoted headers", "NULL", null, Replacer.ReplaceValue, Table.ColumnNames(#"Promoted headers")
    ),
    // Apply column type transformations AFTER cleaning
    #"Changed column type" = Table.TransformColumnTypes(
        #"Replace NULLs",
        {
            {"id", type text},
            {"created_by", type text},
            {"created_at", type datetime},
            {"modified_by", type text},
            {"modified_at", type datetime},
            {"system_intake_id", type text},
            {"recording_link", type text},
            {"recording_passcode", type text},
            {"transcript_link", type text},
            {"transcript_s3_key", type text},
            {"transcript_file_name", type text},
            {"presentation_deck_s3_key", type text},
            {"presentation_deck_file_name", type text}
        }
    )
in
    #"Changed column type"
