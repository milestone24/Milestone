




with tc as (
	SELECT
	ua.user_account_id as account_id,
	uas.user_asset_id as user_asset_id,
	uas.id as uasid,
	uas.security_id as secid,
	st.value_date as value_date,
	st.updated_at as updated_at,
	st.created_at as created_at,
	st.currency_value as cv,
	(sum(currency_value) over (partition by uas.id order by value_date rows unbounded preceding)) as accUas,
	(sum(currency_value) over (partition by uas.user_asset_id order by value_date rows unbounded preceding)) as accUass,
	ROW_NUMBER() OVER (PARTITION BY uas.id ORDER BY st.value_date) as asecrow,
	ROW_NUMBER() OVER (PARTITION BY uas.user_asset_id ORDER BY st.value_date) as assrow
	FROM user_asset_securities uas
	RIGHT JOIN user_assets ua ON ua.id = uas.user_asset_id 
	RIGHT JOIN security_transactions st ON uas.id = st.asset_security_id
	where ua.user_account_id='1ff054ec-b380-45b1-8e23-7e98514a68f2'
	--where uas.user_asset_id='115b8ea3-69a5-4911-962f-ec2b1f41317b'
	--where uas.user_asset_id='ce95f3e8-5473-40d1-8077-625e4829bcd6'
	--ORDER BY st.value_date, assrow
	ORDER BY user_asset_id, assrow
)

select * from tc
