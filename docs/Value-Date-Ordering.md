


Value dates are being pushed into teh db at the same time with exactly teh same date value.

This is causing an issue with ordering.

It seems 


for asset securities value date has to be unique for ordering some how at the security level maybe with another order by field

^^ WRONG, when doing the `sum` at the db level for the asset context teh value date has to be unique for ordering becuase teh calculation is done accumluating all asset security values

Could we use update_at if updated at was a precision of 6(microseconds).
- No in batches updated_at and recorded_at at precisely the same. !!!!!

How likely is it that a security transaction exactly the same date.
- What can we do to make sure 

Maybe we dettect there is already a security transaction on teh same day, and force the user chose if before or after (order), or add a time.


The database query is returning asset transactions in context of an asset.
The functions to get day value for graphing and predictions require each transaction in a list of transactions to have a representative accumulated value across all transactions and nested transctions ie for nested security transactions

mayve the accumalated asset value is a result of accumlating the sum of security context sums with a date last 


