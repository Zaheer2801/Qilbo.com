-- Migration v5: Fix 9 products wrongly in Lottery, XXL flavored items, New Amsterdam, and category_review_suggestions pending status

-- 1. Fix 9 products wrongly moved to Lottery by generic keyword matches:
UPDATE products SET category = 'Spirits', sub_category = 'Liqueur', brand = 'Twenty Grand', updated_at = datetime('now') WHERE id = 931;
UPDATE products SET category = 'Wine', sub_category = 'Wine', brand = 'Stella Rosa', updated_at = datetime('now') WHERE id = 1158;
UPDATE products SET category = 'Spirits', sub_category = 'Liqueur', brand = 'XXL', updated_at = datetime('now') WHERE id = 625;
UPDATE products SET category = 'Tobacco', sub_category = 'Cigarettes', brand = 'Lucky Strike', updated_at = datetime('now') WHERE id IN (714, 1037);
UPDATE products SET category = 'Tobacco', sub_category = 'Cigars/Cigarillos', brand = '4K', updated_at = datetime('now') WHERE id = 811;
UPDATE products SET category = 'Snacks & Grocery', sub_category = 'Snacks & Grocery', brand = 'Royal Honey', updated_at = datetime('now') WHERE id = 209;
UPDATE products SET category = 'Snacks & Grocery', sub_category = 'Snacks & Grocery', brand = 'Rhino', updated_at = datetime('now') WHERE id = 856;
UPDATE products SET category = 'Snacks & Grocery', sub_category = 'Snacks & Grocery', brand = 'Dirty Potato Chips', updated_at = datetime('now') WHERE id = 817;

-- 2. Fix 1367 & 1369: New Amsterdam
UPDATE products SET category = 'Spirits', sub_category = 'Vodka', brand = 'New Amsterdam', updated_at = datetime('now') WHERE id IN (1367, 1369);

-- 3. Fix all XXL flavored items -> Spirits / Liqueur (XXL)
UPDATE products SET category = 'Spirits', sub_category = 'Liqueur', brand = 'XXL', updated_at = datetime('now') WHERE id IN (618, 625, 727, 900, 929, 941, 995, 1080, 1127);

-- 4. In products: Revert non-explicitly categorized low-confidence items (< 0.90) to Spirits / Other Spirits – review
UPDATE products SET category = 'Spirits', sub_category = 'Other Spirits – review', updated_at = datetime('now') WHERE id IN (70, 379, 450, 491, 611, 732, 754, 793, 804, 869, 874, 912, 998, 1012, 1019, 1043, 1047, 1048, 1140, 1143, 1153, 1377, 1520);

-- 5. In category_review_suggestions:
-- Mark all 32 low-confidence suggestions (< 0.90) as 'pending'
UPDATE category_review_suggestions SET status = 'pending' WHERE confidence < 0.90;

-- Update the 9 lottery items in suggestions to their proper categories & approved
UPDATE category_review_suggestions SET suggested_category = 'Spirits', suggested_sub_category = 'Liqueur', suggested_brand = 'Twenty Grand', status = 'approved' WHERE product_id = 931;
UPDATE category_review_suggestions SET suggested_category = 'Wine', suggested_sub_category = 'Wine', suggested_brand = 'Stella Rosa', status = 'approved' WHERE product_id = 1158;
UPDATE category_review_suggestions SET suggested_category = 'Spirits', suggested_sub_category = 'Liqueur', suggested_brand = 'XXL', status = 'approved' WHERE product_id = 625;
UPDATE category_review_suggestions SET suggested_category = 'Tobacco', suggested_sub_category = 'Cigarettes', suggested_brand = 'Lucky Strike', status = 'approved' WHERE product_id IN (714, 1037);
UPDATE category_review_suggestions SET suggested_category = 'Tobacco', suggested_sub_category = 'Cigars/Cigarillos', suggested_brand = '4K', status = 'approved' WHERE product_id = 811;
UPDATE category_review_suggestions SET suggested_category = 'Snacks & Grocery', suggested_sub_category = 'Snacks & Grocery', suggested_brand = 'Royal Honey', status = 'approved' WHERE product_id = 209;
UPDATE category_review_suggestions SET suggested_category = 'Snacks & Grocery', suggested_sub_category = 'Snacks & Grocery', suggested_brand = 'Rhino', status = 'approved' WHERE product_id = 856;
UPDATE category_review_suggestions SET suggested_category = 'Snacks & Grocery', suggested_sub_category = 'Snacks & Grocery', suggested_brand = 'Dirty Potato Chips', status = 'approved' WHERE product_id = 817;

-- Update 1367 & 1369 in suggestions
UPDATE category_review_suggestions SET suggested_category = 'Spirits', suggested_sub_category = 'Vodka', suggested_brand = 'New Amsterdam' WHERE product_id IN (1367, 1369);

-- Update XXL items in suggestions
UPDATE category_review_suggestions SET suggested_category = 'Spirits', suggested_sub_category = 'Liqueur', suggested_brand = 'XXL' WHERE product_id IN (618, 727, 900, 929, 941, 995, 1080, 1127);
