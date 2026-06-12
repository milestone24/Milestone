## FIRE projection maths

This document explains, in simple terms, the maths behind the FIRE calculator that powers the `fire-now` page. It follows the same flow as the code: from the user’s inputs, through the projection, to the withdrawal strategy.

### 1. Inputs and basic ideas

The FIRE calculator starts from:

- **Date of birth**: used to work out your **current age** and your **age at each future date**.
- **Target retirement age**: the age you would like to reach financial independence.
- **Yearly income goal**: how much money per year you want to spend in retirement (in today’s money if inflation adjustment is on).
- **Safe withdrawal rate** (for example 4%): the percentage of your pot you think you can safely spend each year.
- **Expected annual return** (for example 7%): the average growth rate of your investments per year.
- **Income goals over time**:
  - At retirement: full income goal.
  - Optionally from age 75: a reduced income goal (for example 75% of the original goal).
- **Contributors**:
  - Your existing investment accounts and their contribution schedules.
  - A monthly FIRE contribution from your settings.
  - Optional state pension income (if enabled).

From these, the calculator projects:

- How large your portfolio might grow.
- Whether that looks enough to support your income goal.
- How far ahead or behind your target you are.
- How much more or less you may need to contribute.

### 2. FIRE number (target portfolio size)

The **FIRE number** is the pot size that should be able to fund your yearly income goal at the chosen safe withdrawal rate.

- **Formula**
  - Let:
    - `I` = yearly income goal
    - `R` = safe withdrawal rate in percent (for example 4)
  - Then the FIRE number is:
    - `FIRE number = I / (R / 100)`

In words: **FIRE number = income you want each year ÷ (withdrawal rate as a decimal)**.

Example:

- Income goal `I = £40,000`
- Safe withdrawal rate `R = 4%`
- FIRE number `= 40,000 ÷ 0.04 = £1,000,000`

This is implemented in `calculateFIRENumber`.

### 3. Current age and retirement age

- **Current age** is the difference in years between today and your date of birth.
- **Target retirement date** is your date of birth plus your **target retirement age** in years.

These are used to:

- Define the projection window (from today until your target retirement date).
- Work out ages for the charts and withdrawal strategy.

### 4. How we project portfolio growth

The projection is run from **today** up to your **target retirement date**. The code turns the configuration into a date range and then uses the projection engine to simulate your portfolio over time.

At a high level, the simulation:

- Starts with your **current portfolio value**.
- For each step (for example each year):
  - **Adds contributions** from all schedules:
    - These can be monthly, yearly, or other patterns.
    - The helper `calculatePeriodContributions` projects all the contribution dates within a period and sums the amounts (and any bonuses).
  - **Applies growth**:
    - Uses your expected annual return (for example 7%).
    - This annual rate is applied consistently across time.
  - **Optionally applies modifiers**:
    - For example an inflation modifier that adjusts values so they are in today’s money.

The result is a time series of values:

- Total portfolio value by date.
- Breakdown per contributor.
- Accessible vs locked values.

This is orchestrated by `projectToRetirement`, which calls the projection engine and then derives FIRE‑specific metrics.

### 5. Progress towards FIRE

Once we have:

- **Current portfolio value** (today).
- **FIRE number** (from Section 2).

We compute:

- **Progress percentage**
  - `Progress = current portfolio value ÷ FIRE number`
  - For example, if you have £250k and need £1M, progress = 0.25 (25%).

This is stored as a decimal string and shown as a percentage in the UI.

### 6. Years ahead or behind target

We want to know if you are **on track**, **ahead**, or **behind** your target retirement age.

To do this, the calculator:

1. **Simulates the future month by month** using `calculateYearsToTarget`:
   - Start with your current portfolio value.
   - For each month:
     - Grow the pot by the monthly rate derived from the annual return.
       - If annual rate = `A%`, monthly rate `r = A / 100 / 12`.
     - Add any contributions scheduled for that month from all contributors.
   - Stop when the portfolio value reaches the FIRE number (target) or when a maximum number of years is reached.
2. The simulation returns **how many years it takes** to reach the target value (or `Infinity` if it is never reached under these assumptions).
3. We compare this to the time between **now** and your **target retirement age**:
   - Let:
     - `Y_reach` = years needed to reach the FIRE number from the simulation.
     - `Y_toTarget = target retirement age - current age`.
   - Then:
     - `years ahead/behind = Y_reach - Y_toTarget`

Interpretation:

- **Negative** value → you are **ahead** of schedule  
  (you reach your target earlier than your chosen retirement age).
- **Zero** → you are exactly **on track**.
- **Positive** value → you are **behind**  
  (you would reach your target later than your chosen retirement age).
- **Infinity** → with the current assumptions, the model does not reach the target.

This is implemented by `calculateYearsAheadOrBehind`, which calls `calculateYearsToTarget` internally.

### 7. Monthly contribution difference

The calculator also estimates how much you might need to **increase or decrease** your monthly contributions to close any gap.

#### 7.1 Estimate existing monthly contributions

First, it estimates how much you are already contributing per month from all contributors:

1. Take today as the start of a one‑year window.
2. For each contributor:
   - Use `calculatePeriodContributions` to compute:
     - Total user contributions over that year.
     - Total bonuses (for example employer matches or promotions).
3. Sum these across all contributors:
   - **Total annual user contributions**.
   - **Total annual bonuses**.
4. Convert to monthly figures:
   - **Approximate user monthly contribution**:
     - Annual user contributions ÷ 12.
   - **Existing total monthly contribution** (user + bonuses):
     - (Annual user contributions + annual bonuses) ÷ 12.

The value shown as “current monthly contribution” is based on **user contributions only** (excluding bonuses).

#### 7.2 Define the gap at retirement

From the main projection we know:

- **Projected value at retirement** (what the model thinks your pot will be worth at your target age).
- **FIRE number** (what you need).

We define:

- **Target difference**:
  - `difference = projected value at retirement - FIRE number`
  - If this is **negative**, you have a **shortfall** (you are below target).
  - If this is **positive**, you are **over the target** (you may be contributing more than needed).

We also know how many months remain until your target age:

- `months remaining = (target retirement age - current age) × 12`

#### 7.3 Solve for the needed monthly adjustment

The calculator treats the gap like a **series of equal monthly payments that grow at the same rate as your investments**.

- Let:
  - `D` = target difference (can be positive or negative).
  - `A` = annual growth rate in percent (for example 7).
  - `r = A / 100 / 12` = monthly growth rate as a decimal.
  - `n` = months remaining.

We want a monthly payment that, when compounded, closes the gap `D`. This is similar to the future value of an annuity formula:

- Future value of regular monthly payments:
  - `FV = PMT × ((1 + r)^n - 1) / r`
- Here we want `FV = -D` (the negative sign means “close the gap, not create it”).

So:

- If `r = 0` (no growth):
  - `PMT = -D / n`
- Otherwise:
  - `PMT = -D / (((1 + r)^n - 1) / r)`

This gives the **monthly adjustment** that, starting now, would cover the gap by retirement.

#### 7.4 Convert back to user‑visible numbers

Because contributors can have bonuses, the code:

1. Adds the adjustment onto the existing **total** monthly contribution (user + bonuses).
2. Uses the current ratio of **user contributions to total contributions** to estimate how much of that total should reasonably be user money.
3. From this, it computes:
   - **Needed user monthly contribution**.
   - **Monthly contribution difference**:
     - `difference = current user monthly - needed user monthly`

Interpretation:

- **Positive** monthly contribution difference:
  - You are paying in **more than required** to hit the target on the current assumptions (you could reduce contributions and still be on track).
- **Negative** monthly contribution difference:
  - You are paying in **less than required** (you would need to increase contributions to hit the target).

These values are returned by `calculateMonthlyContributionDifference` and shown in the FIRE UI.

### 8. Age‑based projection for charts

The projection engine works with calendar dates. For the FIRE charts, the app converts dates to **ages** so that the x‑axis can be “age” instead of “date”.

For each projection point:

1. Work out the age at that date:
   - Subtract the birth year from the point’s year.
   - Adjust by month and day so the age only increases after a birthday has passed.
2. Record:
   - Age.
   - Portfolio value.
   - Target value (FIRE number).
   - Accessible and locked portions if available.

This is implemented in `convertToAgeBasedProjection`. The result is a simple list of:

- Age → portfolio value → FIRE target.

The chart then plots these to show how your projected pot compares to your target across your life.

### 9. Withdrawal strategy and account access

The app also computes a **withdrawal strategy**: how different accounts could be used to meet your income goals after retirement, and when those accounts become available.

#### 9.1 Unlock ages for each contributor

Each contributor can have **value release rules** that say when it can be accessed. For example:

- A pension might be accessible from age 55.
- A Lifetime ISA may have a penalty if accessed before a certain age.

From these rules, the code finds the **earliest unlock age** for each contributor:

- If the rule is an age (for example “55”), that age is used directly.
- If the rule is a date, it converts that date into an age using your date of birth.

This is done in `getContributorUnlockAge` and wrapped in `buildContributorUnlockInfo`, which also tags each contributor with simple **tax characteristics** (for example “Tax‑free”, “Capital gains tax”, “Taxed as income”).

#### 9.2 Account access timeline

Using the unlock information and the projection results, `buildAccountAccessTimeline` creates a list that shows, for each contributor:

- Whether it is **immediately accessible** or **only accessible from a future age**.
- The age at which it becomes accessible (if not already accessible).
- The **projected value** at that age:
  - For regular investment accounts: the projected pot value at that age.
  - For income‑stream contributors (for example state pension): the yearly income amount.
- The tax characteristics.

This timeline is sorted by age so the UI can show “which accounts unlock when” and how much value or income they provide at that point.

#### 9.3 Withdrawal phases

The withdrawal plan is broken into **phases**:

- A **building phase**:
  - From your current age up to your **target retirement age**.
  - Income target is zero (you are still building your pot).
- One or more **withdrawal phases**:
  - From your target retirement age onwards.

Phase boundaries are chosen by combining:

- Your **target retirement age**.
- All **contributor unlock ages** at or after your target age.
- All **income goal change ages** at or after your target age (for example spending dropping at 75).

These ages are sorted to create a sequence of phases, for example:

- Age 60–66: draw from accessible accounts before state pension.
- Age 66–75: include state pension income plus drawdowns.
- Age 75+: use lower spending target and adjust withdrawals.

For each withdrawal phase:

1. The calculator finds the **income goal** that applies from that age (for example full goal at 60, reduced goal at 75).
2. It identifies which contributors are **available** at that age:
   - Those already accessible.
   - Those that unlock at or before that age.
3. It allocates income in two steps (in `calculatePhaseAllocations`):
   - **Income‑stream contributors first** (for example state pension):
     - Uses `getAnnualScheduledIncomeForContributor` to compute yearly income from their schedules.
     - This income directly reduces the amount still needed from other accounts.
   - **Pot‑based contributors next** (ISAs, GIAs, pensions, etc.):
     - For each available pot, it looks at the **projected value at the start age of the phase**.
     - It then allocates a portion of that value (currently a simple fraction of the pot) towards meeting the yearly income target.
     - Pots are used in an order that reflects simple tax‑efficiency priorities (for example taxable accounts first, tax‑advantaged accounts later).
4. If the total income from all sources **can’t fully meet** the income target for the phase, the shortfall is recorded as a **warning**.

The result is a list of phases, each with:

- Age range.
- Income target.
- Allocations per account.
- Any warnings about shortfalls.

These phases and the access timeline are combined into the final `withdrawalStrategy` returned by `calculateWithdrawalStrategy` and displayed on the FIRE page.

