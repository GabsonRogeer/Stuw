-- Run only after scripts/retire-olist-legacy.cjs verifies Olist parent 363782837 is inactive.
begin;
update public.olist_skus set remote_id=null,state='pending',attempted_at=null,remote_hash=null,last_error=null
 where product_id=1000002 and remote_id in ('363782839','363782847','363782853');
update public.olist_products set remote_id=null,state='pending',attempted_at=null,remote_hash=null,last_error=null
 where product_id=1000002 and remote_id='363782837';
commit;
