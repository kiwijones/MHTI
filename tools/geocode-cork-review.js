const items = [
  ["Bearhaven Mines/Allihies Mines", "Allihies, County Cork, Ireland"],
  ["Ballydehob Mines", "Ballydehob, County Cork, Ireland"],
  ["Audley Mines", "Audley, County Cork, Ireland"],
  ["Crookhaven Mines", "Crookhaven, County Cork, Ireland"],
  ["Coosheen/ Schull Bay Mines", "Coosheen, Schull, County Cork, Ireland"],
  ["Rosscarbery Slate Quarries", "Rosscarbery, County Cork, Ireland"],
  ["Glandore/ Aghatubrid/ Maulagow Goleen Mines", "Goleen, County Cork, Ireland"],
  ["Hollyhill Mines", "Hollyhill, County Cork, Ireland"],
  ["Lackue Mines", "Lackue, County Cork, Ireland"],
  ["Lady’s Well Mine, Duneen", "Duneen, County Cork, Ireland"],
  ["Duhalla Coalfield", "Duhallow, County Cork, Ireland"],
  ["Ringabella", "Ringabella, County Cork, Ireland"],
  ["Sheep’s Head Mines", "Sheep’s Head, County Cork, Ireland"],
  ["Skibbereen Mines", "Skibbereen, County Cork, Ireland"]
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

(async function () {
  const output = [];
  for (const [name, query] of items) {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=ie&q=" + encodeURIComponent(query);
    try {
      const response = await fetch(url, { headers: { "User-Agent": "MHTI-map-recovery/1.0" } });
      const candidates = await response.json();
      output.push({
        name,
        query,
        candidates: candidates.map((candidate) => ({
          lat: Number(candidate.lat),
          lon: Number(candidate.lon),
          type: candidate.type,
          category: candidate.category,
          name: candidate.name,
          display_name: candidate.display_name
        }))
      });
    } catch (error) {
      output.push({ name, query, error: error.message });
    }
    await delay(1100);
  }
  console.log(JSON.stringify(output, null, 2));
}());
