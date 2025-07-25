- Always use Australian English spellings such as colour, visualise, optimise instead of American English spellings (eg. color, visualize and optimze). If you see American English spelling in my code, suggest a change.

- This project has a strong separation of concerns between the client and the server.
- The server talks to OpenElectricity using the OpenElectricityClient libarary.
- The client never talks directly to OpenElectricity, only to our server.

- When a generating unit is inoperable (due to maintenance or outages) it's capacity factor will be zero, not null/undefined.
- When a capacity factor is unknown — either because the associated date is in the future or, for dates in the past, the data collection infrastructure is faulty — this is always represented as null.

- Never interpret null as zero or vice versal. Often null means "no data". Zero is a zero quantity. These are distinct concepts different and must never be swapped.

- Except where necessary (ie. interfacing external code), do not use the built-in javascript Date object. Use Adobe's @internationalized/date, and note that we have many date functions in src/shared/date-utils.ts

- Environment variables are defined and stored in `.env.local`

- When searching code, prefer ast-grep for syntax-aware and structural matching, using flags like `--lang rust -p '<pattern>'` for language-specific structural searches, instead of text-only tools like rg or grep.
