# Execute Business Module permissions through typed predicates and scenarios

Business Module data access uses a strict versioned rule document and a neutral
predicate boundary. A Data Resource declares `accessModel` and a dedicated `data`
permission through `permissionCode`. Policy resources fail closed unless that
permission remains in the effective permission set and at least one valid allow
rule compiles. Super Administrators bypass data and field restrictions.

Version 1 rule documents contain `version`, `resourceType`, and an expression made
from `all`, `and`, `or`, or `condition`. Base conditions cover current User, current
Organization, current Organization descendants, specified Organizations, specified
Users, and specified Roles. Module-defined handlers may return only validated
neutral predicates over fields declared by their Data Resource. They cannot return
SQL or Drizzle expressions.

The permission result is the union of valid allow predicates minus the union of
deny predicates. Missing grants, declarations, handlers, context, invalid rule
documents, and undeclared predicate fields produce a false predicate. Drizzle owns
the final column mapping and parameterized SQLite/PostgreSQL SQL translation.

Field rules are keyed by `resource + field + scenario`, where scenario is `list`,
`detail`, `create`, or `edit`. Hidden fields are removed from responses and rejected
in writes. Readonly fields remain visible and are rejected in create/edit writes.
When multiple role rules apply, `hidden` is strongest, then `readonly`, then
`visible`. Business API declarations identify their request and response resource
scenarios, and frontend helpers use the same effective rules for control visibility
and writability.

Custom operator codes are declared by the Data Resource and registered explicitly
by the API runtime. Build-time conformance validates the resource permission type,
resource fields, API resource references, operator namespace, and bidirectional
operator registration. Production Business Module registries remain empty; all
executable examples remain isolated test fixtures.

This decision rejects arbitrary JSON rules, raw SQL rules, implicit resource-to-
permission naming, frontend-only enforcement, and permissive fallback behavior.
Capability ports remain a separate Phase 4 concern.

Implementation status: Phase 3 executable data and field permissions are implemented. Phase 4 capability ports are implemented under ADR 0007.
