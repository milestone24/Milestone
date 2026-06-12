--select * from user_accounts;
--select * from user_assets;
--select * from user_assets where user_account_id='5d4f0f7f-723c-4296-a4cf-d4a7e41db225' --gary;
--select * from user_assets where user_account_id='11867a08-da4a-49ad-a23b-a3de92febb83' --chris;
--select * from asset_values;
--select * from asset_values where asset_id='47968dbc-2335-4385-9faa-1e8e283ff972';

-- select * from asset_values where asset_id='547962dc-6b42-4a35-96f1-0b4375fc0338' --chris
-- select * from asset_values where asset_id='78b2e68f-bb55-432f-b059-e9edb9d94f57' --gary
-- order by value_date desc;

--delete from asset_values where asset_id='78b2e68f-bb55-432f-b059-e9edb9d94f57';
--delete from asset_values where asset_id='47968dbc-2335-4385-9faa-1e8e283ff972';

delete from asset_values where value_date >= '2025-12-23';

--select * from user_assets where user_account_id='5d4f0f7f-723c-4296-a4cf-d4a7e41db225'


-- select * from user_asset_securities as uas
-- left join security_transactions as st ON uas.id = st.asset_security_id
-- where uas.user_asset_id='78b2e68f-bb55-432f-b059-e9edb9d94f57'

--935ffb75-ee20-4887-b16a-657e443e7c3c
--select * from security_transactions where asset_security_id='935ffb75-ee20-4887-b16a-657e443e7c3c';



--delete from processes

--select * from processes

--select * from api_keys;
--delete from api_keys where id='7bb4b6bb-f295-49e5-98a8-ffa723bbcdba'

-- select s.id, s.name, s.country, s.exchange, s.symbol, sdh.date, sdh.close from securities as s
-- left join security_daily_history as sdh on s.id = sdh.security_id
-- where s.symbol = 'DYNPRO'
-- order by date desc;




