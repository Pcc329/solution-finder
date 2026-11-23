-- ============================================================
-- 海巡完整稽核寫入：新創嚴選網、SME AI平台、雲市集工業館
-- 日期：2026-11-23
-- 執行：PPC 於 Supabase SQL Editor 一次執行整份（單一交易；任一檢查失敗即整份撤銷）
-- 證據：Claude in Chrome 於 2026-11-23 10:26～11:28 擷取官網完整清單（筆數＝頁面總數、編號不重複、逐頁校驗和一致）
--       新創嚴選 156（API total=156）／SME AI 269（17 頁）／工業館 ①111 ②210 ③225（三頁 546 筆、519 個不重複名稱）
--       資料庫端：同日唯讀匯出 760 筆（新創 152、SME AI 279、工業館 329），以正規化名稱比對（NFKC、去空白／控制字元／標點）
-- 內容：
--   A. 狀態 6 筆：恢復正常 5（SOL-SME-0199、0201；SOL-MOE-0714、0590、0505）、改已下架 1（SOL-SME-0133）
--   B. 名稱 1 筆：SOL-MOE-0590 → 官網現名
--   C. 公司 2 筆：SOL-1200、SOL-1211 補 company_id（同公司在資料庫已有 id）
--   D. 網址 108 筆：工業館官網「一個詳情編號對一筆資料庫記錄」者寫入 website_url（不寫留痕，可由回復查詢整批還原）
-- 預期影響：前台可見 −1；留痕 +9；SME AI 正常278／疑似0／已下架1；工業館 正常127／疑似202／已下架0；新創不變 128／0／24
-- ============================================================

begin;

-- ---------- 變更清單 ----------
create temp table v_status (solution_id text primary key, old_status text, new_status text, reason text) on commit drop;
insert into v_status values
 ('SOL-SME-0199','疑似已下架_SME AI平台方案未持續上架未逐筆驗證','正常',
  '2026-11-23 完整稽核：SME AI 官網完整清單（269 張，編號不重複）以同名出現（官網編號 171，公司：歐碳科技）。9/30 在、11/02 未出現（改疑似）、11/23 重新出現，恢復正常。信心：中高。'),
 ('SOL-SME-0201','疑似已下架_SME AI平台方案未持續上架未逐筆驗證','正常',
  '2026-11-23 完整稽核：SME AI 官網完整清單（269 張，編號不重複）以同名出現（官網編號 170，公司：歐碳科技）。9/30 在、11/02 未出現（改疑似）、11/23 重新出現，恢復正常。信心：中高。'),
 ('SOL-SME-0133','疑似已下架_SME AI平台方案未持續上架未逐筆驗證','已下架_SME AI平台官網完整清單連續三次未出現',
  '2026-11-23 完整稽核：SME AI 官網完整清單（269 張，編號不重複）未出現；9/30（266 張，另掃詳情頁編號 1～800 皆無）、11/02（265 張）亦未出現，連續三次完整清單。同公司（行動貝果）Genie CFO／CMO／CRO 仍在架，無對應改名。原狀態為 9/30 標記之疑似。'),
 ('SOL-MOE-0714','疑似已下架_雲市集工業館平台方案未持續上架未逐筆驗證','正常',
  '2026-11-23 完整稽核：工業館③ AI 工具庫 Lite 同名同公司在架（AITools_solution_in.aspx?P=c117ce7b-f70b-420b-b93b-126aca1c9f3f），恢復正常。信心：中高。'),
 ('SOL-MOE-0590','疑似已下架_雲市集工業館平台方案未持續上架未逐筆驗證','正常',
  '2026-11-23 完整稽核：工業館③ 同公司在架，官網名稱「MantaGO AI對話式商務平台」（AITools_solution_in.aspx?P=96efd25a-9c79-4c11-b264-937767b0749f），原名「MantaGO 對話式商務平台」，判斷為改名，恢復正常並更新名稱。信心：中高。'),
 ('SOL-MOE-0505','疑似已下架_雲市集工業館平台方案未持續上架未逐筆驗證','正常',
  '2026-11-23 完整稽核：工業館③ 同公司在架「SARA 智慧生產排程系統」（AITools_solution_in.aspx?P=405279f5-6d0a-4a3c-b3c8-faec1d539d29），官網不列版本級距，本筆「(入門版)」視為該產品之方案層級記錄，恢復正常。信心：中。');

create temp table v_company (solution_id text primary key, company_id text, reason text) on commit drop;
insert into v_company values
 ('SOL-1200','90581366','2026-11-23 完整稽核：新創嚴選官網此方案公司為「蘿蔔科技股份有限公司」；同公司方案 SOL-1189 之 company_id 為 90581366，補入。狀態不變。'),
 ('SOL-1211','50965274','2026-11-23 完整稽核：新創嚴選官網此方案公司為「暴風數位股份有限公司」；同公司方案 SOL-1378、SOL-SME-0393 之 company_id 為 50965274，補入。狀態不變。');

create temp table v_url (solution_id text primary key, website_url text) on commit drop;
insert into v_url values
 ('SOL-MOE-0397','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=cf5d70f3-afdb-4baf-9b75-3ade2ab362ac'),
 ('SOL-MOE-0398','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=79460481-558d-4c30-b127-3f69d9ea4279'),
 ('SOL-MOE-0403','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=b513c14e-1baf-4af3-a775-1d22c204bab5'),
 ('SOL-MOE-0405','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=2f5ed3cf-d7d1-4ed9-ae03-faa750f52fdc'),
 ('SOL-MOE-0406','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=cef7c0c5-44f2-412a-ab7a-ac2569aa88b7'),
 ('SOL-MOE-0421','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=8ecbee41-dda0-4c9e-ac82-adee59d1715e'),
 ('SOL-MOE-0422','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=5ebddce8-1f4e-4ba5-8800-bb2591eee722'),
 ('SOL-MOE-0423','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=0ebea10a-7929-4b26-abd2-cc9a4d2c5721'),
 ('SOL-MOE-0424','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=64885180-f3c4-4fb0-bcc1-e6256e8ce5e4'),
 ('SOL-MOE-0427','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=a135b33a-706c-4945-86f2-bbd61ea553c2'),
 ('SOL-MOE-0429','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=fdc5e67c-9def-4ff2-9497-d3685f61d94e'),
 ('SOL-MOE-0432','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=0733561d-3408-4eec-89bc-dd5444e635c7'),
 ('SOL-MOE-0433','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=fed0da16-9b79-4401-9523-2cd2fef2eb65'),
 ('SOL-MOE-0434','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=77ffe420-c5c6-4eac-abb0-657f45a2ae0e'),
 ('SOL-MOE-0435','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=9a224a44-d3c6-44b7-ab36-9af34a86fd5f'),
 ('SOL-MOE-0439','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=21af3da2-c1aa-4126-8adb-5f0490ff4fcf'),
 ('SOL-MOE-0441','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=0f7277de-28b2-455a-9da6-1d5da6ce0c87'),
 ('SOL-MOE-0442','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=f5ed32ef-46d5-439b-a5dc-d9fef4fc7434'),
 ('SOL-MOE-0444','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=7bdbdbf5-786c-c252-597e-232fa57bf47b'),
 ('SOL-MOE-0445','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=ed82b79a-b44d-a734-7814-cae4bca14214'),
 ('SOL-MOE-0449','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=9ea7d3d1-00d8-3474-ba38-a28d317dc586'),
 ('SOL-MOE-0450','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=1ccb2ba7-5435-95bf-25dc-04a64765b8d9'),
 ('SOL-MOE-0451','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=e95c342b-24e3-3582-d374-5816411dce8d'),
 ('SOL-MOE-0452','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=bc22013c-f72d-4fe8-87fa-cbd915e3c35c'),
 ('SOL-MOE-0453','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=83315de4-f6d2-ad85-b068-43ad42a9b3b8'),
 ('SOL-MOE-0454','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=7ff6644a-41b3-e902-0d1e-2a671ab56064'),
 ('SOL-MOE-0455','https://keid.nat.gov.tw/cloud/Web/cloud_solution_in.aspx?P=32a6d456-3458-e2c2-dc74-d981cb93338c'),
 ('SOL-MOE-0456','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=7a17f5b3-6f0e-4fe6-a1b8-24baf73c6b3f'),
 ('SOL-MOE-0457','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=0b9bfa26-05ed-441b-93c1-9341ffc8b192'),
 ('SOL-MOE-0459','https://keid.nat.gov.tw/cloud/Web/cloud_solution_in.aspx?P=25bd9b3d-336d-4e7b-b98e-87432398ed41'),
 ('SOL-MOE-0470','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=8fef5081-c8b4-4d07-9522-c3e87864c9be'),
 ('SOL-MOE-0471','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=feeaa7ec-b7f2-42c9-80e4-e60c700fa32c'),
 ('SOL-MOE-0473','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=dc8b8102-a94e-6ed0-d7db-5320332729f7'),
 ('SOL-MOE-0474','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=ae326d3d-1a91-4f78-8fc1-36bcd0dd0d4d'),
 ('SOL-MOE-0475','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=2335da42-939e-4553-8449-93f570470ce9'),
 ('SOL-MOE-0476','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=99bc369f-42c1-6c04-673d-85d54dd81d92'),
 ('SOL-MOE-0477','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=8a5e4615-2ac1-a30d-a35c-19efed64b141'),
 ('SOL-MOE-0478','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=68672b23-2e9d-41e1-9d7d-5cacd346e658'),
 ('SOL-MOE-0484','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=0cf88f24-a742-4fdf-bd3c-a4d473cdfc82'),
 ('SOL-MOE-0485','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=6e63fcd3-63f0-48af-9cf2-7038e89bcdee'),
 ('SOL-MOE-0486','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=d5d1947d-4475-4e5c-b64b-52fbc4658cb1'),
 ('SOL-MOE-0487','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=5d8a31f2-dd9a-4f68-9c3e-d4529dd722a9'),
 ('SOL-MOE-0488','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=6b97f116-583d-4d4d-8207-99b90cc62103'),
 ('SOL-MOE-0489','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=2287f52d-e675-c217-b768-765dbdbd6d28'),
 ('SOL-MOE-0490','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=ec51672c-18f5-4369-aa6a-b9d00687caa5'),
 ('SOL-MOE-0493','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=13031d22-edb3-62a4-c865-af61265aadbc'),
 ('SOL-MOE-0495','https://keid.nat.gov.tw/cloud/Web/cloud_solution_in.aspx?P=3e743026-abad-cae7-404d-859b9cdf864e'),
 ('SOL-MOE-0497','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=05c8307f-199d-4030-8acd-f0a46bf599b7'),
 ('SOL-MOE-0498','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=8a373ea7-bcb1-4b95-892e-d68ec4cfceaa'),
 ('SOL-MOE-0502','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=7c9f14bc-1736-438c-9d53-2ed48dc825fc'),
 ('SOL-MOE-0503','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=b5473d15-9f7f-411d-af1c-f822c109bede'),
 ('SOL-MOE-0508','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=e6ef8aad-5683-4c2e-8094-37a938b50b6b'),
 ('SOL-MOE-0509','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=84d43c66-4edd-4714-ae99-3ee16c45d2ee'),
 ('SOL-MOE-0512','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=e95e1248-8bc8-7ac8-dbcf-e38595413485'),
 ('SOL-MOE-0513','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=88a281c1-1cf5-cc5f-b75c-2f0d852128d4'),
 ('SOL-MOE-0514','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=49a4b138-bf97-497d-a855-6bc9114ce26a'),
 ('SOL-MOE-0515','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=516ae7b2-cbb0-429f-b94a-b991e380b9e6'),
 ('SOL-MOE-0516','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=39a88391-1278-3b3d-70e1-84739896b7b6'),
 ('SOL-MOE-0518','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=c12cbfce-3476-4a4d-a186-3fced505e760'),
 ('SOL-MOE-0519','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=02581f71-d73c-4535-9d38-1ebd1cef9229'),
 ('SOL-MOE-0520','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=629422ac-b1fa-8731-2013-bc0ab7fb36e7'),
 ('SOL-MOE-0521','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=0abab4fe-a630-49bc-be2d-7cf909c2d50b'),
 ('SOL-MOE-0523','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=7d0235c0-01bc-49e6-85f6-854cbf79f47c'),
 ('SOL-MOE-0527','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=71365ee5-47cd-b775-fa5b-956a62da6449'),
 ('SOL-MOE-0532','https://keid.nat.gov.tw/cloud/Web/cloud_solution_in.aspx?P=2446a166-13da-83cd-c435-4a815838e9d5'),
 ('SOL-MOE-0547','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=e4053f95-ea89-4ae9-9251-3695b9302dfe'),
 ('SOL-MOE-0548','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=5c7b3c1f-fa51-4356-95ea-cea9d8a96a4a'),
 ('SOL-MOE-0549','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=1141b533-917c-4926-9b8e-1c154fedadda'),
 ('SOL-MOE-0550','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=ed9e1590-745b-4bce-99ca-0800106f54f8'),
 ('SOL-MOE-0551','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=a3e6822e-a585-4b89-9ab3-b1721f70bbe8'),
 ('SOL-MOE-0552','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=9a7d033f-9519-4dfb-8af0-697f6da915a8'),
 ('SOL-MOE-0553','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=34a590dc-6b7f-460f-bea6-1896bbeac67f'),
 ('SOL-MOE-0554','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=a58c6920-5c09-4c6f-9e78-2c64452e58cc'),
 ('SOL-MOE-0555','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=458135b5-93fa-476e-92bf-8b246ddfddae'),
 ('SOL-MOE-0556','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=96efd25a-9c79-4c11-b264-937767b0749f'),
 ('SOL-MOE-0557','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=8184b1d4-5362-4112-b307-d86b04a66dd0'),
 ('SOL-MOE-0558','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=b07dd8b5-1114-4f15-8ea1-b252ccb019b8'),
 ('SOL-MOE-0559','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=e561c9ca-be82-4934-9dd7-beedb3a44a26'),
 ('SOL-MOE-0560','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=0b3d5b38-c484-47f6-b3eb-e85cd9cc4bbf'),
 ('SOL-MOE-0561','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=a68208dd-84e4-449c-a286-dc0aaf4af5b0'),
 ('SOL-MOE-0562','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=7006b773-092e-4e87-8fb8-ca4cbfb86fb0'),
 ('SOL-MOE-0563','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=5de66dc4-5a82-4646-8bff-28de4f427a33'),
 ('SOL-MOE-0564','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=cae09973-625e-4a7d-821a-aa6a9373d366'),
 ('SOL-MOE-0566','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=54a7bedc-9472-e35a-7ed8-e9a17695ad71'),
 ('SOL-MOE-0567','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=b049b436-9675-8555-17c4-c084e7d0c328'),
 ('SOL-MOE-0568','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=1d1179f9-d0c6-e9c6-044c-962cc6e3c2f2'),
 ('SOL-MOE-0569','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=45a9f71d-9695-45e7-b693-9d73f94e0be3'),
 ('SOL-MOE-0570','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=d021be37-e0a3-4765-95ac-346939ffc994'),
 ('SOL-MOE-0574','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=0f1af115-7eaa-436d-855a-e651200b484d'),
 ('SOL-MOE-0575','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=cf319d1a-b2a8-473d-8417-a90aa9244b71'),
 ('SOL-MOE-0576','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=350ae759-6db7-4148-b51b-337948351e57'),
 ('SOL-MOE-0577','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=47d8ec2f-0b75-4fa8-a291-e5070bc815c7'),
 ('SOL-MOE-0580','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=d0e46231-2640-4f19-af35-bf6315fc1ce5'),
 ('SOL-MOE-0581','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=5982ddb8-23c3-4b22-9add-9a1040c7fea5'),
 ('SOL-MOE-0583','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=503b8e71-5809-43d8-809d-df7c79822561'),
 ('SOL-MOE-0586','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=4c7b5086-8d5a-4377-a9aa-36c68e5fee81'),
 ('SOL-MOE-0587','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=5269696a-36a6-18f7-313d-68919eeefb8c'),
 ('SOL-MOE-0588','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=c9f27611-6b16-bebd-7579-1e3559229acd'),
 ('SOL-MOE-0589','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=2c572818-e6f9-4421-ab51-329e499475ab'),
 ('SOL-MOE-0595','https://keid.nat.gov.tw/cloud/Web/cloud_solution_in.aspx?P=18f33886-1b93-12ab-5f4b-7f212ec04a05'),
 ('SOL-MOE-0714','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=c117ce7b-f70b-420b-b93b-126aca1c9f3f'),
 ('SOL-MOE-0717','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=ddc433ef-a208-4f37-a5bc-3b4b952d57bd'),
 ('SOL-MOE-0719','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=4b9a494d-4108-4f7b-a536-6318584e537e'),
 ('SOL-MOE-0721','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=7f41c247-0246-4b8e-9ff5-3c474c1fc8f7'),
 ('SOL-MOE-0722','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=7c58ee3b-8d18-b793-d137-1e174146d55b'),
 ('SOL-MOE-0723','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=2adc3798-bbbb-283e-d393-d7dbe3aab301'),
 ('SOL-MOE-0724','https://keid.nat.gov.tw/cloud/Web/AITools_solution_in.aspx?P=420f3ed9-b02e-4945-83e1-8942ac5215bc'),
 ('SOL-MOE-0725','https://keid.nat.gov.tw/cloud/Web/ai_solution_in.aspx?P=eeb2acba-c34f-26a1-72e1-11ec775f24b3');

create temp table v_before on commit drop as
select
  (select count(*) from public.solutions where record_status is null or record_status not like '已下架%') as visible,
  (select count(*) from public.solution_status_log) as log_rows;

-- ---------- 前置檢查 ----------
do $pre$
declare n int;
begin
  if (select count(*) from v_status) <> 6 or (select count(*) from v_company) <> 2 or (select count(*) from v_url) <> 108 then
    raise exception '前置檢查失敗：變更清單筆數不符（預期 6／2／108）';
  end if;

  select count(*) into n from public.solutions s join v_status v using (solution_id) where s.record_status = v.old_status;
  if n <> 6 then raise exception '前置檢查失敗：狀態符合原值的只有 % 筆（預期 6）。可能已執行過或狀態已被改動', n; end if;

  if (select solution_name from public.solutions where solution_id = 'SOL-MOE-0590') <> 'MantaGO 對話式商務平台' then
    raise exception '前置檢查失敗：SOL-MOE-0590 名稱已非原值';
  end if;

  select count(*) into n from public.solutions s join v_company using (solution_id)
   where s.program_type = '新創嚴選網' and s.company_id is null;
  if n <> 2 then raise exception '前置檢查失敗：待補公司且目前為空的只有 % 筆（預期 2）', n; end if;
  select count(*) into n from public.companies c join v_company v on c.company_id::text = v.company_id;
  if n <> 2 then raise exception '前置檢查失敗：companies 表只找到 % 家（預期 2）', n; end if;

  select count(*) into n from public.solutions s join v_url using (solution_id)
   where s.program_type = '雲市集工業館' and (s.website_url is null or s.website_url = '');
  if n <> 108 then raise exception '前置檢查失敗：工業館且網址為空的只有 % 筆（預期 108）', n; end if;

  -- 來源分布須與 11/23 匯出相同
  if (select count(*) filter (where record_status = '正常') || '/' || count(*) filter (where record_status like '疑似%') || '/' || count(*) filter (where record_status like '已下架%')
        from public.solutions where program_type = 'SME AI平台') <> '276/3/0'
     or (select count(*) filter (where record_status = '正常') || '/' || count(*) filter (where record_status like '疑似%') || '/' || count(*) filter (where record_status like '已下架%')
        from public.solutions where program_type = '雲市集工業館') <> '124/205/0'
     or (select count(*) filter (where record_status = '正常') || '/' || count(*) filter (where record_status like '疑似%') || '/' || count(*) filter (where record_status like '已下架%')
        from public.solutions where program_type = '新創嚴選網') <> '128/0/24' then
    raise exception '前置檢查失敗：來源分布與 2026-11-23 匯出不符，已中止';
  end if;
end $pre$;

-- ---------- 寫入 ----------
-- A. 狀態
update public.solutions s
   set record_status = v.new_status, updated_at = now()
  from v_status v
 where s.solution_id = v.solution_id;

-- B. 名稱
update public.solutions
   set solution_name = 'MantaGO AI對話式商務平台', updated_at = now()
 where solution_id = 'SOL-MOE-0590';

-- C. 公司
update public.solutions s
   set company_id = v.company_id, updated_at = now()
  from v_company v
 where s.solution_id = v.solution_id;

-- D. 網址
update public.solutions s
   set website_url = v.website_url, updated_at = now()
  from v_url v
 where s.solution_id = v.solution_id;

-- 留痕：狀態 6 ＋ 名稱 1 ＋ 公司 2 ＝ 9
insert into public.solution_status_log (solution_id, status_change, reason)
select solution_id, new_status, reason || '（原狀態：' || old_status || '）' from v_status;

insert into public.solution_status_log (solution_id, status_change, reason)
values ('SOL-MOE-0590', '正常',
        '2026-11-23 完整稽核：名稱更新「MantaGO 對話式商務平台」→「MantaGO AI對話式商務平台」（工業館③ 官網現名，P=96efd25a-9c79-4c11-b264-937767b0749f）。');

insert into public.solution_status_log (solution_id, status_change, reason)
select v.solution_id, s.record_status, v.reason
  from v_company v join public.solutions s using (solution_id);

-- ---------- 交易內自檢 ----------
do $chk$
declare b record; v_vis bigint; v_log bigint; n int;
begin
  select * into b from v_before;
  select count(*) into v_vis from public.solutions where record_status is null or record_status not like '已下架%';
  select count(*) into v_log from public.solution_status_log;
  if b.visible - v_vis <> 1 then raise exception '自檢失敗：前台可見減少 % 筆（預期 1）', b.visible - v_vis; end if;
  if v_log - b.log_rows <> 9 then raise exception '自檢失敗：留痕新增 % 筆（預期 9）', v_log - b.log_rows; end if;

  select count(*) into n from public.solutions s join v_status v using (solution_id) where s.record_status = v.new_status;
  if n <> 6 then raise exception '自檢失敗：狀態更新 % 筆（預期 6）', n; end if;
  if (select solution_name from public.solutions where solution_id = 'SOL-MOE-0590') <> 'MantaGO AI對話式商務平台' then
    raise exception '自檢失敗：SOL-MOE-0590 名稱未更新';
  end if;
  select count(*) into n from public.solutions s join v_company v using (solution_id) where s.company_id::text = v.company_id;
  if n <> 2 then raise exception '自檢失敗：公司補入 % 筆（預期 2）', n; end if;
  select count(*) into n from public.solutions s join v_url v using (solution_id) where s.website_url = v.website_url;
  if n <> 108 then raise exception '自檢失敗：網址寫入 % 筆（預期 108）', n; end if;

  if (select count(*) filter (where record_status = '正常') || '/' || count(*) filter (where record_status like '疑似%') || '/' || count(*) filter (where record_status like '已下架%')
        from public.solutions where program_type = 'SME AI平台') <> '278/0/1' then
    raise exception '自檢失敗：SME AI 分布不符（預期 278/0/1）';
  end if;
  if (select count(*) filter (where record_status = '正常') || '/' || count(*) filter (where record_status like '疑似%') || '/' || count(*) filter (where record_status like '已下架%')
        from public.solutions where program_type = '雲市集工業館') <> '127/202/0' then
    raise exception '自檢失敗：工業館分布不符（預期 127/202/0）';
  end if;
  if (select count(*) filter (where record_status = '正常') || '/' || count(*) filter (where record_status like '疑似%') || '/' || count(*) filter (where record_status like '已下架%')
        from public.solutions where program_type = '新創嚴選網') <> '128/0/24' then
    raise exception '自檢失敗：新創嚴選分布不符（預期 128/0/24）';
  end if;
  raise notice '自檢通過：狀態 6、名稱 1、公司 2、網址 108、留痕 9；前台可見 % → %', b.visible, v_vis;
end $chk$;

commit;

-- ============================================================
-- 交易外獨立驗證（commit 後另開查詢執行，貼結果給 Claude）
-- ============================================================
-- select program_type,
--        count(*) filter (where record_status = '正常') as 正常,
--        count(*) filter (where record_status like '疑似%') as 疑似,
--        count(*) filter (where record_status like '已下架%') as 已下架,
--        count(*) filter (where website_url like 'https://keid.nat.gov.tw/%') as 工業館網址,
--        count(*) filter (where company_id is null) as 無公司
--   from public.solutions
--  where program_type in ('新創嚴選網','SME AI平台','雲市集工業館')
--  group by 1 order by 1;
--
-- select solution_id, solution_name, company_id, record_status
--   from public.solutions
--  where solution_id in ('SOL-SME-0199','SOL-SME-0201','SOL-SME-0133','SOL-MOE-0714','SOL-MOE-0590','SOL-MOE-0505','SOL-1200','SOL-1211')
--  order by 1;
--
-- select count(*) as 今日留痕 from public.solution_status_log where reason like '2026-11-23 完整稽核%';
--
-- 預期：SME AI 278/0/1、無公司 64；工業館 127/202/0、網址 108、無公司 136；新創 128/0/24、無公司 0；今日留痕 9

-- ============================================================
-- 回復（需要時另開查詢執行；寫一筆回復留痕，不刪除本次紀錄）
-- ============================================================
-- 狀態：依本檔 v_status 的 old_status 逐筆改回，並 insert 留痕「回復 2026-11-23 稽核變更（原因：＿＿＿＿）」
-- 名稱：update public.solutions set solution_name = 'MantaGO 對話式商務平台' where solution_id = 'SOL-MOE-0590';
-- 公司：update public.solutions set company_id = null where solution_id in ('SOL-1200','SOL-1211');
-- 網址：update public.solutions set website_url = null
--        where program_type = '雲市集工業館' and website_url like 'https://keid.nat.gov.tw/cloud/Web/%';
