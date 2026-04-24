export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = "appttP04OnzzC7qxG";
  const TABLE = "Solutions";

  let allRecords = [];
  let offset = null;

  try {
    do {
      let url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE}?pageSize=100`;
      if (offset) url += `&offset=${offset}`;

      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Airtable API error" });
      }

      const data = await response.json();

      const converted = data.records.map(rec => {
        const fields = {};
        Object.keys(rec.fields).forEach(k => {
          fields[k.replace(/^\uFEFF/, '')] = rec.fields[k];
        });
        const f = fields;
        return {
          s: f["方案名稱"] || "",
          c: (Array.isArray(f["公司名稱"]) ? f["公司名稱"][0] : f["公司名稱"]) || "",
          p: f["參與計畫"] || "",
          ai: f["是否AI方案"] === "True",
          d: (Array.isArray(f["服務領域"]) ? f["服務領域"].join(", ") : f["服務領域"]) || "",
          cat: (Array.isArray(f["領域大分類"]) ? f["領域大分類"].join(", ") : f["領域大分類"]) || "",
          pr: f["費用"] || null,
          pt: f["價格區間"] || "",
          mo: f["月費"] || null,
          mt: f["月費區間"] || "",
          r: (typeof f["區域"] === "string" ? f["區域"].trim() : (Array.isArray(f["區域"]) ? (f["區域"][0] || "") : "")).trim(),
          st: (typeof f["是否新創"] === "string" ? f["是否新創"] === "True" : (Array.isArray(f["是否新創"]) ? f["是否新創"][0] === "True" : false)),
          desc: f["方案介紹"] || ""
        };
      });

      allRecords = allRecords.concat(converted);
      offset = data.offset || null;
    } while (offset);

    return res.status(200).json(allRecords);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
