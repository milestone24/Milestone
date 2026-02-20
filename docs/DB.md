

```bash
pg_dump \
# dump only schema with name
-Fc -v \
-n schema_name \
-d $DATABASE_URL \
-f output_filename
```


```bash
pg_restore \
# use multiple jobs ( can not use with single transaction )
-j 2 \
# use single transaction \
--single-transaction \
# Restore without ownership information \
--no-owner \
# Restore without trying to set original permissions. 
--no-privileges \
# Restore without privilege (GRANT) statements \
--no-acl \
# disable triggers
--disable-triggers \
-n schema_name
-d $DATABASE_URL \
neon_bck20260218155633.bak

pg_restore \
--single-transaction \
--no-owner \
--no-acl \
--no-privileges \
--disable-triggers \
-d $DATABASE_URL \
neon_bck20260218155633.bak

pg_restore \
--single-transaction \
--no-owner \
--no-acl \
--no-privileges \
--disable-triggers \
-n drizzle \
-d $DATABASE_URL \
neon_bck_drizzle20260219154549.bak
```