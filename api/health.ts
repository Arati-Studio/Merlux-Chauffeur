export default async function handler(req: any, res: any) {
  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  return res.status(200).json({ status: "ok", uptime: process.uptime() });
}
