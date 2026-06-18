# Stashy

## Table of Contents
- [Stashy](#stashy)
  - [Table of Contents](#table-of-contents)
  - [Application Overview](#application-overview)
  - [MS-01](#ms-01)
  - [What Stashy Is Not](#what-stashy-is-not)
  - [User Workflow](#user-workflow)
    - [Sessions](#sessions)
      - [Sit Down (Begin New Session)](#sit-down-begin-new-session)
      - [Check Archive (Review Past Sessions)](#check-archive-review-past-sessions)
      - [Visit Whiteboard (Analysis View)](#visit-whiteboard-analysis-view)
    - [Configuration](#configuration)
  - [Data Model](#data-model)
    - [Anthony's Notes](#anthonys-notes)
 
## Application Overview

Stashy is a simple, local-first, privacy-focused app for tracking your sit-down sessions where you pay your credit cards/accounts.

Initiate a sit-down, input the date, update your asset accounts, update your liability accounts, input your payment amounts, record your confirmation numbers, add your notes, and watch your asset balances update live as you work to avoid overdrafts.

As a secondary side effect of this methodology, you unlock account-specific historical analysis using graph views, graph lines, and other useful analysis tools.

Specificity of purpose matters here. Stashy is not a big generic finance app. It is a cockpit for a very specific kind of sit-down. You show up, update the truth manually, decide what to pay, record what happened, and stand up with less anxiety than you had when you sat down.

Lastly, though the app can be used on desktop, it should be mobile-friendly too. Desktop is the first-class target for MS-01, but mobile should not feel like we just smashed a spreadsheet into a tiny rectangle and called it a day.

## MS-01

Milestone 1 is simple: replace Anthony's current Google Sheet.

The priority order is:

1. Prevent overdrafts
2. Make data entry fast
3. Keep clean historical records
4. Provide useful analysis

This is a manual-entry app on purpose. Stashy does not connect to banks, initiate payments, scrape balances, or import transactions for MS-01. Every balance is user-given. Pennies count, so money calculations should use exact decimal arithmetic everywhere.

The storage plan for MS-01 is IndexedDB with file import/export. JSON is probably the first export format unless a folder/archive style proves to be a better fit.

Stashy starts fresh. We are not importing the old Google Sheet history for MS-01.

## What Stashy Is Not

For MS-01, Stashy is not trying to be:

- A full budgeting app
- A bank integration app
- A bill reminder app
- A due date tracker
- A transaction importer
- A payment status tracker
- A multi-user household finance thing
- A locked-down encrypted vault

Some of those ideas may become useful later. For now, we should not piss up over our heads.

## User Workflow
 
The main screen should be simple and have the following breakdowns:

- Sessions
  - Sit Down (Begin New Session)
  - Check Archive (Review Past Sessions)
  - Visit Whiteboard (Analysis View)
- Configuration
  - Edit Accounts
  - Save Data
  - Import Data

### Sessions

#### Sit Down (Begin New Session)

Here is an example of a real "sit-down" from my current Google Sheet method. I want to capture the same "feeling" in the UI though obviously with much needed improvements.

![Example of a "sit-down" from Anthony's Google Sheets](./img/sheets_example.png)

The real workflow I follow today goes as follows:
1. Update asset accounts at the top for the "Opening" row
2. For the liability accounts, update their "Starting Balance" column
3. Put in what I am going to pay for each liability account, lining up under the corresponding asset account I will pay from (the columns add then live subtract from the "Opening" balance and update the "Final" row)
4. The "Remaining Balance" column updates the moment I put in what I am paying in that given row
5. There are comments off to the right on if I paid the statement, balance, interest saving amount, etc.
6. Confirmation ID and Notes share a cell because I didn't want to make the table too big

The way I would like to work in Stashy is:
1. Set the date of the sit down
2. Update the opening balance of the asset accounts
3. Update the liability accounts for their account balance AND statement balance
4. For each liability account, select the source asset account payment is coming from
5. Have a place to put the payment amount as "full balance", "statement balance", or "custom"
   1. Full Balance - Sets the payment amount to the account balance
   2. Statement Balance - Sets the payment amount to the statement balance
   3. Custom - Sets the payment amount to whatever the user put in the payment amount box
6. Track both remaining account balance and remaining statement balance
7. The balance of the corresponding source asset account live updates visually
   1. The balance changes colors based on the thresholds set in that accounts settings (e.g. I can set my checking to go orange under \$200 and red under \$100, but could be green over \$500, etc.). User could also not set any if they want.
   2. Pending payments hit the source asset balance immediately because that is how I need to think about the money during the sit-down.
   3. Thresholds are passive visual cues, not blockers.
8. Warn about negative, zero, and overpayment states, but do not block the user because messiness happens.
9. Input the confirmation ID (if applicable)
10. Update notes (if any)
11. Save as a draft if the sit-down is not ready to stand up yet
12. Hit "Stand Up (Save)"

Saved sessions can still be incomplete in the real-world sense. Example: PayPal may not give a confirmation code until the payment posts. That should not force the whole session to remain a draft. The user should be able to come back and fill the confirmation ID in later.

For MS-01, payment notes are free-form. Labels like "None due", "Minimum", "Statement", "Interest Saving", "Balance", and "Custom" can live in notes for now instead of becoming a big formal system.

The UX should be a hybrid cockpit. Desktop should show enough of the full picture to feel powerful, but each liability row should have focused controls so the payment flow feels tactile instead of like clicking around a dumb spreadsheet. Mobile can be more step-by-step if that is what it takes to make the workflow feel sane.

#### Check Archive (Review Past Sessions)

Checking the archive should simply provide a clean list showing the list of sit-downs from latest to oldest, top to bottom.

Clicking one will open it in view mode and you can hit "edit" to change things about it in the standard "sit down" view. For MS-01, the minimum acceptable archive view is full session replay.

Editing a session should create an audit trail. That audit trail does not need to be a beautiful user-facing feature on day one, but the structure should exist so we are not pretending edits never happened. Old edits should not recalculate later sit-downs because the balances are user-given every time.

#### Visit Whiteboard (Analysis View)

This analysis view opens a dashboard showing the last known state of your assets and liabilities. It should answer two day-one questions:

1. What does the eagle-eye view look like as of the last sit-down?
2. What happens when I dig into a specific account and look at its history?

If you select a specific account, it will take you to a graph view of that account, showing the time-base history of the balance with your user-defined limit lines and other markers.

Balance over time is the main graph for MS-01. Payment records define liability-account datapoints. Asset accounts also get their own records because they matter in their own right, not just as the thing payments subtract from.

Below the graph, there will be a table basically showing the same information in tabular form.

If you click on a specific datapoint (graph or table), you will get a small tooltip which shows the date of the sit down, the balances, the payment amount, source account, confirmation ID, notes, etc. and also a button to view that session. You can also just X out the tooltip.

### Configuration

Configuration should stay small for MS-01:

- Edit Accounts
- Save Data
- Import Data

Accounts only need two types right now: asset and liability. Keep it simple. We do not need checking, savings, credit card, loan, and sixteen other little buckets yet.

Accounts should support being archived/hidden when they are no longer active.

Account names can be updated globally. If an account gets renamed, old sessions should display the new name. We are not preserving historical account names for MS-01.

Asset thresholds should be configurable per account, with app-level defaults available so setup does not become tedious.

## Data Model

### Anthony's Notes

I believe that the data model should stay flat enough that we can pass IDs around and retrieve related information swiftly instead of burying everything in bureaucracy.

The rough shape should look something like this:

- App Settings
  - ID
  - Created/Edited
  - Default Asset Thresholds
  - Import/Export Metadata
- Account
  - ID
  - Created/Edited
  - Type
  - Name
  - Archived
  - Threshold Settings
- Session
  - ID (standard DB shit)
  - Created/Edited (standard DB shit)
  - Sit-Down Date
  - Draft
  - Account Records
  - Payment Records
- Payment Record
  - ID
  - Session
  - Liability Account
  - Date
  - Source Asset Account
  - Payment Mode
  - Payment Amount
  - Starting Account Balance
  - Starting Statement Balance
  - Remaining Account Balance
  - Remaining Statement Balance
  - Confirmation ID
  - Notes
- Account Record
  - ID
  - Session
  - Account
  - Date
  - Opening Balance
  - Final Balance
  - Opening Statement Balance (liabilities only, probably nullable)
  - Final Statement Balance (liabilities only, probably nullable)
- Audit Entry
  - ID
  - Entity Type
  - Entity ID
  - Created
  - Before
  - After
  - Notes

The exact names can change once we are writing code, but the idea should stay steady:

- Accounts are simple: name, type, archive state, threshold settings.
- Sessions are sit-down containers.
- Payment records describe what was paid from where.
- Account records preserve what each account looked like during that sit-down.
- Audit entries preserve edits so we can make them visible/usable later.

Do not derive everything from one clever ledger too early. Also do not make the model so dumb that the Whiteboard has nothing clean to graph. The point is to keep the hierarchy flat without losing the story of what happened.
