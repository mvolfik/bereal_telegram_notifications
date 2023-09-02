const TOKEN = Deno.env.get("TG_BOT_TOKEN");
const TG_CHANNEL_ID = Deno.env.get("TG_CHANNEL_ID");
const DOMAIN = Deno.env.get("DOMAIN");
const API_KEY = Deno.env.get("API_KEY");

const REGIONAL_CHANNEL_IDS = new Map(
  ["us-central", "europe-west", "asia-west", "asia-east"].map((reg) => [
    reg,
    Deno.env.get("TG_CHANNEL_ID_" + reg.replace("-", "_")),
  ])
);

export const webhookPath = "/tg-webhook";

function genRandomToken(bytes: number) {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)))
  )
    .replaceAll("/", "_")
    .replaceAll("+", "-")
    .replaceAll("=", "");
}

const webhookUrlToken = genRandomToken(96);

export async function init() {
  if (!TOKEN || !DOMAIN || !TG_CHANNEL_ID || !API_KEY) {
    throw new Error(
      "TG_BOT_TOKEN, TG_CHANNEL_ID, DOMAIN or API_KEY is not set"
    );
  }
  for (const [region, id] of REGIONAL_CHANNEL_IDS.entries()) {
    if (!id) {
      throw new Error(`TG_CHANNEL_ID_${region} is not set: ${id}`);
    }
  }

  await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: `https://${DOMAIN}${webhookPath}`,
      secret_token: webhookUrlToken,
      allowed_updates: ["message"],
    }),
  });
  poll().finally(() => Deno.exit(1));
}

let latest: Record<string, number> = JSON.parse(
  await Deno.readTextFile("data/latest.json")
);

async function poll() {
  while (true) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(
      "https://bereal.devin.rest/v1/moments/latest?api_key=" + API_KEY
    );
    const data: { regions: Record<string, { ts: number }> } = await res.json();
    const newLatest = Object.fromEntries(
      Object.entries(data.regions).map(([reg, { ts }]) => [reg, ts * 1000])
    );
    for (const [reg, ts] of Object.entries(newLatest)) {
      if (ts > latest[reg]) {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: TG_CHANNEL_ID,
            text: `[${reg}] Time to BeReal!`,
          }),
        });
        const regionalChannel = REGIONAL_CHANNEL_IDS.get(reg);
        if (regionalChannel) {
          await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: regionalChannel,
              text: `Time to BeReal!`,
            }),
          });
        }
      }
    }
    latest = newLatest;
    await Deno.writeTextFile("data/latest.json", JSON.stringify(latest));
  }
}

export async function handleRequest(e: Deno.RequestEvent) {
  if (
    e.request.method.toUpperCase() !== "POST" ||
    e.request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== webhookUrlToken
  ) {
    await e.respondWith(
      new Response("You shall not pass", {
        status: 401,
        headers: {
          "Content-Type": "text/plain",
        },
      })
    );
    return;
  }

  const data = await e.request.json();

  await Promise.all([
    e.respondWith(
      new Response("processing", {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      })
    ),
    processTgUpdate(data),
  ]);
}

async function processTgUpdate(data: any) {
  console.log(data.message);

  if (data.message.chat.id.toString() !== TG_CHANNEL_ID) {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: data.message.chat.id,
        text: "Subscribe to @bereal_notifications",
      }),
    });
    return;
  }
}
