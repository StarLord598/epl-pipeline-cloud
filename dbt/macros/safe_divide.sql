{% macro safe_divide(numer, denom) %}
  {#
    Cross-database safe divide.
    - BigQuery has SAFE_DIVIDE(numer, denom)
    - DuckDB does not.
  #}
  {% if target.type == 'bigquery' %}
    SAFE_DIVIDE({{ numer }}, {{ denom }})
  {% else %}
    CASE
      WHEN {{ denom }} IS NULL OR {{ denom }} = 0 THEN NULL
      ELSE ({{ numer }})::DOUBLE / ({{ denom }})::DOUBLE
    END
  {% endif %}
{% endmacro %}
