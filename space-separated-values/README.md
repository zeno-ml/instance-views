# Zeno View for Space Separated Values

This is a view for displaying data points where the data and output are in columns separated by spaces.

Below is an example for part-of-speech tagging. Note that it is possible to have multiple rows separated by newlines.

data
```
The language is named Go
the language is named go
```

label
```
determiner noun auxiliary verb noun
```

output
```
determiner noun auxiliary verb verb
```

## Development

```bash
npm install
npm run build
```
