# Business Module Extension Guide

No example business module is implemented in v1.

Future modules should add their own:

- API routes
- service layer
- repository layer
- Zod contracts
- permission manifest entries
- route metadata
- menu entries where applicable
- data permission resource type
- field permission resource type
- tests
- documentation

Future modules must not bypass base authentication, API authorization, organization context, permission cache, adapter boundaries, request IDs, or structured logging.
