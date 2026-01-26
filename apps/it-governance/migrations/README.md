# Data Migration Guide

Migrating data between EASI and the IT Governance Power App should be handled by the following power automate flows.

1. Intake - Stage All Data
   - This job takes all of the csv data from EASI, which is stored in CSV files on sharepoint, and stores it into dataverse tables that are accessible by dataflows.
1. Intake - Migrate All Data
   - This job takes all data from staging tables and stores it in our real entity tables.

Rolling back the migrations can be accomplished by running the following flows:

1. Intake - Rollback Migration Data
   - This job takes a batch ID as an argument and deletes any data in the entity tables with the matching batch ID.
1. Intake - Rollback Staged Migration Data
   - This job removes all data from the staging tables

Migration order is important, as various records rely on others existing, but it has been written into these Power Automate flows.

Data migration details can be found in the [IT Governance Intake Request Mapping Workbook](https://docs.google.com/spreadsheets/d/1-TfJrVtfF5lW-SKITZK1plbBq_KQsQMUslB9jk5Pwbo/edit?usp=sharing)

TODO
Review Data Migration - move required data from intake requests to Reviews.
CEDAR systems need some sort of connection, a representation in dev, and then higher environments.

EASI Postgresql Table Data Source Inventory

business_cases
estimated_lifecycle_costs
feedback_valid_source_target_combinatiions (doesn't seem neccessary)
governance_request_feedback
system_intake_contacts
system_intake_contacts_legacy
system_intake_contract_numbers
system_intake_documents
system_intake_funding_sources
system_intake_grb_presentation_links
system_intake_grb_reviewers
system_intake_internal_grb_review_discussion_posts
system_intake_systems
system_intakes
