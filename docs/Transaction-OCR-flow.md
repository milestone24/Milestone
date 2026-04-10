

```mermaid
flowchart TD
A[Has Platform In Config]
D{Platform Confirmed}
E[Scan Document]
F[Exit with brand not found]
A -->|yes| B[Confirm Brand in document]
A -->|no| C[Find Platform Brand]
B --> D
C --> D
D -->|yes| E
D -->|no| F
```


Has plaftorm in config
- Yes
  Confirm branding in document

