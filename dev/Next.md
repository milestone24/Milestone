Issues


Need to obtain start date when pre polutating all teh securities histories
This in general will not be needed, as securites will be populated as they are added
with a asset provider security which will have a start date.

Most securities will be added in the context of a tax wrapper, so the tax wrapper
should have a start date, therefor the nested security should capture its startdate from the tax wrapper.

How far does history go back for aodhd of alpha vantage?
- Do we say that they have to give a value at least one year ago? or maybe 6 months?

Need worker to fill history and asset values when a security is added.