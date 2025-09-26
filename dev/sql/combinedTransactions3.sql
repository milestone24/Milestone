with tca as (

	with tc as (
		SELECT
		uas.user_asset_id as user_asset_id,
		uas.id as uasid,
		uas.security_id as secid,
		st.currency_value as cv,
		st.value_date as value_date,
		st.updated_at as updated_at,
		st.created_at as created_at,
		(sum(currency_value) over (partition by uas.id order by value_date rows unbounded preceding)) as accUas,
		ROW_NUMBER() OVER (PARTITION BY uas.id ORDER BY st.value_date) as asrow
		FROM user_asset_securities uas
		RIGHT JOIN security_transactions st ON uas.id = st.asset_security_id
		ORDER BY st.value_date
	)

	final_per_security as (
		select 
			user_asset_id,
			uasid,
			secid,
			cv,
			value_date,
			accUas,
			asrow,
			LAST_VALUE(accUas) OVER (PARTITION BY uasid ORDER BY value_date ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as final_accUas
		from tc
	)

	select
		user_asset_id,
		uasid,
		secid,
		cv,
		value_date,
		accUas,
		asrow,
		SUM(final_accUas) OVER (PARTITION BY user_asset_id ORDER BY value_date) as accAss
		from final_per_security
	)

select * from tca
