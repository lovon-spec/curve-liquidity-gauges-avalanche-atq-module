import type { ContractTag, ITagService } from "atq-types";
import fetch from "node-fetch";

// Messari publishes subgraph 2Vt8WtdXNZUEeaVtzyEd1dpioJf44nvomzkd4HhubfKS.
// Its schema defines _gaugeAddress as the liquidity gauge associated with the pool.
const deployment = "QmZyoRwhXKY2o9Yxqur5hNufKPPSwhZANtf4QQaiqC7Qms";
const endpoint = `https://gateway.thegraph.com/api/deployments/id/${deployment}`;
const zero = "0x" + "0".repeat(40);
type Meta = { deployment: string; hasIndexingErrors: boolean; block: { number: number; hash: string } };
type Pool = { id: string; _gaugeAddress: string; outputToken: { id: string; symbol: string } };
function address(value: unknown, allowZero = false): string {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value) || !allowZero && value.toLowerCase() === zero) throw new Error("Unknown contract address");
  return value.toLowerCase();
}
function meta(value: unknown, initial?: Meta): Meta {
  const m = value as Meta;
  if (!m || m.deployment !== deployment || m.hasIndexingErrors !== false || !Number.isSafeInteger(m.block?.number) || m.block.number < 1 ||
      !/^0x[0-9a-f]{64}$/i.test(m.block.hash) || initial && (m.block.number !== initial.block.number || m.block.hash !== initial.block.hash)) throw new Error("Unknown or inconsistent source snapshot");
  return m;
}
async function query(text: string, apiKey: string): Promise<Record<string, unknown>> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ query: text }), signal: controller.signal });
    if (!r.ok) throw new Error("Graph request failed");
    const d = await r.json() as { data?: unknown; errors?: unknown };
    if (!d || typeof d !== "object" || !d.data || typeof d.data !== "object" || Array.isArray(d.data) ||
        d.errors !== undefined && (!Array.isArray(d.errors) || d.errors.length)) throw new Error("Incomplete or invalid Graph response");
    return d.data as Record<string, unknown>;
  } finally { clearTimeout(timer); }
}
const service: ITagService = {
  async returnTags(chainId: string, apiKey: string | null): Promise<ContractTag[]> {
    if (chainId !== "43114") throw new Error(`Unsupported Chain ID: ${chainId}`);
    if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error("A Graph API key is required");
    const snapshot = meta((await query("{ _meta { deployment hasIndexingErrors block { number hash } } }", apiKey))._meta);
    const atBlock = `block: { hash: ${JSON.stringify(snapshot.block.hash)} }`;
    const tags: ContractTag[] = [], gauges = new Map<string, string>(), labels = new Set<string>();
    let cursor = "0x";
    for (;;) {
      // Pool IDs are unique addresses; the schema has no unique sequential field.
      const d = await query(`{ _meta(${atBlock}) { deployment hasIndexingErrors block { number hash } }
        liquidityPools(first: 1000, orderBy: id, orderDirection: asc, where: { id_gt: ${JSON.stringify(cursor)} }, ${atBlock})
        { id _gaugeAddress outputToken { id symbol } } }`, apiKey);
      meta(d._meta, snapshot);
      if (!Array.isArray(d.liquidityPools) || d.liquidityPools.length > 1000) throw new Error("Invalid pool page");
      const rows = d.liquidityPools as Pool[];
      for (const row of rows) {
        if (typeof row.id !== "string" || row.id <= cursor) throw new Error("Pool cursor did not advance");
        cursor = row.id;
        const pool = address(row.id), gauge = address(row._gaugeAddress, true);
        if (gauge === zero) continue;
        const lp = address(row.outputToken?.id), symbol = row.outputToken?.symbol;
        if (gauge === lp || gauge === pool || typeof symbol !== "string" || !symbol || symbol !== symbol.trim() || /[\u0000-\u001f\u007f]/.test(symbol)) throw new Error("Unknown gauge relationship or LP symbol");
        const binding = `${pool}:${lp}:${symbol}`;
        if (gauges.has(gauge)) {
          if (gauges.get(gauge) !== binding) throw new Error("Conflicting gauge relationship");
          continue;
        }
        gauges.set(gauge, binding);
        const name = `Curve.fi ${symbol} Gauge Deposit`;
        if (name.length > 50 || labels.has(name)) throw new Error("Official gauge name is too long or ambiguous");
        labels.add(name);
        tags.push({ "Contract Address": `eip155:43114:${gauge}`, "Project Name": "Curve Finance", "Public Name Tag": name,
          "UI/Website Link": "https://www.curve.finance", "Public Note": `Liquidity gauge and ERC-20 staking receipt token on Avalanche. LP token: ${lp}. Pool: ${pool}. Includes historical gauges; no claim of active rewards.` });
      }
      if (rows.length < 1000) break;
    }
    return tags;
  },
};
export async function returnTags(chainId: string, apiKey: string): Promise<ContractTag[]> {
  return service.returnTags(chainId, apiKey);
}
