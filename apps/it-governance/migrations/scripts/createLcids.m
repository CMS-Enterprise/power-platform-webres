let
  Prev = StagingRaw,

  // Treat null / empty / whitespace / "null" / zero-GUID as missing
  IsNullishLCID = (v as any) as logical =>
    let s = if v = null then null else Text.Lower(Text.Trim(Text.From(v))) in
      s = null or s = "" or s = "null" or s = "n/a" or s = "na" or s = "-" or s = "0" or s = "00000000-0000-0000-0000-000000000000",

  // Filter out rows with missing LCIDs
  #"Filtered Null LCIDs" = Table.SelectRows(Prev, each not IsNullishLCID([cr69a_lcid]))
in
  #"Filtered Null LCIDs"