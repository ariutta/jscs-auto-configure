TESTING
=======

## While Developing
To automatically run tests whenever code changes while developing:

```bash
gulp
```

## Example 1
Manually run the tests for jscsAutoconfigure.getJscsErrors:

```bash
gulp testGetJscsErrors
```

## Update Expected Data
To update the expected data for a given method, use the "update" flag:

```bash
gulp testGetJscsErrors --update=jscsAutoconfigure.getJscsErrors
```
