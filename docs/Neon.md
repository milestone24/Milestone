
# This document contains useful commands an instructions for Neon.

## CLI

To use the cli you will first need to authorise with

```bash
neon auth
```

When using any of the neon subcommands you would have use the project-id option
to specify which neon project you want to use for context.
```bash
neon project-id=project_id branches list
```

You can find your project ids with
```bash
neon projects list
```

Note: Alternative is to set up context file in your project.
see https://neon.com/docs/reference/cli-set-context
```bash
neon set-context
```