import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Ticket } from "./ticket.entity.js";

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "varchar", length: 20 })
  type!: string;

  @Column({ type: "boolean", default: false })
  fromMe!: boolean;

  @Column({ type: "boolean", default: false })
  read!: boolean;

  @Column({ type: "text", nullable: true })
  mediaUrl!: string;

  @ManyToOne(() => Ticket, (ticket) => ticket.messages)
  ticket!: Ticket;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;
}
