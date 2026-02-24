-- Override dbt's default schema-name logic so that custom schemas are used
-- as-is (no prefix). This means:
--   staging models → epl_staging   (not epl_staging_epl_staging)
--   mart models    → epl_mart      (not epl_staging_epl_mart)

{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}
        {{ default__generate_schema_name(custom_schema_name, node) }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
