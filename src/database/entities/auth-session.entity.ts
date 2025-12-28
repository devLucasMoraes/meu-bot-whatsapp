import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Entidade AuthSession
 * Responsabilidade: Definir o formato dos dados na tabela 'auth_sessions'.
 * Não contém lógica, apenas estrutura.
 */
@Entity({ name: "auth_sessions" })
export class AuthSession {
  @PrimaryColumn({ type: "varchar", length: 255 })
  sessionId!: string; // Permite múltiplos bots (ex: 'bot_vendas', 'bot_suporte')

  @PrimaryColumn({ type: "varchar", length: 255 })
  category!: string; // Categoria do Baileys (creds, keys, etc)

  @PrimaryColumn({ type: "varchar", length: 255 })
  id!: string; // ID único da chave dentro da categoria

  @Column({ type: "text" })
  value!: string; // O dado criptografado (JSON string)
}
