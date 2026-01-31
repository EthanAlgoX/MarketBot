# Blinko API Reference

Endpoints used by this skill:

## List notes
- POST `/v1/note/list`
  - Payload: page, size, orderBy, type, tagId, isArchived, searchText
  - Returns: list of notes

## Create/Update note
- POST `/v1/note/upsert`
  - Payload: content, type

## Delete notes
- POST `/v1/note/batch-delete`
  - Payload: ids

## List tags
- GET `/v1/tags/list`
  - Returns: list of tags

## Delete tag
- POST `/v1/tags/delete-only-tag`
  - Payload: id
