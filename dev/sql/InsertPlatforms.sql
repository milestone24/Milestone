SELECT
uas.user_asset_id as aid,
uas.id as uasid,
uas.security_id as secid,
st.currency_value as cv,
st.value_date as stvd
FROM user_asset_securities uas
RIGHT JOIN security_transactions st ON uas.id = st.asset_security_id