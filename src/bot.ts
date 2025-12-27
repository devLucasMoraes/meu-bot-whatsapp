import { Boom } from "@hapi/boom";
import makeWASocket, {
  AuthenticationState,
  ConnectionState,
  DisconnectReason,
  jidNormalizedUser,
} from "baileys";
import qrcode from "qrcode-terminal";

export async function startBot(authState: {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}) {
  const sock = makeWASocket({
    auth: authState.state,
    printQRInTerminal: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    syncFullHistory: false,
  });

  sock.ev.on("connection.update", (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Escaneie o QR Code abaixo:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log(`Conexão fechada. Reconectando: ${shouldReconnect}`);

      if (shouldReconnect) {
        startBot(authState);
      }
    } else if (connection === "open") {
      console.log("✅ Bot conectado! (Baileys v7 Ready)");
    }
  });

  sock.ev.on("creds.update", authState.saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];

    if (!msg.key.fromMe && m.type === "notify" && msg.key.remoteJid) {
      const sender = jidNormalizedUser(msg.key.remoteJid);

      console.log("Mensagem recebida de:", sender);

      if (sender.includes("@lid")) {
        console.log("⚠️ Usuário identificado via LID (Privacidade Ativa)");
      } else if (sender.includes("@s.whatsapp.net")) {
        console.log("📞 Usuário identificado via Número de Telefone");
      }
    }
  });
}
