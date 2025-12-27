import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  SignalDataTypeMap,
} from "baileys";
import { Repository } from "typeorm";
import { AuthSession } from "../database/entities/AuthSession.entity.js";

/**
 * usePostgresAuthState
 * Responsabilidade: Adaptar as operações de leitura/escrita do Baileys
 * para operações de banco de dados do TypeORM.
 */
export const usePostgresAuthState = async (
  repository: Repository<AuthSession>,
  sessionId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> => {
  // --- Funções Auxiliares (Helpers) ---

  const readData = async (category: string, id: string) => {
    const session = await repository.findOne({
      where: { sessionId, category, id },
    });
    return session ? JSON.parse(session.value, BufferJSON.reviver) : null;
  };

  const writeData = async (category: string, id: string, data: any) => {
    const value = JSON.stringify(data, BufferJSON.replacer);
    await repository.save({ sessionId, category, id, value });
  };

  const removeData = async (category: string, id: string) => {
    await repository.delete({ sessionId, category, id });
  };

  // --- Inicialização ---

  const creds: AuthenticationCreds =
    (await readData("creds", "main")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};

          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(type, id);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              if (value) data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];

          for (const category in data) {
            const key = category as keyof typeof data;

            const categoryData = data[key];

            if (categoryData) {
              for (const id in categoryData) {
                const value = categoryData[id];

                if (value) {
                  tasks.push(writeData(key, id, value));
                } else {
                  tasks.push(removeData(key, id));
                }
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData("creds", "main", creds);
    },
  };
};
