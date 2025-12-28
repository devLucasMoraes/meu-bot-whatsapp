import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Contact } from "./contact.entity.js";
import { Message } from "./message.entity.js";
import { Queue } from "./queue.entity.js";
import { Tenant } from "./tenant.entity.js";
import { User } from "./user.entity.js";
import { WhatsappInstance } from "./whatsappInstance.entity.js";

export enum TicketStatus {
  PENDING = "pending",
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  CLOSED = "closed",
}

@Entity("tickets")
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "varchar",
    length: 20,
    default: TicketStatus.PENDING,
  })
  status!: TicketStatus;

  @Column({ type: "uuid" })
  tenantId!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.tickets)
  @JoinColumn({ name: "tenantId" })
  tenant!: Tenant;

  @ManyToOne(() => Contact, (contact) => contact.tickets)
  @JoinColumn({ name: "contactId" })
  contact!: Contact;

  @ManyToOne(() => WhatsappInstance, (whatsapp) => whatsapp.tickets)
  @JoinColumn({ name: "whatsappId" })
  whatsapp!: WhatsappInstance;

  @ManyToOne(() => Queue, (queue) => queue.tickets, { nullable: true })
  @JoinColumn({ name: "queueId" })
  queue!: Queue | null;

  @ManyToOne(() => User, (user) => user.tickets, { nullable: true })
  @JoinColumn({ name: "userId" })
  user!: User | null;

  @OneToMany(() => Message, (message) => message.ticket)
  messages!: Message[];

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
