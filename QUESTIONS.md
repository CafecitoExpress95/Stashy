# Stashy Questions

This is the ordered question list I need answered before I can build a stronger position on what changes, additions, and product ideas will benefit Stashy most.

## Ordered Questions

1. Is Stashy only for the specific "sit down and pay credit cards" workflow, or should it eventually cover broader personal finance tracking?

We should strive for "specificity of purpose" so thus stick to paying cards/accounts.

2. Who is the first real user: Anthony only, Anthony-plus-power-users, or a general consumer who has never seen the spreadsheet?

Anthony, with the opportunity for others to see if they like the workflow.

3. What is the MVP success condition: replacing the current Google Sheet completely, making payment sessions safer, producing better analysis, or something else?

Replacing the Google Sheet is Milestone 1 (MS-01).

4. During a sit-down, is the app helping you decide what to pay, recording decisions you already made, or both?

It's a bit of both.

5. Does Stashy ever initiate payments, connect to banks, scrape balances, or import transactions, or is every balance and confirmation entered manually?

No.

6. What should the app optimize for first: raw speed of data entry, overdraft prevention, clean historical records, or analysis?

Priority list is: overdraft prevention, raw speed of data entry, clean historical records, and lastly analysis.

7. How often do sit-downs happen, and are they always one-off sessions or sometimes multi-day/pending sessions?

2-3 times per month.

8. Can a session be saved as a draft before all payments are complete?

Yes. Stuff like PayPal doesn't give a confirmation code until the payments posts, for example.

9. Once a session is saved, should editing it rewrite history, create an audit trail, or create a corrected replacement session?

Create an audit trail.

10. If an old session is edited, should later account balances be recalculated, left alone, or flagged as potentially stale?

We enter the new balances every sit-down so it doesn't matter.

11. Is "current balance" on an account a manually editable field, a derived value from the latest session, or both?

It's user-given always.

12. Are opening asset balances snapshots only, or should they also be treated as balance-changing records in account history?

Again, user-given each sit-down.

13. Are liability starting balances snapshots only, or should they also be treated as balance-changing records in account history?

Again, user-given each sit-down.

14. Do asset accounts need their own records for deposits, transfers, adjustments, and non-credit-card spending, or only the opening/final balances captured during payment sessions?

For now, just the opening/final balances. However, the data model should remain flexible and extensible.

15. Can a payment be split across multiple source asset accounts?

No, since you need to wait for one payment to post before you can make another from a different source asset account.

16. Can multiple payments be made to the same liability account in one sit-down?

No. No bank/entity lets you do this.

17. Can one source asset payment cover multiple liability accounts as a batch, or is each liability row always its own payment record?

Each row gets a payment record.

18. Should pending payments affect the source asset balance immediately, or only after they are confirmed?

Immediately.

19. What payment statuses are needed beyond confirmation ID: planned, pending, confirmed, failed, canceled, scheduled, or posted?

We don't need these kinds of statuses since we can just stick it notes manually for now.

20. Are confirmation IDs unique enough to validate or search by, or are they just notes?

They're unique and can be searched for.

21. Should Stashy track due dates, statement closing dates, minimum payments, APR, autopay status, or payoff priority?

For now, no. But it's not off the table for later.

22. Are the note labels in the spreadsheet, like "None due", "Minimum", "Statement", "Interest Saving", "Balance", and "Custom", formal payment intents or free-form notes?

Free-form notes are the current MVP level.

23. Should "full balance" and "statement balance" be fixed payment modes only, or should there also be minimum payment, interest saving amount, remaining statement balance, and custom presets?

Full balance, statement balance, custom. That's it.

24. What exactly should "remaining balance" mean for a liability account: starting balance minus this session's payment, statement balance minus payment, or something user-selectable?

We should track both. Remaining account balance. Remaining statement balance.

25. Should negative, zero, and overpayment states be allowed, blocked, or warned about?

Warn about them.

26. How should asset threshold colors work: per-account fixed limits, percentage-based limits, both, or global defaults with per-account overrides?

That's per account but we should be able to set defaults in our "app" settings.

27. Should threshold warnings be passive visual cues, blocking validation, or explicit confirmation prompts before saving?

Passive visual cues.

28. What does "local-first" mean for this project: local-only, optional cloud sync later, file-based storage, encrypted database, or something else?

IndexedDB with file exports/imports available.

29. What import/export format matters most: JSON, CSV, SQLite backup, Google Sheets import, printable reports, or something else?

Probably JSON or something like KMLs/KMZs (archive type "folders")

30. Does the existing Google Sheet history need to be imported, or can Stashy start fresh?

Stashy starts fresh.

31. If historical spreadsheet data should be imported, how consistent is the old data shape across sessions?

N/A

32. What platforms matter for the first build: desktop web, mobile web, PWA, Tauri desktop app, native mobile, or something else?

Desktop with mobile friendliness secondary.

33. Should mobile preserve the spreadsheet-like dense cockpit, or use a step-by-step workflow optimized for small screens?

Mobile may need step-by-step honestly. Though Desktop shouldn't just preserve a spreadsheet-like cockpit. We want more... Tactile engagement.

34. What is the minimum acceptable archive view: searchable list, filterable list, account-linked timeline, or full session replay?

For now just full session replay.

35. What questions should the Whiteboard answer on day one?

(1) Eagle eye of where we are as of the last sit-down
(2) Dig deeper into each account and see historicals

36. Which account-level graphs are actually useful first: balance over time, payments over time, utilization, remaining balance after payment, threshold crossings, or something else?

Balance over time is the main one.

37. Should graph datapoints come from sessions only, payment records only, account snapshots, or a normalized event ledger?

Payment records define the datapoints.

38. Should Stashy support account hiding/archiving when a card or bank account is closed?

Yes.

39. What account fields are required beyond name and type: institution, last four digits, color, icon, threshold settings, notes, URL, or sort order?

Just name for now is OK.

40. What should happen when an account is renamed: should old sessions display the current name or preserve the historical name?

Update everything.

41. Is there any need for multi-user support, multiple profiles, household mode, or shared data files?

Only single user.

42. What privacy/security bar is required locally: no password, app lock, encrypted storage, export encryption, or OS-level protection only?

No protection for now.

43. Should Stashy have reminders or a calendar-like view for upcoming payment due dates?

No.

44. What should the app do better than the spreadsheet on the very first usable day?

Easier, more tactile flow through the sit-down process.

45. What spreadsheet behavior must be preserved exactly because it is already part of your muscle memory?

Just the general layout of how the UI flows.

46. What spreadsheet behavior should be intentionally killed because it only exists as a workaround?

The fact it's a stupid spreadsheet.

47. What is the highest-risk mistake Stashy must prevent: overdrawing an asset account, missing a payment, recording bad history, double-paying, or losing local data?

Overdraft is the worst thing that can happen.

48. Are there any calculations where approximate display is acceptable, or should money be handled with exact decimal arithmetic everywhere?

Decimal arithmetic always. Pennies count in banking.

49. Should every saved session be internally balanced by validation rules, or should the app allow messy real-world records with warnings?

Messiness happens. Just warn people.

50. What is the first "strong opinion" you want the app to have that the spreadsheet currently cannot enforce?

Sit-downs should feel satisfying even when your money situation fucking sucks.
